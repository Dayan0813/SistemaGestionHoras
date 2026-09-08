<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Programations;
use App\Models\ProgramationOverride;
use App\Models\calendars;
use App\Models\area;
use App\Models\MarkingLog;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;

class AlertasController extends Controller
{
    /**
     * Datos para la pantalla de Alertas.
     *
     * Las alertas se calculan contra las marcaciones reales guardadas
     * por la sincronización del huellero en marking_logs.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $startDate = Carbon::parse(
            $request->query('start_date', now()->toDateString())
        )->startOfDay();

        $endDate = Carbon::parse(
            $request->query('end_date', now()->toDateString())
        )->endOfDay();

        if ($endDate->lt($startDate)) {
            [$startDate, $endDate] = [$endDate->copy()->startOfDay(), $startDate->copy()->endOfDay()];
        }

        // Evita consultas accidentales de varios meses desde esta pantalla.
        if ($startDate->diffInDays($endDate) > 62) {
            return response()->json([
                'success' => false,
                'message' => 'El rango máximo para consultar alertas es de 63 días.',
            ], 422);
        }

        $areaId = $request->query('area_id');
        $search = trim((string) $request->query('search', ''));

        // Coordinadores y auxiliares de TH solamente pueden consultar su área.
        if ($user->hasRole('coordinator') || $user->hasRole('aux_admin_th')) {
            $areaId = $user->employee?->area_id;

            if (!$areaId) {
                abort(403, 'Usuario sin área asignada.');
            }
        }

        $programations = Programations::query()
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $endDate->toDateString())
            ->where('end_date', '>=', $startDate->toDateString())
            ->when($areaId, fn ($query) => $query->where('area_id', $areaId))
            ->when($search !== '', function ($query) use ($search) {
                $query->whereHas('employee', function ($employeeQuery) use ($search) {
                    $employeeQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('uid', 'like', "%{$search}%")
                        ->orWhere('userid', 'like', "%{$search}%");
                });
            })
            ->with([
                'employee',
                'area',
                'calendar',
                'overrides.calendar',
            ])
            ->orderBy('employee_uid')
            ->get();

        $alerts = [];

        foreach ($programations as $programation) {
            if (!$programation->employee) {
                continue;
            }

            $employee = $programation->employee;

            $rangeStart = Carbon::parse($programation->start_date)->startOfDay()->max($startDate->copy()->startOfDay());
            $rangeEnd = Carbon::parse($programation->end_date)->endOfDay()->min($endDate->copy()->endOfDay());

            if ($rangeStart->gt($rangeEnd)) {
                continue;
            }

            foreach (CarbonPeriod::create($rangeStart->copy()->startOfDay(), $rangeEnd->copy()->startOfDay()) as $date) {
                $day = $date->copy()->startOfDay();

                // Nunca genera alertas de días futuros.
                if ($day->gt(now()->startOfDay())) {
                    continue;
                }

                $calendar = $this->calendarForDate($programation, $day);

                if (!$calendar || !$calendar->hora_entrada || !$calendar->hora_salida) {
                    continue;
                }

                $entry = Carbon::parse($day->toDateString() . ' ' . $calendar->hora_entrada);
                $exit = Carbon::parse($day->toDateString() . ' ' . $calendar->hora_salida);

                // Turno nocturno: la salida ocurre al día siguiente.
                if ($calendar->shift_type === 'N' || $exit->lte($entry)) {
                    $exit->addDay();
                }

                // Buscamos las marcaciones reales del huellero alrededor del turno.
                $markings = MarkingLog::query()
                    ->where('empleado_uid', $employee->uid)
                    ->whereBetween('timestamp', [
                        $entry->copy()->subHours(4),
                        $exit->copy()->addHours(4),
                    ])
                    ->orderBy('timestamp')
                    ->get();

                $first = $markings->first();
                $last = $markings->last();

                $firstTime = $first ? Carbon::parse($first->timestamp) : null;
                $lastTime = $last ? Carbon::parse($last->timestamp) : null;

                $base = [
                    'employee_uid' => $employee->uid,
                    'name' => $employee->name,
                    'area_id' => $programation->area_id,
                    'area_name' => $programation->area?->nombre,
                    'date' => $day->toDateString(),
                    'programmed_entry' => $entry->format('H:i'),
                    'programmed_exit' => $exit->format('H:i'),
                    'marking_entry' => $firstTime?->format('H:i'),
                    'marking_exit' => $lastTime?->format('H:i'),
                ];

                // =====================================================
                // 1. SIN NINGUNA MARCACIÓN -> INASISTENCIA
                // =====================================================
                if (!$firstTime) {
                    $absenceThreshold = $entry->copy()->addMinutes(15);

                    if (now()->gte($absenceThreshold)) {
                        $alerts[] = array_merge($base, [
                            'id' => $this->alertId('inasistencia', $employee->uid, $day),
                            'type' => 'inasistencia',
                            'time' => $absenceThreshold->format('H:i'),
                            'text' => 'estaba programado para asistir en el turno ' .
                                $entry->format('H:i') . '–' . $exit->format('H:i') .
                                ' y no registra ninguna marcación de entrada en el huellero.',
                            'action' => 'Contactar supervisor',
                        ]);
                    }

                    continue;
                }

                // =====================================================
                // 2. ENTRADA TARDE
                // =====================================================
                if ($firstTime->gt($entry)) {
                    $minutesLate = $entry->diffInMinutes($firstTime);

                    if ($minutesLate > 0) {
                        $alerts[] = array_merge($base, [
                            'id' => $this->alertId('tardanza', $employee->uid, $day),
                            'type' => 'tardanza',
                            'time' => $firstTime->format('H:i'),
                            'minutes_late' => $minutesLate,
                            'text' => 'registró entrada a las ' . $firstTime->format('H:i') .
                                ' con ' . $minutesLate .
                                ' minutos de retraso respecto al turno programado (' .
                                $entry->format('H:i') . ').',
                            'action' => 'Ver detalle',
                        ]);
                    }
                }

                // =====================================================
                // 3. FALTA DE SALIDA
                // =====================================================
                $exitThreshold = $exit->copy()->addMinutes(15);

                // Si solo existe una marcación y ya venció el turno,
                // la consideramos entrada sin salida.
                if ($markings->count() === 1 && now()->gte($exitThreshold)) {
                    $alerts[] = array_merge($base, [
                        'id' => $this->alertId('salida', $employee->uid, $day),
                        'type' => 'salida',
                        'time' => $exitThreshold->format('H:i'),
                        'text' => 'no ha marcado su salida. El turno finalizó a las ' .
                            $exit->format('H:i') .
                            ' y la última marcación registrada fue a las ' .
                            $firstTime->format('H:i') . '.',
                        'action' => 'Notificar al empleado',
                    ]);
                }
            }
        }

        usort($alerts, function (array $a, array $b) {
            return strcmp(
                $b['date'] . ' ' . $b['time'],
                $a['date'] . ' ' . $a['time']
            );
        });

        $areasQuery = area::query()->orderBy('nombre');

        if ($user->hasRole('coordinator') || $user->hasRole('aux_admin_th')) {
            $areasQuery->where('id', $user->employee?->area_id);
        }

        return response()->json([
            'success' => true,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'alerts' => $alerts,
            'count' => count($alerts),
            'pending' => count($alerts),
            'areas' => $areasQuery->get(['id', 'nombre']),
        ]);
    }

    private function calendarForDate(Programations $programation, Carbon $date): ?calendars
    {
        $override = $programation->overrides->first(function ($item) use ($date) {
            return Carbon::parse($item->date)->isSameDay($date);
        });

        return $override?->calendar ?: $programation->calendar;
    }

    private function alertId(string $type, string $employeeUid, Carbon $date): string
    {
        return $type . '-' . $employeeUid . '-' . $date->toDateString();
    }
}
    