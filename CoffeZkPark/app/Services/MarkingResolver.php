<?php

namespace App\Services;

use App\Models\MarkingLog;
use Carbon\Carbon;

class MarkingResolver
{
    /**
     * Devuelve las jornadas (sesiones entrada/salida) trabajadas en un día.
     *
     * - Si el turno es DIURNO (D): busca marcaciones hasta el mediodía del día siguiente.
     * - Si el turno es NOCTURNO (N): busca marcaciones entre 12:00 del día D y 12:00 del día D+1
     *
     * Las marcaciones del huellero no traen un indicador confiable de
     * entrada/salida (el campo "state" del dispositivo llega constante en
     * los datos reales), así que se emparejan por orden cronológico: marca 1-2
     * es una sesión, 3-4 otra, etc. Antes se tomaba solo la primera y la
     * última marca del día, así que una salida a almuerzo y regreso (4 marcas)
     * quedaba contada como una sola jornada continua, incluyendo el almuerzo
     * como tiempo trabajado.
     *
     * Si el número de marcas es impar, la última queda sin pareja (p. ej. se
     * olvidó marcar la salida) y se descarta esa sesión: no hay forma de saber
     * hasta cuándo trabajó.
     *
     * Retorna:
     * null  → si no hay ninguna sesión completa (menos de 2 marcas, o marcas sin pareja válida)
     * array → lista de sesiones ['worked_start' => Carbon, 'worked_end' => Carbon]
     */
    public function getDailyWork(string $employeeUid, Carbon $date, ?array $schedule = null): ?array
    {
        // Si NO hay programación: solo buscar marcas estrictamente dentro del mismo día
        if (!$schedule) {
            $startWindow = $date->copy()->startOfDay();           // 00:00
            $endWindow   = $date->copy()->endOfDay();             // 23:59:59
        } else {
            $isNocturnal = ($schedule['shift_type'] ?? 'D') === 'N';

            if ($isNocturnal) {
                // Turno nocturno: 12:00 del día D → 12:00 del día D+1
                $startWindow = $date->copy()->setTime(12, 0, 0);
                $endWindow   = $date->copy()->addDay()->setTime(12, 0, 0);
            } else {
                // Turno diurno: 00:00 del día D → 06:00 del día D+1
                $startWindow = $date->copy()->startOfDay();
                $endWindow   = $date->copy()->addDay()->setTime(6, 0, 0);
            }
        }

        // Buscar marcas
        $marks = MarkingLog::where('empleado_uid', $employeeUid)
            ->whereBetween('timestamp', [$startWindow, $endWindow])
            ->orderBy('timestamp')
            ->get();

        if ($marks->count() < 2) {
            return null;
        }

        $sessions = [];

        for ($i = 0; $i + 1 < $marks->count(); $i += 2) {
            $start = Carbon::parse($marks[$i]->timestamp);
            $end   = Carbon::parse($marks[$i + 1]->timestamp);

            if ($end->gt($start)) {
                $sessions[] = [
                    'worked_start' => $start,
                    'worked_end'   => $end,
                ];
            }
        }

        return $sessions ?: null;
    }
}
