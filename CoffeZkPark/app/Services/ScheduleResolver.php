<?php

namespace App\Services;

use App\Models\ProgramationOverride;
use App\Models\Programations;
use Carbon\Carbon;

class ScheduleResolver
{
    public function getDailySchedule(string $employeeUid, Carbon $date): ?array
    {
        $isoWeekday = $date->isoWeekday();

        // No filtrar por work_days en SQL: es una columna JSON, y una fila
        // con work_days=null significa "todos los días del rango" (mismo
        // criterio que coveredDates() en ProgramationsController y coversDay()
        // en el frontend). Se trae candidatas por rango de fecha y se filtra
        // en PHP la primera cuyo patrón de días realmente cubra esta fecha.
        $programation = Programations::with('calendar')
            ->where('employee_uid', $employeeUid)
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->orderByDesc('id')
            ->get()
            ->first(fn ($p) => empty($p->work_days) || in_array($isoWeekday, $p->work_days, true));

        // Si no hay programacion activa -> No hay Turnno

        if (!$programation || !$programation->calendar) {
            return null;
        }

        // Agregamos nueva logica para que lea los overrides diarios

        $override = ProgramationOverride::with('calendar')
            ->where('programation_id', $programation->id)
            ->where('date', $date->toDateString())
            ->first();

        // Si hay override, usamos ese calendario

        $calendar = $override?->calendar ?? $programation->calendar;

        // Turno mal configurado
        if (!$calendar->hora_entrada || !$calendar->hora_salida) {
            return null;
        }

        $scheduleStart = Carbon::parse($date->toDateString() . ' ' . $calendar->hora_entrada);
        $scheduleEnd   = Carbon::parse($date->toDateString() . ' ' . $calendar->hora_salida);

        // Si la salida es menor que la entrada → turno nocturno (pasa al día siguiente)
        if ($scheduleEnd->lt($scheduleStart)) {
            $scheduleEnd->addDay();
            $shiftType = 'N';
        } else {
            $shiftType = $calendar->shift_type ?? 'D';
        }

        return [
            'scheduled_start' => $scheduleStart,
            'scheduled_end'   => $scheduleEnd,
            'shift_type'      => $shiftType,
            'calendar'        => $calendar,
            'programation'    => $programation,
        ];
    }
}
