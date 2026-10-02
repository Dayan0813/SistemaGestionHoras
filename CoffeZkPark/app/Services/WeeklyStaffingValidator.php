<?php

namespace App\Services;

use App\Models\area;
use App\Models\Employee;
use App\Models\EmployeeAbsence;
use App\Models\Programations;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

/**
 * Reglas de dotación por tipo de contrato, aplicadas ANTES de guardar una programación
 * (plantilla Excel o borrador de la pantalla de Programaciones):
 *
 *  1. Un empleado con contrato FIJO debe sumar al menos MIN_WEEKLY_HOURS en cada semana
 *     (lunes a domingo). Los días de vacaciones/incapacidad cuentan ABSENCE_DAY_HOURS.
 *     Si la semana solo cae en parte dentro del periodo validado (p. ej. la primera o la
 *     última semana de un mes), el mínimo se prorratea a los días que sí caen dentro.
 *  2. Un empleado con contrato TEMPORAL solo puede tener turno un día en que al menos un
 *     fijo del área no esté trabajando (descansa o está ausente): los temporales cubren
 *     faltantes, no reemplazan a los fijos. Si el área no tiene fijos, no aplica. Tampoco
 *     aplica en una semana en que todos los fijos ya completan sus 42h (o trabajan los 7 días).
 *
 *  3. Cada día con tipo asignado en el calendario operativo (AA, A, B, C...) debe tener al
 *     menos el personal mínimo que el administrador definió para el área y ese tipo
 *     (ver OperatingCalendar). Cuenta a todos los empleados con turno ese día. Solo áreas
 *     variables: las de turno fijo no tienen personal mínimo.
 *
 *  4. Áreas variables (Operaciones): no se programan los días de parque cerrado (lunes y
 *     martes fuera de temporada alta, ver OperatingCalendar::isParkClosed()).
 *
 * Empleados sin contrato asignado no entran en las reglas 1 y 2, pero sí cuentan en la 3.
 *
 * La programación resultante se arma como "lo que ya hay guardado" + "lo nuevo" ($overlay),
 * igual que quedará después de guardar (la plantilla y el borrador solo agregan o
 * reemplazan días, nunca borran).
 */
class WeeklyStaffingValidator
{
    public const MIN_WEEKLY_HOURS = 42;
    // Jornada de 42h repartida en 6 días: lo que vale un día de VAC/INC para el mínimo semanal.
    public const ABSENCE_DAY_HOURS = 7;

    /**
     * @param array<string, array<string, array>> $overlay [uid][Y-m-d] => día nuevo a guardar:
     *     ['type' => 'shift', 'hora_entrada' => 'HH:MM', 'hora_salida' => 'HH:MM']
     *     o ['type' => 'vacaciones' | 'incapacidad'].
     * @return array<int, array> problemas encontrados (vacío si todo cumple), cada uno con su
     *     'message' listo para mostrar y los datos para pintarlo:
     *     ['kind' => 'fijo_hours', 'employee', 'week_start', 'week_end', 'hours', 'required']
     *     o ['kind' => 'temporal_day', 'employee', 'date']
     *     o ['kind' => 'min_staff', 'date', 'day_type', 'color', 'scheduled', 'required']
     *     o ['kind' => 'park_closed', 'employee', 'date'].
     */
    public static function validate(int $areaId, string $from, string $to, array $overlay): array
    {
        $areaModel = area::find($areaId);
        $isFixedArea = $areaModel?->scheduling_mode !== 'variable';
        $highSeasonRanges = OperatingCalendar::highSeasonRanges();

        $employees = Employee::where('area_id', $areaId)
            ->where('estado', 'Activo')
            ->with('contrato:id,name')
            ->get();
        $fijos = $employees->filter(fn ($e) => self::contractType($e) === 'fijo');
        $temporales = $employees->filter(fn ($e) => self::contractType($e) === 'temporal');
        $minStaffByType = OperatingCalendar::minStaffForArea($areaId);
        // Las áreas variables (Operaciones) siempre se validan: no trabajan con el parque cerrado.
        // Una fija sin fijos ni temporales no tiene nada que revisar (no tiene personal mínimo).
        if ($isFixedArea && $fijos->isEmpty() && $temporales->isEmpty()) {
            return [];
        }

        $days = self::buildDayMap($areaId, $from, $to, $overlay);
        $hoursOf = function (string $uid, string $dateIso) use ($days, $isFixedArea, $highSeasonRanges): float {
            $day = $days[$uid][$dateIso] ?? null;
            if ($day === null) {
                return 0.0;
            }
            if ($day['type'] !== 'shift') {
                return self::ABSENCE_DAY_HOURS;
            }

            return ShiftHours::forDay($day['hora_entrada'], $day['hora_salida'], Carbon::parse($dateIso), $isFixedArea, $highSeasonRanges);
        };

        $errors = [];

        // 1. Mínimo semanal de los fijos.
        foreach (self::weeksInRange($from, $to) as $week) {
            $required = self::MIN_WEEKLY_HOURS * count($week['dates']) / 7;
            foreach ($fijos as $fijo) {
                $total = 0.0;
                foreach ($week['dates'] as $dateIso) {
                    $total += $hoursOf($fijo->uid, $dateIso);
                }
                if ($total + 0.001 < $required) {
                    $errors[] = [
                        'kind' => 'fijo_hours',
                        'employee' => self::employeeLabel($fijo),
                        'week_start' => $week['dates'][0],
                        'week_end' => end($week['dates']),
                        'hours' => round($total, 1),
                        'required' => round($required, 1),
                        'message' => sprintf(
                            '%s (fijo): %sh programadas en %s; el mínimo es %sh.',
                            self::employeeLabel($fijo),
                            self::formatHours($total),
                            $week['label'],
                            self::formatHours($required),
                        ),
                    ];
                }
            }
        }

        // 2. Los fijos van primero: un día caben tantos temporales como fijos falten (descanso,
        // VAC, INC) más los que hagan falta para llegar al personal mínimo cuando ni con todos
        // los fijos alcanza. Solo se señalan los temporales nuevos de cada día: lo ya guardado
        // no se vuelve a cuestionar, pero sí cuenta para el cupo.
        if ($fijos->isNotEmpty()) {
            $dayTypesByDate = OperatingCalendar::daysInRange($from, $to);
            $newTemporalsByDate = [];
            foreach ($temporales as $temporal) {
                foreach ($overlay[$temporal->uid] ?? [] as $dateIso => $day) {
                    if ($day['type'] === 'shift' && $dateIso >= $from && $dateIso <= $to) {
                        $newTemporalsByDate[$dateIso][] = $temporal;
                    }
                }
            }
            ksort($newTemporalsByDate);
            $fijosCompleteByWeek = $newTemporalsByDate
                ? self::fijosCompleteByWeek($areaId, array_key_first($newTemporalsByDate), array_key_last($newTemporalsByDate), $overlay, $fijos, $isFixedArea, $highSeasonRanges)
                : [];

            foreach ($newTemporalsByDate as $dateIso => $newTemporals) {
                // Si esa semana todos los fijos ya completan sus horas (o trabajan todos los
                // días), los temporales entran libres: ya no le quitan turno a ningún fijo.
                if ($fijosCompleteByWeek[Carbon::parse($dateIso)->startOfWeek(Carbon::MONDAY)->toDateString()] ?? false) {
                    continue;
                }
                $isShift = fn ($e) => ($days[$e->uid][$dateIso]['type'] ?? null) === 'shift';
                $missingFijos = $fijos->reject($isShift)->count();
                $typeId = $dayTypesByDate[$dateIso]['id'] ?? null;
                $required = $typeId !== null ? ($minStaffByType[$typeId] ?? 0) : 0;
                $allowed = $missingFijos + max(0, $required - $fijos->count());
                $working = $temporales->filter($isShift)->count();
                if ($working <= $allowed) {
                    continue;
                }

                $reason = $allowed === 0
                    ? 'todos los fijos del área trabajan ese día' . ($required > 0 ? ' y alcanzan para el personal mínimo' : '')
                    : sprintf(
                        'ese día solo caben %d temporal(es) (%s) y hay %d',
                        $allowed,
                        implode(' + ', array_filter([
                            $missingFijos > 0 ? "{$missingFijos} por fijo(s) que faltan" : null,
                            $required > $fijos->count() ? sprintf('%d para llegar al mínimo de %d', $required - $fijos->count(), $required) : null,
                        ])),
                        $working,
                    );
                foreach (array_slice($newTemporals, -min(count($newTemporals), $working - $allowed)) as $temporal) {
                    $errors[] = [
                        'kind' => 'temporal_day',
                        'employee' => self::employeeLabel($temporal),
                        'date' => $dateIso,
                        'message' => sprintf(
                            '%s (temporal), día %s: %s; los temporales solo cubren fijos que faltan, completan el mínimo o entran cuando todos los fijos ya tienen sus 42h esa semana.',
                            self::employeeLabel($temporal),
                            $dateIso,
                            $reason,
                        ),
                    ];
                }
            }
        }

        // 4. Áreas variables (Operaciones): con el parque cerrado (lunes/martes fuera de
        // temporada alta) descansan, así que no se les puede programar turno. Solo se revisan
        // los días nuevos: lo ya guardado no se vuelve a cuestionar.
        if (!$isFixedArea) {
            $namesByUid = Employee::whereIn('uid', array_keys($overlay))->get(['uid', 'nombres', 'apellidos', 'documentos'])->keyBy('uid');
            foreach ($overlay as $uid => $daysByDate) {
                foreach ($daysByDate as $dateIso => $day) {
                    if ($day['type'] !== 'shift' || $dateIso < $from || $dateIso > $to) {
                        continue;
                    }
                    if (OperatingCalendar::isParkClosed($dateIso, $highSeasonRanges)) {
                        $label = $namesByUid->has($uid) ? self::employeeLabel($namesByUid->get($uid)) : $uid;
                        $errors[] = [
                            'kind' => 'park_closed',
                            'employee' => $label,
                            'date' => $dateIso,
                            'message' => sprintf('%s, día %s: el parque está cerrado (lunes/martes fuera de temporada alta); el área no trabaja ese día.', $label, $dateIso),
                        ];
                    }
                }
            }
        }

        // 3. Personal mínimo según el tipo de día del calendario operativo (solo áreas variables:
        // las fijas no tienen mínimo guardado).
        if (!empty($minStaffByType)) {
            foreach (OperatingCalendar::daysInRange($from, $to) as $dateIso => $dayType) {
                $required = $minStaffByType[$dayType['id']] ?? 0;
                // Con el parque cerrado el área no trabaja (regla 4): no se le exige mínimo.
                if ($required === 0 || OperatingCalendar::isParkClosed($dateIso, $highSeasonRanges)) {
                    continue;
                }
                $scheduled = 0;
                foreach ($days as $daysByDate) {
                    if (($daysByDate[$dateIso]['type'] ?? null) === 'shift') {
                        $scheduled++;
                    }
                }
                if ($scheduled < $required) {
                    $errors[] = [
                        'kind' => 'min_staff',
                        'date' => $dateIso,
                        'day_type' => $dayType['name'],
                        'color' => $dayType['color'],
                        'scheduled' => $scheduled,
                        'required' => $required,
                        'message' => sprintf(
                            'Día %s (%s): %d persona(s) programada(s); el mínimo del área es %d.',
                            $dateIso,
                            preg_match('/^calendario\b/i',$dayType['name']) ? $dayType['name'] : "calendario {$dayType['name']}",
                            $scheduled,
                            $required,
                        ),
                    ];
                }
            }
        }

        return $errors;
    }

    /** "Nombre (cédula)": hay empleados con el mismo nombre en un área. */
    private static function employeeLabel(Employee $employee): string
    {
        return $employee->documentos ? "{$employee->name} ({$employee->documentos})" : $employee->name;
    }

    /** 'fijo', 'temporal' o null según el nombre del contrato del empleado. */
    public static function contractType(Employee $employee): ?string
    {
        $name = mb_strtolower((string) $employee->contrato?->name);
        if (str_contains($name, 'temporal')) {
            return 'temporal';
        }
        if (str_contains($name, 'fijo')) {
            return 'fijo';
        }

        return null;
    }

    /**
     * Lunes (Y-m-d) => true si esa semana completa (lunes a domingo) todos los fijos ya cumplen:
     * suman al menos MIN_WEEKLY_HOURS o tienen turno los 7 días. Mira la semana entera, no solo
     * el rango validado, con lo guardado más $overlay.
     *
     * @return array<string, bool>
     */
    private static function fijosCompleteByWeek(int $areaId, string $from, string $to, array $overlay, $fijos, bool $isFixedArea, array $highSeasonRanges): array
    {
        $weekFrom = Carbon::parse($from)->startOfWeek(Carbon::MONDAY);
        $weekTo = Carbon::parse($to)->endOfWeek(Carbon::SUNDAY);
        $days = self::buildDayMap($areaId, $weekFrom->toDateString(), $weekTo->toDateString(), $overlay);

        $result = [];
        for ($monday = $weekFrom->copy(); $monday->lte($weekTo); $monday->addWeek()) {
            $dates = array_map(fn ($i) => $monday->copy()->addDays($i)->toDateString(), range(0, 6));
            $result[$monday->toDateString()] = $fijos->every(function ($fijo) use ($dates, $days, $isFixedArea, $highSeasonRanges) {
                $hours = 0.0;
                $shiftDays = 0;
                foreach ($dates as $dateIso) {
                    $day = $days[$fijo->uid][$dateIso] ?? null;
                    if ($day === null) {
                        continue;
                    }
                    if ($day['type'] === 'shift') {
                        $shiftDays++;
                        $hours += ShiftHours::forDay($day['hora_entrada'], $day['hora_salida'], Carbon::parse($dateIso), $isFixedArea, $highSeasonRanges);
                    } else {
                        $hours += self::ABSENCE_DAY_HOURS;
                    }
                }
                return $shiftDays === 7 || $hours + 0.001 >= self::MIN_WEEKLY_HOURS;
            });
        }
        return $result;
    }

    /**
     * [uid][Y-m-d] => día efectivo (turno o ausencia) en [$from, $to]: lo guardado en la base
     * de datos, con $overlay encima.
     */
    private static function buildDayMap(int $areaId, string $from, string $to, array $overlay): array
    {
        $map = [];

        $programations = Programations::where('area_id', $areaId)
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $to)
            ->where('end_date', '>=', $from)
            ->with([
                'calendar:id,hora_entrada,hora_salida',
                'overrides' => fn ($q) => $q->whereBetween('date', [$from, $to])->with('calendar:id,hora_entrada,hora_salida'),
            ])
            ->get();

        foreach ($programations as $programation) {
            $overridesByDate = $programation->overrides->keyBy(fn ($o) => Carbon::parse($o->date)->toDateString());
            $start = max($from, $programation->start_date->toDateString());
            $end = min($to, $programation->end_date->toDateString());
            foreach (CarbonPeriod::create($start, $end) as $date) {
                $dateIso = $date->toDateString();
                if (isset($map[$programation->employee_uid][$dateIso])) {
                    continue; // la primera programación que calce gana (mismo criterio que la exportación).
                }
                if (!empty($programation->work_days) && !in_array($date->isoWeekday(), $programation->work_days, true)) {
                    continue;
                }
                $calendar = $overridesByDate->get($dateIso)?->calendar ?? $programation->calendar;
                $map[$programation->employee_uid][$dateIso] = [
                    'type' => 'shift',
                    'hora_entrada' => $calendar?->hora_entrada,
                    'hora_salida' => $calendar?->hora_salida,
                ];
            }
        }

        $absences = EmployeeAbsence::where('area_id', $areaId)
            ->where('status', 'Activa')
            ->whereNotNull('start_date')
            ->where('start_date', '<=', $to)
            ->where('end_date', '>=', $from)
            ->get();
        foreach ($absences as $absence) {
            $start = max($from, $absence->start_date->toDateString());
            $end = min($to, $absence->end_date->toDateString());
            foreach (CarbonPeriod::create($start, $end) as $date) {
                $map[$absence->employee_uid][$date->toDateString()] = ['type' => $absence->type];
            }
        }

        foreach ($overlay as $uid => $daysByDate) {
            foreach ($daysByDate as $dateIso => $day) {
                $map[$uid][$dateIso] = $day;
            }
        }

        return $map;
    }

    /**
     * Semanas lunes-domingo que tocan [$from, $to], cada una con solo sus días dentro del rango.
     *
     * @return array<int, array{label: string, dates: string[]}>
     */
    private static function weeksInRange(string $from, string $to): array
    {
        $weeks = [];
        foreach (CarbonPeriod::create($from, $to) as $date) {
            $monday = $date->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            $weeks[$monday]['dates'][] = $date->toDateString();
        }

        foreach ($weeks as $monday => &$week) {
            $first = Carbon::parse($week['dates'][0])->locale('es');
            $last = Carbon::parse(end($week['dates']))->locale('es');
            $week['label'] = sprintf('la semana del %s al %s', $first->isoFormat('D MMM'), $last->isoFormat('D MMM'));
        }
        unset($week);

        return array_values($weeks);
    }

    private static function formatHours(float $hours): string
    {
        return rtrim(rtrim(number_format($hours, 1, '.', ''), '0'), '.');
    }
}
