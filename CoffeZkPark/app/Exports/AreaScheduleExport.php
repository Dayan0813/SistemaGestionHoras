<?php

namespace App\Exports;

use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

/**
 * Un empleado por fila, un día del mes por columna, con el horario efectivo
 * de ese día (respeta las excepciones puntuales en programation_overrides,
 * igual que la grilla de "Consulta por área" en el frontend). El área y el
 * mes quedan visibles como encabezado dentro del propio Excel, no solo en
 * el nombre del archivo.
 */
class AreaScheduleExport implements FromArray, ShouldAutoSize, WithTitle, WithEvents
{
    private const HEADER_ROW = 2;

    public function __construct(
        private Collection $employees,
        private int $year,
        private int $month,
        private string $areaName,
    ) {
    }

    public function title(): string
    {
        // Los nombres de hoja de Excel no pueden pasar de 31 caracteres.
        return substr(sprintf('%s %02d-%d', $this->areaName, $this->month, $this->year), 0, 31);
    }

    public function array(): array
    {
        $days = $this->daysInMonth();
        $monthLabel = ucfirst($days[0]->locale('es')->isoFormat('MMMM'));

        $rows = [];
        $rows[] = ["Programación — {$this->areaName} — {$monthLabel} {$this->year}"];
        $rows[] = array_merge(
            ['Empleado', 'UID', 'Contrato'],
            array_map(fn (Carbon $d) => $d->format('d') . ' ' . ucfirst($d->locale('es')->isoFormat('ddd')), $days)
        );

        foreach ($this->employees as $employee) {
            $row = [$employee->name, $employee->uid, $employee->contrato?->name ?? ''];

            foreach ($days as $date) {
                $row[] = $this->shiftLabelForDay($employee, $date);
            }

            $rows[] = $row;
        }

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $lastColumn = Coordinate::stringFromColumnIndex(3 + count($this->daysInMonth()));
                $sheet = $event->sheet->getDelegate();

                $sheet->mergeCells("A1:{$lastColumn}1");
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13);

                $sheet->getStyle('A' . self::HEADER_ROW . ':' . $lastColumn . self::HEADER_ROW)
                    ->getFont()->setBold(true);
            },
        ];
    }

    /** @return Carbon[] */
    private function daysInMonth(): array
    {
        $start = Carbon::create($this->year, $this->month, 1);

        return collect(range(1, $start->daysInMonth))
            ->map(fn (int $day) => $start->copy()->day($day))
            ->all();
    }

    private function shiftLabelForDay(Employee $employee, Carbon $date): string
    {
        $dateIso = $date->toDateString();

        foreach ($employee->programations as $programation) {
            if ($dateIso < $programation->start_date->toDateString() || $dateIso > $programation->end_date->toDateString()) {
                continue;
            }

            if (!empty($programation->work_days) && !in_array($date->isoWeekday(), $programation->work_days, true)) {
                continue;
            }

            $override = $programation->overrides->first(fn ($o) => $o->date === $dateIso);
            $calendar = $override?->calendar ?? $programation->calendar;

            if (!$calendar || !$calendar->hora_entrada || !$calendar->hora_salida) {
                return 'Horario no definido';
            }

            return substr($calendar->hora_entrada, 0, 5) . ' - ' . substr($calendar->hora_salida, 0, 5);
        }

        return '';
    }
}
