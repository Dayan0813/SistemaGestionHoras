<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

/**
 * Una fila por registro de work_consolidations (empleado + semana), con el desglose de
 * horas ordinarias/extra/nocturnas/festivas — mismo criterio de columnas que
 * WorkConsolidationController::indexPage() usa para armar $hours en el frontend.
 */
class WorkConsolidationExport implements FromArray, WithTitle, WithEvents
{
    private const HEADER_ROW = 2;

    public function __construct(
        private Collection $records,
        private string $rangeLabel,
    ) {
    }

    public function title(): string
    {
        return substr('Consolidado ' . $this->rangeLabel, 0, 31);
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = ["Consolidado de horas — {$this->rangeLabel}"];
        $rows[] = [
            'Empleado',
            'Semana inicio',
            'Semana fin',
            'Horas programadas',
            'Ordinaria diurna',
            'Ordinaria nocturna',
            'Ordinaria festiva diurna',
            'Ordinaria festiva nocturna',
            'Extra diurna',
            'Extra nocturna',
            'Extra festiva diurna',
            'Extra festiva nocturna',
            'No programado',
            'Total horas',
            'Diferencia vs. programado',
        ];

        foreach ($this->records as $record) {
            $hours = [
                'ordinary_day'           => (float) $record->ordinary_day,
                'ordinary_night'         => (float) $record->ordinary_night,
                'ordinary_festive_day'   => (float) $record->ordinary_festive_day,
                'ordinary_festive_night' => (float) $record->ordinary_festive_night,
                'extra_day'              => (float) $record->extra_day,
                'extra_night'            => (float) $record->extra_night,
                'extra_festive_day'      => (float) $record->extra_festive_day,
                'extra_festive_night'    => (float) $record->extra_festive_night,
                'unplanned'              => (float) $record->unplanned,
            ];

            $totalHours = array_sum($hours) - $hours['unplanned'];

            $rows[] = [
                $record->employee?->name ?? $record->employee_uid,
                $record->week_start,
                $record->week_end,
                round((float) $record->scheduled_hours, 2),
                round($hours['ordinary_day'], 2),
                round($hours['ordinary_night'], 2),
                round($hours['ordinary_festive_day'], 2),
                round($hours['ordinary_festive_night'], 2),
                round($hours['extra_day'], 2),
                round($hours['extra_night'], 2),
                round($hours['extra_festive_day'], 2),
                round($hours['extra_festive_night'], 2),
                round($hours['unplanned'], 2),
                round($totalHours, 2),
                round($totalHours - (float) $record->scheduled_hours, 2),
            ];
        }

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $lastColumnIndex = 15;
                $lastColumn = Coordinate::stringFromColumnIndex($lastColumnIndex);
                $lastRow = $sheet->getHighestRow();

                $sheet->mergeCells("A1:{$lastColumn}1");
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
                $sheet->getRowDimension(1)->setRowHeight(30);

                $sheet->getStyle('A' . self::HEADER_ROW . ':' . $lastColumn . self::HEADER_ROW)
                    ->getFont()->setBold(true)->setSize(11);

                $sheet->freezePane('A' . (self::HEADER_ROW + 1));

                for ($col = 1; $col <= $lastColumnIndex; $col++) {
                    $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(20);
                }

                $range = "A" . self::HEADER_ROW . ":{$lastColumn}{$lastRow}";
                $sheet->getStyle($range)->getFont()->setSize(11);
                $sheet->getStyle($range)->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');
                $sheet->getStyle('D' . (self::HEADER_ROW + 1) . ":{$lastColumn}{$lastRow}")
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            },
        ];
    }
}
