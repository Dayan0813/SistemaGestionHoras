<?php

namespace Database\Seeders;

use App\Models\Holidays;
use Illuminate\Database\Seeder;

class HolidaySeeder extends Seeder
{
    /**
     * Siembra los festivos colombianos (Ley 51 de 1983 / Ley Emiliani) para un rango de años
     * (el actual +/- unos cuantos) — mismo criterio que App\Support\ColombianHolidays, que
     * calcula estas mismas fechas en código para el resto del sistema (vacaciones, consolidados).
     */
    public function run(): void
    {
        $names = $this->holidayNames();

        foreach (range(now()->year - 1, now()->year + 3) as $year) {
            foreach ($this->datesForYear($year) as $dateIso => $label) {
                Holidays::firstOrCreate(
                    ['date' => $dateIso],
                    ['name' => $names[$label] ?? $label, 'is_movable' => $this->isMovable($label)],
                );
            }
        }
    }

    /** @return array<string, string> fecha ISO => etiqueta interna (para resolver el nombre) */
    private function datesForYear(int $year): array
    {
        $dates = [];

        // Fijos (no se trasladan nunca).
        $dates[\Carbon\Carbon::create($year, 1, 1)->toDateString()] = 'anio_nuevo';
        $dates[\Carbon\Carbon::create($year, 5, 1)->toDateString()] = 'trabajo';
        $dates[\Carbon\Carbon::create($year, 7, 20)->toDateString()] = 'independencia';
        $dates[\Carbon\Carbon::create($year, 8, 7)->toDateString()] = 'boyaca';
        $dates[\Carbon\Carbon::create($year, 12, 8)->toDateString()] = 'inmaculada';
        $dates[\Carbon\Carbon::create($year, 12, 25)->toDateString()] = 'navidad';

        // Ley Emiliani: se trasladan al lunes siguiente si no caen ya en lunes.
        $nextMonday = fn (\Carbon\Carbon $d) => $d->isMonday() ? $d : $d->next(\Carbon\Carbon::MONDAY);

        $dates[$nextMonday(\Carbon\Carbon::create($year, 1, 6))->toDateString()] = 'reyes';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 3, 19))->toDateString()] = 'san_jose';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 6, 29))->toDateString()] = 'san_pedro';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 8, 15))->toDateString()] = 'asuncion';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 10, 12))->toDateString()] = 'raza';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 11, 1))->toDateString()] = 'todos_santos';
        $dates[$nextMonday(\Carbon\Carbon::create($year, 11, 11))->toDateString()] = 'cartagena';

        // Basados en Semana Santa / Pascua (extensión `calendar` de PHP: easter_date()).
        $easter = \Carbon\Carbon::parse(easter_date($year))->startOfDay();
        $dates[$easter->copy()->subDays(3)->toDateString()] = 'jueves_santo';
        $dates[$easter->copy()->subDays(2)->toDateString()] = 'viernes_santo';
        $dates[$nextMonday($easter->copy()->addDays(39))->toDateString()] = 'ascension';
        $dates[$nextMonday($easter->copy()->addDays(60))->toDateString()] = 'corpus_christi';
        $dates[$nextMonday($easter->copy()->addDays(68))->toDateString()] = 'sagrado_corazon';

        return $dates;
    }

    /** @return array<string, string> etiqueta interna => nombre visible */
    private function holidayNames(): array
    {
        return [
            'anio_nuevo' => 'Año Nuevo',
            'trabajo' => 'Día del Trabajo',
            'independencia' => 'Grito de Independencia',
            'boyaca' => 'Batalla de Boyacá',
            'inmaculada' => 'Inmaculada Concepción',
            'navidad' => 'Navidad',
            'reyes' => 'Reyes Magos',
            'san_jose' => 'San José',
            'san_pedro' => 'San Pedro y San Pablo',
            'asuncion' => 'Asunción de la Virgen',
            'raza' => 'Día de la Raza',
            'todos_santos' => 'Todos los Santos',
            'cartagena' => 'Independencia de Cartagena',
            'jueves_santo' => 'Jueves Santo',
            'viernes_santo' => 'Viernes Santo',
            'ascension' => 'Ascensión del Señor',
            'corpus_christi' => 'Corpus Christi',
            'sagrado_corazon' => 'Sagrado Corazón de Jesús',
        ];
    }

    private function isMovable(string $label): bool
    {
        return !in_array($label, ['anio_nuevo', 'trabajo', 'independencia', 'boyaca', 'inmaculada', 'navidad'], true);
    }
}
