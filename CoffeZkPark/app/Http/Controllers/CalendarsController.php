<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\area;
use App\Models\calendars;
use Illuminate\Http\Request;

class CalendarsController extends Controller
{
    use EnsuresAreaAccess;

    // El área de seguridad es la única con horas extra/dominicales: 8h de jornada ordinaria +
    // hasta 4h de recargo/hora extra = 12h como máximo por turno.
    private const SEGURIDAD_MAX_SHIFT_HOURS = 12;

    // Todas las demás áreas: jornada ordinaria sin horas extra — 10h máximo por turno. La
    // entrada puede ser a cualquier hora (7am, 8am, etc.); lo único que se exige es no pasar
    // la duración máxima por turno, y el tope de horas semanales (ver Programaciones.tsx).
    private const DEFAULT_MAX_SHIFT_HOURS = 10;

    private function esAreaSeguridad(int $areaId): bool
    {
        return area::where('id', $areaId)->whereRaw('LOWER(nombre) = ?', ['seguridad'])->exists();
    }

    /**
     * Duración de un turno en minutos, saltando a la medianoche del día siguiente si la
     * salida es antes o igual que la entrada (turno nocturno) — mismo criterio que
     * shiftHours() en AreaScheduleGrid.tsx y shiftHoursDecimal() en AreaScheduleExport.php.
     */
    private function shiftDurationMinutes(string $horaEntrada, string $horaSalida): int
    {
        [$inH, $inM] = array_map('intval', explode(':', $horaEntrada));
        [$outH, $outM] = array_map('intval', explode(':', $horaSalida));
        $minutes = ($outH * 60 + $outM) - ($inH * 60 + $inM);
        if ($minutes <= 0) {
            $minutes += 24 * 60;
        }

        return $minutes;
    }

    /**
     * "12 horas" / "8 horas 30 minutos" / "45 minutos" 
     */
    private function formatDuration(int $minutes): string
    {
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        $parts = [];
        if ($h > 0) {
            $parts[] = $h . ' hora' . ($h === 1 ? '' : 's');
        }
        if ($m > 0) {
            $parts[] = $m . ' minuto' . ($m === 1 ? '' : 's');
        }

        return $parts === [] ? '0 minutos' : implode(' ', $parts);
    }

    /**
     * null si el turno es válido; el mensaje de error si viola la regla de horario del área.
     */
    private function shiftDurationError(int $areaId, string $horaEntrada, string $horaSalida): ?string
    {
        $minutes = $this->shiftDurationMinutes($horaEntrada, $horaSalida);

        if ($this->esAreaSeguridad($areaId)) {
            $maxMinutes = self::SEGURIDAD_MAX_SHIFT_HOURS * 60;

            if ($minutes > $maxMinutes) {
                return sprintf(
                    'Ese turno dura %s (de %s a %s) — en el área de Seguridad un turno no puede pasar de %s (jornada + horas extra legales). Revisa la hora de entrada/salida.',
                    $this->formatDuration($minutes),
                    $horaEntrada,
                    $horaSalida,
                    $this->formatDuration($maxMinutes),
                );
            }

            return null;
        }

        $maxMinutes = self::DEFAULT_MAX_SHIFT_HOURS * 60;

        if ($minutes > $maxMinutes) {
            return sprintf(
                'Ese turno dura %s (de %s a %s) — en esta área un turno no puede pasar de %s (jornada ordinaria, sin horas extra). Revisa la hora de entrada/salida.',
                $this->formatDuration($minutes),
                $horaEntrada,
                $horaSalida,
                $this->formatDuration($maxMinutes),
            );
        }

        return null;
    }

    public function byArea($areaId)
    {
        $this->ensureAreaAcces($areaId);

        $calendars = calendars::where('area_id', $areaId)
            ->get([
                'id',
                'area_id',
                'hora_entrada',
                'hora_salida',
                'shift_type',

                'is_custom',
                'created_for_employee_uid',
            ]);

        return response()->json($calendars);
    }

    /**
     *
     *  Crear un turno/calendario para un area
     *
     * ==========================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|integer|exists:areas,id',
            'hora_entrada' => 'required|date_format:H:i',
            'hora_salida' => 'required|date_format:H:i|different:hora_entrada',
            'shift_type' => 'required|in:D,N',
            'is_custom' => 'sometimes|boolean',
            'created_for_employee_uid' => 'required_if:is_custom,true|nullable|string|exists:employees,uid',
        ]);

        $this->ensureAreaAcces($validated['area_id']);

        $durationError = $this->shiftDurationError($validated['area_id'], $validated['hora_entrada'], $validated['hora_salida']);
        if ($durationError !== null) {
            return response()->json(['message' => $durationError], 422);
        }

        $employeeUid = $validated['created_for_employee_uid'] ?? null;

        $duplicado = calendars::where('area_id', $validated['area_id'])
            ->where('hora_entrada', $validated['hora_entrada'])
            ->where('hora_salida', $validated['hora_salida'])
            ->where('shift_type', $validated['shift_type'])
            ->where('created_for_employee_uid', $employeeUid)
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un turno igual registrado para esta área.',
            ], 422);
        }

        $calendar = calendars::create($validated);

        return response()->json($calendar, 201);
    }

    /**
     * ==========================================
     *
     *  Editar un turno/calendario existente
     *
     * ==========================================
     */
    public function update(Request $request, calendars $calendar)
    {
        $this->ensureAreaAcces($calendar->area_id);

        $validated = $request->validate([
            'hora_entrada' => 'required|date_format:H:i',
            'hora_salida' => 'required|date_format:H:i|different:hora_entrada',
            'shift_type' => 'required|in:D,N',
        ]);

        $durationError = $this->shiftDurationError($calendar->area_id, $validated['hora_entrada'], $validated['hora_salida']);
        if ($durationError !== null) {
            return response()->json(['message' => $durationError], 422);
        }

        $duplicado = calendars::where('area_id', $calendar->area_id)
            ->where('id', '!=', $calendar->id)
            ->where('hora_entrada', $validated['hora_entrada'])
            ->where('hora_salida', $validated['hora_salida'])
            ->where('shift_type', $validated['shift_type'])
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un turno igual registrado para esta área.',
            ], 422);
        }

        $calendar->update($validated);

        return response()->json($calendar);
    }

    /**
     * ==========================================
     *
     *  Eliminar un turno/calendario
     *
     * ==========================================
     */
    public function destroy(calendars $calendar)
    {
        $this->ensureAreaAcces($calendar->area_id);

        $enUso = $calendar->programations()->exists() || $calendar->overrides()->exists();

        if ($enUso) {
            return response()->json([
                'message' => 'No se puede eliminar: este turno está siendo usado en programaciones existentes. Cancélalas o reasígnalas primero.',
            ], 422);
        }

        $calendar->delete();

        return response()->json(['success' => true]);
    }

}
