<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use App\Models\EmployeeAbsence;
use App\Models\Holidays;

class ConsolidationEngine
{
    protected ScheduleResolver $scheduleResolver;
    protected MarkingResolver  $markingResolver;

    // Evita repetir la misma consulta de festivos para la misma fecha: sin esto,
    // classifyWork() la dispara una vez por cada minuto trabajado (cientos de
    // consultas idénticas por turno).
    protected array $holidayCache = [];

    public function __construct(
        ScheduleResolver $scheduleResolver,
        MarkingResolver  $markingResolver,
    ) {
        $this->scheduleResolver = $scheduleResolver;
        $this->markingResolver  = $markingResolver;
    }

    public function consolidate(string $employeeUid, Carbon $from, Carbon $to): array
    {
        $totals = [
            'ordinary_day'            => 0.0,
            'ordinary_night'          => 0.0,
            'ordinary_festive_day'    => 0.0,
            'ordinary_festive_night'  => 0.0,
            'extra_day'               => 0.0,
            'extra_night'             => 0.0,
            'extra_festive_day'       => 0.0,
            'extra_festive_night'     => 0.0,
            'unplanned'               => 0.0,
        ];

        // Total de horas PROGRAMADAS (suma de la duración de cada turno asignado, día por
        // día) — independiente de `totals`, que es lo realmente MARCADO. Sirve para comparar
        // "lo que se programó" contra "lo que se trabajó" en el mismo rango.
        $scheduledHours = 0.0;

        // Rangos [start_date, end_date] de las ausencias ACTIVAS del empleado que se solapan
        // con el periodo consolidado — una sola query para todo el rango (no una por día).
        // Programations ya queda "recortada" cuando se registra una ausencia sin reemplazo
        // (ver EmployeeAbsenceController::hideEmployeeDays()), así que scheduleResolver ya no
        // devuelve turno esos días; pero una marcación biométrica real ese mismo día (el
        // empleado marcó por error, o el dispositivo lo siguió registrando) no depende de
        // Programations, y sin este chequeo se contaba igual como horas "no programadas".
        $absenceRanges = EmployeeAbsence::where('employee_uid', $employeeUid)
            ->where('status', 'Activa')
            ->whereNotNull('start_date')
            ->where('start_date', '<=', $to)
            ->where('end_date', '>=', $from)
            ->get(['start_date', 'end_date'])
            ->map(fn ($a) => [$a->start_date->toDateString(), $a->end_date->toDateString()]);

        $isAbsentOn = function (string $dateKey) use ($absenceRanges): bool {
            foreach ($absenceRanges as [$start, $end]) {
                if ($dateKey >= $start && $dateKey <= $end) {
                    return true;
                }
            }
            return false;
        };

        $days   = [];
        $period = CarbonPeriod::create($from, $to);

        foreach ($period as $date) {
            $dateKey  = $date->toDateString();

            // Inicializar horas diarias
            $dayHours = [
                'ordinary_day'            => 0.0,
                'ordinary_night'          => 0.0,
                'ordinary_festive_day'    => 0.0,
                'ordinary_festive_night'  => 0.0,
                'extra_day'               => 0.0,
                'extra_night'             => 0.0,
                'extra_festive_day'       => 0.0,
                'extra_festive_night'     => 0.0,
                'unplanned'               => 0.0,
            ];

            if ($isAbsentOn($dateKey)) {
                // Día de vacaciones/incapacidad activa: no cuenta como programado ni como
                // trabajado, sin importar lo que diga el biométrico ese día.
                $days[$dateKey] = [
                    'scheduled'        => null,
                    'scheduled_hours'  => 0.0,
                    'sessions'         => [],
                    'hours'            => $dayHours,
                    'absent'           => true,
                ];
                continue;
            }

            // Programación del día
            $schedule = $this->scheduleResolver->getDailySchedule($employeeUid, $date);

            // Duración del turno programado ese día (0 si no tiene turno) — mismo criterio de
            // horas que shiftHours() en el frontend: la salida ya viene ajustada +1 día si el
            // turno es nocturno (ver ScheduleResolver::getDailySchedule).
            $dayScheduledHours = $schedule
                ? $schedule['scheduled_start']->diffInMinutes($schedule['scheduled_end'], true) / 60
                : 0.0;
            $scheduledHours += $dayScheduledHours;

            // Sesiones (entrada/salida) realmente trabajadas ese día. Puede
            // haber más de una (ej. salida a almuerzo y regreso).
            $sessions = $this->markingResolver->getDailyWork($employeeUid, $date, $schedule);

            foreach ($sessions ?? [] as $session) {
                $this->classifyWork(
                    $schedule,
                    $session['worked_start'],
                    $session['worked_end'],
                    $dayHours
                );
            }

            $days[$dateKey] = [
                'scheduled'        => $schedule,
                'scheduled_hours'  => round($dayScheduledHours, 2),
                'sessions'         => $sessions ?? [],
                'hours'            => $dayHours,
            ];

            // Acumular totales globales
            foreach ($totals as $k => $v) {
                $totals[$k] += $dayHours[$k];
            }
        }

        return [
            'employee_uid'     => $employeeUid,
            'from'             => $from->toDateString(),
            'to'               => $to->toDateString(),
            'days'             => $days,
            'totals'           => $totals,
            'scheduled_hours'  => round($scheduledHours, 2),
        ];
    }

    /**
     * Clasificación minuto a minuto con reglas de Ley 2025.
     */
    protected function classifyWork(
        ?array $schedule,
        Carbon $entrada,
        Carbon $salida,
        array  &$hours
    ): void {

        // Si NO hay programación → todo es NO PROGRAMADO
        // (absolute=true explícito: en Carbon 3 diffInMinutes ya no es
        // absoluto por defecto, así que sin esto el resultado sale negativo)

        if (!$schedule) {
            $minutes = $entrada->diffInMinutes($salida, true);
            $hours['unplanned'] += $minutes / 60;
            return;
        }

        $progStart = $schedule['scheduled_start'];
        $progEnd   = $schedule['scheduled_end'];

        $cursor = $entrada->copy();

        while ($cursor->lt($salida)) {

            $next = $cursor->copy()->addMinute();

            /** 1. ¿Está dentro del turno programado? */
            $inside = $cursor->gte($progStart) && $cursor->lt($progEnd);

            /** 2. ¿Es festivo? (domingo o tabla holidays) */
            $isFestive = $this->isHoliday($cursor);

            /** 3. Clasificación día/noche según reforma laboral */
            $hour  = (int) $cursor->format('H');
            $isNight = ($hour >= 19 || $hour < 6);

            /** 
             * REGLA ESPECIAL 03:00–06:00  
             * Solo se aplica CUANDO ESTÁ FUERA DEL TURNO.  
             */
            $isNightExtraByLaw = (!$inside && $hour >= 3 && $hour < 6);

            $bucket = null;

            /** =====================================================
             *  ORDINARIAS  → siempre si está dentro del horario
             * ===================================================== */
            if ($inside) {

                if ($isFestive) {
                    $bucket = $isNight ? 'ordinary_festive_night' : 'ordinary_festive_day';
                } else {
                    $bucket = $isNight ? 'ordinary_night' : 'ordinary_day';
                }
            } else {

                /** =====================================================
                 *  EXTRAS  → fuera del horario programado
                 * ===================================================== */

                // EXTRA AUTOMÁTICA (03–06)
                if ($isNightExtraByLaw) {
                    $bucket = $isFestive ? 'extra_festive_night' : 'extra_night';
                }

                // EXTRA NORMAL (día/noche/festivo)
                else {
                    if ($isFestive) {
                        $bucket = $isNight ? 'extra_festive_night' : 'extra_festive_day';
                    } else {
                        $bucket = $isNight ? 'extra_night' : 'extra_day';
                    }
                }
            }

            /** Sumar 1 minuto convertido a horas */
            if ($bucket) {
                $hours[$bucket] += (1 / 60);
            }

            $cursor = $next;
        }
    }


    /**
     * Festivo = domingo o está en tabla holidays
     */
    public function isHoliday(Carbon $date): bool
    {
        if ($date->isSunday()) {
            return true;
        }

        $key = $date->toDateString();

        if (!array_key_exists($key, $this->holidayCache)) {
            $this->holidayCache[$key] = Holidays::where('date', $key)->exists();
        }

        return $this->holidayCache[$key];
    }
}
