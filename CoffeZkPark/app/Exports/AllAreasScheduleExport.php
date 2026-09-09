<?php

namespace App\Exports;

use App\Models\area;
use App\Services\AreaScheduleQuery;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/** El respaldo de modo fijo se fuerza a 1 columna de
 * etiqueta (solo Empleado, sin UID/Contrato) para que las columnas de día de
 * TODAS las áreas calcen en la misma hoja sin importar si el área es de
 * turnos con puesto o de modo fijo.
 */
class AllAreasScheduleExport implements FromArray, WithTitle, WithEvents
{
    /** @var int[] Filas (1-based) donde empieza el bloque de cada área — título de área. */
    private array $areaTitleRows = [];

    /** @var int[] Filas (1-based) de título de atracción, de TODAS las áreas ya reubicadas. */
    private array $attractionTitleRows = [];

    /** @var array<int, int> Fila (1-based, ya reubicada) => cuántos nombres trae su celda con más. */
    private array $rowLineCounts = [];

    // "Resumen de horas por empleado" de cada área: título, encabezado y última fila con
    // datos (1-based, ya reubicados dentro de la hoja combinada). Mismo índice en los tres
    // arrays = mismo bloque de área. hoursColumns es igual para todas (mismo mes/año).
    private array $hoursTitleRows = [];
    private array $hoursHeaderRows = [];
    private array $hoursLastRows = [];
    private int $hoursColumns = 0;

    private int $lastColumnIndex = 1;

    public function __construct(
        private int $year,
        private int $month,
    ) {
    }

    public function title(): string
    {
        return substr(sprintf('Todas las áreas %02d-%d', $this->month, $this->year), 0, 31);
    }

    public function array(): array
    {
        $areas = area::orderBy('nombre')->get();

        $rows = [];
        $this->areaTitleRows = [];
        $this->attractionTitleRows = [];
        $this->rowLineCounts = [];
        $this->hoursTitleRows = [];
        $this->hoursHeaderRows = [];
        $this->hoursLastRows = [];
        $maxColumns = 1;
        $highSeasonRanges = \App\Models\CompanySetting::get('high_season_ranges', []);

        foreach ($areas as $areaModel) {
            $employees = AreaScheduleQuery::forMonth($areaModel->id, $this->year, $this->month);
            // fijoLabelColumns=1: en esta hoja combinada todas las áreas deben compartir el mismo
            // punto de partida de columnas de día, sin importar su modo de programación.
            $export = new AreaScheduleExport(
                $employees,
                $this->year,
                $this->month,
                $areaModel->nombre,
                fijoLabelColumns: 1,
                highSeasonRanges: $highSeasonRanges,
                areaId: (int) $areaModel->id,
            );
            $block = $export->buildRows();

            $maxColumns = max($maxColumns, $block['labelColumns'] + $this->daysInMonthCount());
            $this->hoursColumns = $block['hoursColumns'];

            $offset = count($rows);

            // La primera fila de cada bloque es su propio título ("Programación — Área — Mes").
            $this->areaTitleRows[] = $offset + 1;

            foreach ($block['attractionTitleRows'] as $relativeRow) {
                $this->attractionTitleRows[] = $offset + $relativeRow + 1;
            }

            foreach ($block['rowLineCounts'] as $relativeRow => $count) {
                $this->rowLineCounts[$offset + $relativeRow + 1] = $count;
            }

            $this->hoursTitleRows[] = $offset + $block['hoursTitleRow'] + 1;
            $this->hoursHeaderRows[] = $offset + $block['hoursHeaderRow'] + 1;
            $this->hoursLastRows[] = $offset + $block['hoursHeaderRow'] + $employees->count();

            foreach ($block['rows'] as $row) {
                $rows[] = $row;
            }

            // Laravel Excel (FromArray) SALTA por
            // completo cualquier fila que sea un array vacío ([]) al escribirla en la hoja —
            // no ocupa un número de fila real — lo que corría todos los cálculos de fila de
            // ahí en adelante y hacía que el negrita/fusión de la siguiente área cayera en la
            // fila equivocada
            // Con un array de una sola celda vacía SÍ se cuenta como fila real.
            $rows[] = [''];
        }

        $this->lastColumnIndex = $maxColumns;

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $lastColumn = Coordinate::stringFromColumnIndex($this->lastColumnIndex);
                $sheet = $event->sheet->getDelegate();
                $lastDataRow = $sheet->getHighestRow();

                // Anchos, alto de fila, bordes y ajuste de texto — el mismo formato generoso
                // que usa el Excel de una sola área, aplicado a toda la hoja combinada. Las
                // áreas forzaron fijoLabelColumns=1 arriba, así que siempre es 1 columna de etiqueta.
                AreaScheduleExport::applyGridFormatting($sheet, 1, $this->lastColumnIndex - 1, 1, $lastDataRow, $this->rowLineCounts);

                // Fija el encabezado de días de la PRIMERA área al hacer scroll vertical —
                // Excel solo permite fijar una única fila para toda la hoja, así que al bajar
                // a otras áreas ese encabezado deja de coincidir con sus propios días; es la
                // limitación real de freezePane con varios bloques apilados. Solo fija fila,
                // no columna (fijar columna A dejaba una línea divisoria vertical de por medio).
                $sheet->freezePane('A3');

                // Título de cada área: el más grande y marcado de los tres niveles.
                foreach ($this->areaTitleRows as $rowNumber) {
                    $sheet->mergeCells("A{$rowNumber}:{$lastColumn}{$rowNumber}");
                    $sheet->getStyle("A{$rowNumber}")->getFont()->setBold(true)->setSize(14)->getColor()->setRGB('A81C24');
                }

                // Título de cada atracción dentro de un área: un nivel debajo del área.
                foreach ($this->attractionTitleRows as $rowNumber) {
                    $sheet->mergeCells("A{$rowNumber}:{$lastColumn}{$rowNumber}");
                    $sheet->getStyle("A{$rowNumber}")->getFont()->setBold(true)->setSize(12);
                    $sheet->getStyle("A{$rowNumber}:{$lastColumn}{$rowNumber}")->getFill()
                        ->setFillType(Fill::FILL_SOLID)
                        ->getStartColor()->setRGB('EAF3D3');
                }

                // El encabezado de columnas (día por día) va justo después del título de cada
                // área: negrita para distinguirlo de las filas de datos.
                foreach ($this->areaTitleRows as $rowNumber) {
                    $headerRow = $rowNumber + 1;
                    $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->getFont()->setBold(true);
                }

                // "Resumen de horas por empleado" de cada área — mismo bloque que arma
                // AreaScheduleExport para su propia hoja, reubicado en la hoja combinada.
                foreach ($this->hoursTitleRows as $i => $titleRow) {
                    AreaScheduleExport::styleHoursSection(
                        $sheet,
                        $titleRow,
                        $this->hoursHeaderRows[$i],
                        $this->hoursColumns,
                        $this->hoursLastRows[$i],
                    );
                }
            },
        ];
    }

    private function daysInMonthCount(): int
    {
        return \Carbon\Carbon::create($this->year, $this->month, 1)->daysInMonth;
    }
}
