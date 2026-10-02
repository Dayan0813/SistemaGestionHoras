<?php

namespace App\Services;

use App\Models\CompanySetting;
use App\Models\DayTypeStaffing;
use App\Models\OperatingDay;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Lectura del calendario operativo (tipo de día de cada fecha y personal mínimo por área),
 * compartida por la pantalla, la plantilla Excel y WeeklyStaffingValidator.
 */
class OperatingCalendar
{
    /**
     * Y-m-d => ['id', 'name', 'color'] de cada fecha con tipo asignado en [$from, $to].
     *
     * @return array<string, array{id: int, name: string, color: string}>
     */
    public static function daysInRange(string $from, string $to): array
    {
        return OperatingDay::whereBetween('date', [$from, $to])
            ->with('dayType:id,name,color')
            ->get()
            ->mapWithKeys(fn (OperatingDay $day) => [
                substr((string) $day->date, 0, 10) => [
                    'id' => $day->dayType->id,
                    'name' => $day->dayType->name,
                    'color' => $day->dayType->color,
                ],
            ])
            ->all();
    }

    private const HIGH_SEASON_CACHE_KEY = 'operating_calendar:high_season_ranges';

    // Hora de salida de las áreas de jornada fija los días de parque cerrado, por día de la
    // semana (isoWeekday => 'HH:MM'). Configurable por el administrador en el calendario
    // operativo (CompanySetting 'park_closed_exit_times').
    private const CLOSED_EXIT_SETTING = 'park_closed_exit_times';
    public const DEFAULT_CLOSED_EXIT_TIMES = [1 => '13:00', 2 => '16:00'];

    /**
     * El parque cierra los lunes y martes, salvo en temporada alta (días cuyo tipo está marcado
     * como temporada alta). Esos días las áreas fijas salen temprano (closedDayExitTimes()) y
     * las áreas variables (Operaciones) descansan.
     *
     * @param array<int, array{start: string, end: string}>|null $highSeasonRanges para no
     *     recalcularlos en bucles; null = se leen de highSeasonRanges().
     */
    public static function isParkClosed(Carbon|string $date, ?array $highSeasonRanges = null): bool
    {
        $date = $date instanceof Carbon ? $date : Carbon::parse($date);
        if (!array_key_exists($date->isoWeekday(), self::closedDayExitTimes())) {
            return false;
        }

        return !ShiftHours::isHighSeasonDate($date, $highSeasonRanges ?? self::highSeasonRanges());
    }

    /** @return array<int, string> isoWeekday (1 = lunes, 2 = martes) => hora de salida 'HH:MM' */
    public static function closedDayExitTimes(): array
    {
        $saved = CompanySetting::get(self::CLOSED_EXIT_SETTING, []);

        $times = [];
        foreach (self::DEFAULT_CLOSED_EXIT_TIMES as $weekday => $default) {
            $times[$weekday] = $saved[$weekday] ?? $saved[(string) $weekday] ?? $default;
        }

        return $times;
    }

    /** @param array<int, string> $times isoWeekday => 'HH:MM' */
    public static function saveClosedDayExitTimes(array $times): void
    {
        CompanySetting::set(self::CLOSED_EXIT_SETTING, $times);
    }

    /**
     * Temporada alta = los días cuyo tipo está marcado como temporada alta, agrupados en
     * rangos contiguos [{start, end}] (Y-m-d). Mismo formato que antes tenían los rangos
     * configurados a mano, así ShiftHours, el validador semanal, los exports y el frontend
     * siguen funcionando igual. Cacheado: se lee en cada request (HandleInertiaRequests);
     * forgetHighSeasonCache() lo invalida al cambiar el calendario o los tipos.
     *
     * @return array<int, array{start: string, end: string}>
     */
    public static function highSeasonRanges(): array
    {
        return Cache::rememberForever(self::HIGH_SEASON_CACHE_KEY, function () {
            $dates = OperatingDay::whereHas('dayType', fn ($q) => $q->where('is_high_season', true))
                ->orderBy('date')
                ->pluck('date')
                ->map(fn ($date) => substr((string) $date, 0, 10));

            $ranges = [];
            foreach ($dates as $date) {
                $last = count($ranges) - 1;
                if ($last >= 0 && Carbon::parse($ranges[$last]['end'])->addDay()->toDateString() === $date) {
                    $ranges[$last]['end'] = $date;
                } else {
                    $ranges[] = ['start' => $date, 'end' => $date];
                }
            }

            return $ranges;
        });
    }

    public static function forgetHighSeasonCache(): void
    {
        Cache::forget(self::HIGH_SEASON_CACHE_KEY);
    }

    /**
     * day_type_id => personal mínimo del área (solo tipos con mínimo definido). Solo las áreas
     * variables (Operaciones) tienen mínimo: OperatingCalendarController::saveStaffing() no deja
     * guardarlo para áreas de turno fijo.
     *
     * @return array<int, int>
     */
    public static function minStaffForArea(int $areaId): array
    {
        return DayTypeStaffing::where('area_id', $areaId)->pluck('min_staff', 'day_type_id')->all();
    }
}
