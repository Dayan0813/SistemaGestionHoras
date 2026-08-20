<?php

namespace App\Services;

use App\Models\MarkingLog;
use Carbon\Carbon;

class MarkingResolver
{
    /**
     * Devuelve la jornada trabajada de un día.
     *
     * - Si el turno es DIURNO (D): busca marcaciones hasta el mediodía del día siguiente.
     * - Si el turno es NOCTURNO (N): busca marcaciones entre 12:00 del día D y 12:00 del día D+1
     *
     * Retorna:
     * null  → si no hay suficientes marcaciones (menos de 2)
     * array → ['worked_start' => Carbon, 'worked_end' => Carbon]
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

        $start = Carbon::parse($marks->first()->timestamp);
        $end   = Carbon::parse($marks->last()->timestamp);

        if ($end->lte($start)) {
            return null;
        }

        return [
            'worked_start' => $start,
            'worked_end'   => $end,
        ];
    }
}
