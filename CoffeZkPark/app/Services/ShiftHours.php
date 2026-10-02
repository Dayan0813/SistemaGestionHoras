<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Horas efectivas de un turno en un día concreto. Única fuente en el backend del cálculo que
 * usan la exportación a Excel (AreaScheduleExport) y la validación de horas semanales
 * (WeeklyStaffingValidator); en el frontend el equivalente es shiftHours() +
 * applyFixedAreaCutoff() de programaciones.helpers.ts.
 */
class ShiftHours
{
    // Política SOLO para áreas de jornada fija: los días de parque cerrado (lunes y martes fuera
    // de temporada alta, ver OperatingCalendar::isParkClosed()) se sale a la hora configurada
    // por el administrador (por defecto lunes 1:00 pm, martes 4:00 pm), sin importar el turno
    // asignado — las horas se cuentan solo hasta ese tope (no se cambia el turno guardado).

    /**
     * Duración del turno en horas. Un turno nocturno que cruza medianoche cuenta completo en
     * el día en que empieza.
     */
    public static function duration(?string $horaEntrada, ?string $horaSalida): float
    {
        if (!$horaEntrada || !$horaSalida) {
            return 0.0;
        }

        $minutes = self::toMinutes($horaSalida) - self::toMinutes($horaEntrada);
        if ($minutes <= 0) {
            $minutes += 24 * 60;
        }

        return $minutes / 60;
    }

    /**
     * Horas efectivas ese día: la duración del turno, recortada en áreas de jornada fija los
     * días de parque cerrado (lunes/martes fuera de temporada alta) a la hora de salida
     * configurada.
     *
     * @param array<int, array{start?: string, end?: string}> $highSeasonRanges rangos Y-m-d
     */
    public static function forDay(?string $horaEntrada, ?string $horaSalida, Carbon $date, bool $isFixedArea, array $highSeasonRanges = []): float
    {
        $hours = self::duration($horaEntrada, $horaSalida);

        if (!$isFixedArea || !$horaEntrada || !OperatingCalendar::isParkClosed($date, $highSeasonRanges)) {
            return $hours;
        }

        $cutoffMinutes = self::toMinutes(OperatingCalendar::closedDayExitTimes()[$date->isoWeekday()]);

        $entradaMinutes = self::toMinutes($horaEntrada);
        if ($entradaMinutes >= $cutoffMinutes) {
            return $hours; // turno nocturno u otro caso raro: no recortar a negativo.
        }

        return min($hours * 60, $cutoffMinutes - $entradaMinutes) / 60;
    }

    /** true si $date cae dentro de algún rango [start,end] marcado como temporada alta. */
    public static function isHighSeasonDate(Carbon $date, array $highSeasonRanges): bool
    {
        $dateIso = $date->toDateString();
        foreach ($highSeasonRanges as $range) {
            if (($range['start'] ?? null) !== null && ($range['end'] ?? null) !== null && $dateIso >= $range['start'] && $dateIso <= $range['end']) {
                return true;
            }
        }

        return false;
    }

    private static function toMinutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }
}
