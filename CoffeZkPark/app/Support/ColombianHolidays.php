<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Festivos oficiales de Colombia (Ley 51 de 1983 y Ley 35 de 1991 — "Ley Emiliani"). Puerto
 * directo del mismo algoritmo ya usado en el frontend
 * (resources/js/pages/Programations/colombianHolidays.ts) — mismos 18 festivos, mismo criterio
 * de traslado al lunes siguiente. Se mantienen sincronizados a mano: cualquier cambio en uno
 * debe reflejarse en el otro.
 */
class ColombianHolidays
{
    /** @var array<int, array<string, bool>> */
    private static array $cache = [];

    public static function isHoliday(string $dayISO): bool
    {
        $year = (int) substr($dayISO, 0, 4);
        if (!isset(self::$cache[$year])) {
            self::$cache[$year] = self::forYear($year);
        }

        return isset(self::$cache[$year][$dayISO]);
    }

    public static function isBusinessDay(string $dayISO): bool
    {
        $date = Carbon::parse($dayISO);

        return !$date->isWeekend() && !self::isHoliday($dayISO);
    }

    /** @return array<string, bool> */
    private static function forYear(int $year): array
    {
        $holidays = [];
        $set = function (Carbon $d) use (&$holidays) {
            $holidays[$d->toDateString()] = true;
        };
        $nextMonday = fn (Carbon $d) => $d->isMonday() ? $d : $d->next(Carbon::MONDAY);

        // Fijos (no se trasladan).
        $set(Carbon::create($year, 1, 1));   // Año Nuevo
        $set(Carbon::create($year, 5, 1));   // Día del Trabajo
        $set(Carbon::create($year, 7, 20));  // Grito de Independencia
        $set(Carbon::create($year, 8, 7));   // Batalla de Boyacá
        $set(Carbon::create($year, 12, 8));  // Inmaculada Concepción
        $set(Carbon::create($year, 12, 25)); // Navidad

        // Ley Emiliani: se trasladan al lunes siguiente.
        $set($nextMonday(Carbon::create($year, 1, 6)));   // Reyes Magos
        $set($nextMonday(Carbon::create($year, 3, 19)));  // San José
        $set($nextMonday(Carbon::create($year, 6, 29)));  // San Pedro y San Pablo
        $set($nextMonday(Carbon::create($year, 8, 15)));  // Asunción de la Virgen
        $set($nextMonday(Carbon::create($year, 10, 12))); // Día de la Raza
        $set($nextMonday(Carbon::create($year, 11, 1)));  // Todos los Santos
        $set($nextMonday(Carbon::create($year, 11, 11))); // Independencia de Cartagena

        // Basados en Semana Santa / Pascua (extensión `calendar` de PHP: easter_date()).
        $easter = Carbon::parse(easter_date($year))->startOfDay();
        $set($easter->copy()->subDays(3));               // Jueves Santo
        $set($easter->copy()->subDays(2));               // Viernes Santo
        $set($nextMonday($easter->copy()->addDays(39))); // Ascensión del Señor
        $set($nextMonday($easter->copy()->addDays(60))); // Corpus Christi
        $set($nextMonday($easter->copy()->addDays(68))); // Sagrado Corazón de Jesús

        return $holidays;
    }
}
