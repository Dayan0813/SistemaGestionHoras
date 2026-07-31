<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use App\Models\Holidays;

class ConsolidationEngine
{
    protected ScheduleResolver $scheduleResolver;
    protected MarkingResolver  $markingResolver;

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

        $days   = [];
        $period = CarbonPeriod::create($from, $to);

        foreach ($period as $date) {
            $dateKey  = $date->toDateString();

            // Programación del día
            $schedule = $this->scheduleResolver->getDailySchedule($employeeUid, $date);

            // Jornada real de ese día (entrada/salida)
            $work = $this->markingResolver->getDailyWork($employeeUid, $date, $schedule);

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

            if ($work) {
                $this->classifyWork(
                    $schedule,
                    $work['worked_start'],
                    $work['worked_end'],
                    $dayHours
                );
            }

            $days[$dateKey] = [
                'scheduled' => $schedule,
                'sessions'  => $work ? [[
                    'worked_start' => $work['worked_start'],
                    'worked_end'   => $work['worked_end'],
                ]] : [],
                'hours'     => $dayHours,
            ];

            // Acumular totales globales
            foreach ($totals as $k => $v) {
                $totals[$k] += $dayHours[$k];
            }
        }

        return [
            'employee_uid' => $employeeUid,
            'from'         => $from->toDateString(),
            'to'           => $to->toDateString(),
            'days'         => $days,
            'totals'       => $totals,
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

        if (!$schedule) {
            $minutes = $salida->diffInMinutes($entrada);
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

        return Holidays::where('date', $date->toDateString())->exists();
    }
}
