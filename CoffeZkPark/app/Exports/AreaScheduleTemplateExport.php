<?php

namespace App\Exports;

use App\Models\Employee;
use App\Models\WorkPosition;
use App\Services\OperatingCalendar;
use App\Services\WeeklyStaffingValidator;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\NamedRange;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Conditional;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Plantilla de programación para un período (por defecto un mes; desde la pantalla, Desde + Duración).
 *
 * - Área fija: una fila por empleado y una columna por día con el horario (HH:MM-HH:MM, D, VAC, INC).
 * - Área variable: una fila por puesto y una columna por día; en cada celda se elige de una lista
 *   el empleado que cubre ese puesto ese día. El horario se elige al subir el archivo. Las
 *   vacaciones e incapacidades se registran en Ausencias, no en la plantilla.
 *   La columna A (oculta) guarda el id del puesto para identificar la fila.
 */
class AreaScheduleTemplateExport implements FromArray,WithTitle,WithEvents{
    // Sección de ausencias de las plantillas de áreas variables anteriores: la importación la
    // sigue leyendo si un archivo viejo la trae.
    public const ABSENCES_MARKER = 'AUSENCIAS (VAC / INC)';
    public const CONVENTION_PREFIX = 'Convención';
    /** Turnos que se eligen en la plantilla de áreas fijas (en mayúsculas); su horario se escoge al subir el archivo. */
    public const SHIFT_NAMES = ['APERTURA', 'NORMAL', 'CIERRE'];
    /** Recordatorio del controlador de relleno de Excel para repetir un valor en varios días. */
    private const FILL_TIP = 'Para repetir un valor en varios días: selecciónelo y arrastre el cuadrito de la esquina inferior derecha de la celda hacia los otros días.';

    private bool $isVariable;
    /** @var array<int, Carbon> fecha de cada columna de día, en orden */
    private array $dates;
    private Collection $workPositions;
    /** @var array<string, array{id: int, name: string, color: string}> tipo de día (calendario operativo) por fecha */
    private array $dayTypes;
    /** @var array<int, int> day_type_id => personal mínimo de esta área (calendario operativo) */
    private array $minStaffByType;
    /** @var array<int, array{start: string, end: string}> temporada alta (abre el parque lunes/martes) */
    private array $highSeasonRanges;

    // Filas fijas de la hoja: 1 título, 2 encabezado de días y luego:
    // - área variable: 3 "Personal requerido" y desde la 4 los puestos;
    // - área fija: desde la 3 los empleados (el personal mínimo no aplica a turnos fijos).
    // La importación salta solas las filas que no traen cédula ni id de puesto en la columna A.

public function __construct(
    private Collection $employees,
    private int $year,
    private int $month,
    private string $areaName,
    private string $schedulingMode = 'fijo',
    private int $areaId = 0,
    // Período a programar (Desde + Duración de la pantalla). Sin él, el mes $year-$month completo.
    ?string $startDate = null,
    ?int $days = null,
) {
    $from = $startDate !== null ? Carbon::parse($startDate)->startOfDay() : Carbon::create($this->year, $this->month, 1);
    $count = $startDate !== null && $days !== null ? $days : $from->daysInMonth;
    $this->dates = array_map(fn ($i) => $from->copy()->addDays($i), range(0, max($count, 1) - 1));
    $this->isVariable = $this->schedulingMode === 'variable';
    // El contrato pinta cada empleado de verde (fijo) o amarillo (temporal) en la plantilla.
    if ($this->employees instanceof \Illuminate\Database\Eloquent\Collection) {
        $this->employees->loadMissing('contrato:id,name');
    }
    $this->workPositions = $this->isVariable
        ? WorkPosition::where('area_id', $this->areaId)->where('active', true)->orderBy('name')->get()
        : collect();
    $this->dayTypes = OperatingCalendar::daysInRange($this->dates[0]->toDateString(), end($this->dates)->toDateString());
    $this->minStaffByType = $this->areaId ? OperatingCalendar::minStaffForArea($this->areaId) : [];
    $this->highSeasonRanges = OperatingCalendar::highSeasonRanges();
}

/** Fila "Personal requerido" (solo áreas variables); null en áreas fijas. */
private function requiredRow(): ?int
{
    return $this->isVariable ? 3 : null;
}

/** Primera fila de puestos (variable) o empleados (fijo). */
private function firstDataRow(): int
{
    return $this->isVariable ? 4 : 3;
}

/** Fila "Personal requerido": mínimo del calendario operativo (vacío si ese día no tiene). */
private function requiredRowValues(): array
{
    $required = ['', 'Personal requerido'];
    for ($day = 1; $day <= $this->dayCount(); $day++) {
        $date = $this->dateAt($day);
        $typeId = $this->dayTypes[$date->toDateString()]['id'] ?? null;
        // Un área variable no trabaja con el parque cerrado: no se le pide personal ese día.
        $closed = OperatingCalendar::isParkClosed($date, $this->highSeasonRanges);
        $required[] = !$closed && $typeId !== null && isset($this->minStaffByType[$typeId]) ? $this->minStaffByType[$typeId] : '';
    }
    return $required;
}

// Colores por tipo de contrato (mismos tonos que la pantalla: verde = fijo, ámbar = temporal).
private const CONTRACT_COLORS = [
    'fijo' => ['fill' => 'EAF3D3', 'font' => '5E7A15'],
    'temporal' => ['fill' => 'FEF3C7', 'font' => '92400E'],
];
private const CONTRACT_LEGEND = 'Verde = contrato fijo · Amarillo = contrato temporal.';

/** Pinta una celda (o rango) con el color del contrato del empleado; sin contrato no cambia. */
private function paintByContract(Worksheet $sheet, string $range, Employee $employee): void
{
    $colors = self::CONTRACT_COLORS[WeeklyStaffingValidator::contractType($employee)] ?? null;
    if ($colors === null) {
        return;
    }
    $sheet->getStyle($range)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($colors['fill']);
    $sheet->getStyle($range)->getFont()->setBold(true)->getColor()->setRGB($colors['font']);
}

/** "Personal requerido" en negrita, centrado y con fondo gris claro (solo áreas variables). */
private function styleRequiredRow(Worksheet $sheet): void
{
    $row = $this->requiredRow();
    $lastColumn = Coordinate::stringFromColumnIndex(2 + $this->dayCount());
    $sheet->getStyle("B{$row}:{$lastColumn}{$row}")->getFont()->setBold(true);
    $sheet->getStyle("C{$row}:{$lastColumn}{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle("B{$row}:{$lastColumn}{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F9FAFB');
}

/** Texto con el que se muestra (y se elige) un empleado en la plantilla. */
public static function employeeLabel(Employee $employee): string
{
    return sprintf('%s (%s)', $employee->name, $employee->documentos);
}

public function title(): string
{
    return substr(sprintf('Plantilla %s %s', $this->areaName, $this->dates[0]->format('d-m-Y')), 0, 31);
}

private function spansMonths(): bool
{
    return $this->dates[0]->format('Y-m') !== end($this->dates)->format('Y-m');
}

private function dayCount(): int
{
    return count($this->dates);
}

/** Fecha de la columna de día número $day (1 = primera columna de días). */
private function dateAt(int $day): Carbon
{
    return $this->dates[$day - 1]->copy();
}

/**
 * Lee el rango de fechas que la plantilla lleva escrito en su título ("... del 05/10/2026 al
 * 11/10/2026"). null si es una plantilla vieja (mensual, sin rango).
 * @return array{0: Carbon, 1: Carbon}|null
 */
public static function parseRangeFromTitle(string $title): ?array
{
    if (!preg_match('#del (\d{2}/\d{2}/\d{4}) al (\d{2}/\d{2}/\d{4})#', $title, $m)) {
        return null;
    }
    return [Carbon::createFromFormat('d/m/Y', $m[1])->startOfDay(), Carbon::createFromFormat('d/m/Y', $m[2])->startOfDay()];
}

private function dayHeaders(): array
{
    $dayHeaders =[];
    for ($day = 1 ; $day <= $this->dayCount(); $day++){
        $date = $this->dateAt($day);
        $weekdayAbbrev = ucfirst($date->locale('es')->isoFormat('ddd'));
        // Con tipo de día del calendario operativo: "2 (Vie.) · B" (y la celda en su color).
        // Sin el prefijo "Calendario " para que quepa en la columna (mismo criterio que la pantalla).
        $dayType = isset($this->dayTypes[$date->toDateString()])
            ? preg_replace('/^calendario\s+/i', '', $this->dayTypes[$date->toDateString()]['name'])
            : null;
        // Si el período pasa de un mes a otro se muestra también el mes ("31/10", "1/11").
        $dayLabel = $this->spansMonths() ? $date->format('j/n') : $date->format('j');
        $header = sprintf('%s (%s)', $dayLabel, $weekdayAbbrev) . ($dayType !== null ? " · {$dayType}" : '');
        // Parque cerrado (lunes/martes fuera de temporada alta): las áreas variables descansan y
        // las fijas salen temprano — se avisa en el propio encabezado.
        if (OperatingCalendar::isParkClosed($date, $this->highSeasonRanges)) {
            $header .= $this->isVariable
                ? ' · CERRADO'
                : ' · sale ' . OperatingCalendar::closedDayExitTimes()[$date->isoWeekday()];
        }
        $dayHeaders[] = $header;
    }
    return $dayHeaders;
}

/**
 * Pinta los encabezados de día de la fila $row con el color de su tipo de día; en áreas
 * variables los días de parque cerrado van en gris oscuro (el área no trabaja).
 */
private function colorDayHeaders(Worksheet $sheet, int $row): void
{
    for ($day = 1; $day <= $this->dayCount(); $day++) {
        $date = $this->dateAt($day);
        $color = $this->isVariable && OperatingCalendar::isParkClosed($date, $this->highSeasonRanges)
            ? '#4B5563'
            : ($this->dayTypes[$date->toDateString()]['color'] ?? null);
        if ($color === null) {
            continue;
        }
        $cell = Coordinate::stringFromColumnIndex(2 + $day) . $row;
        $sheet->getStyle($cell)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(ltrim($color, '#'));
        $sheet->getStyle($cell)->getFont()->getColor()->setRGB('FFFFFF');
    }
}

// La importación lee el rango de este título (parseRangeFromTitle): no cambiar su formato.
private function titleText(): string
{
    return sprintf(
        'PROGRAMACION - %s - del %s al %s',
        $this->areaName,
        $this->dates[0]->format('d/m/Y'),
        end($this->dates)->format('d/m/Y'),
    );
}

private function emptyDays(): array
{
    return array_fill(0, $this->dayCount(), '');
}

public function array():array{
    return $this->isVariable ? $this->variableRows() : $this->fixedRows();
}

private function fixedRows(): array
{
    $rows=[];
    $rows[] = [$this->titleText()];
    $rows[] = array_merge(['Cedúla', 'Nombre'], $this->dayHeaders());
    foreach($this->employees as $employee){
        $rows[] = array_merge([$employee->documentos, $employee->name], $this->emptyDays());
    }
    $rows[] = [''];
    $rows[] = [self::CONVENTION_PREFIX . ' : Apertura / Normal / Cierre = turno (el horario de cada uno se elige al subir el archivo) . D = Descansa . VAC = vacaciones . INC = Incapacidad . ' . self::FILL_TIP . ' ' . self::CONTRACT_LEGEND];

    return $rows;
}

private function variableRows(): array
{
    $rows = [];
    $rows[] = ['', $this->titleText()];
    $rows[] = array_merge(['ID', 'Puesto'], $this->dayHeaders());
    $rows[] = $this->requiredRowValues();
    foreach ($this->workPositions as $position) {
        $label = $position->attraction ? "{$position->name} - {$position->attraction}" : $position->name;
        $rows[] = array_merge([$position->id, $label], $this->emptyDays());
    }
    $rows[] = [''];
    $rows[] = ['', self::CONVENTION_PREFIX . ' : en cada puesto elija el empleado que lo cubre ese día (el horario se elige al subir el archivo). '
        . 'Un empleado sin puesto ese día descansa (vacaciones e incapacidades se registran en Ausencias). '
        . '"Personal requerido" sale del calendario operativo. ' . self::FILL_TIP . ' '
        . 'Los días CERRADO deben quedar vacíos. ' . self::CONTRACT_LEGEND];

    return $rows;
}

 public function registerEvents():array{
    return[
        AfterSheet::class=> function (AfterSheet $event){
            $sheet = $event->sheet->getDelegate();
            $this->isVariable ? $this->styleVariable($sheet) : $this->styleFixed($sheet);
        },
    ];
 }

 private function styleFixed(Worksheet $sheet): void
 {
    $lastDataRow = $sheet->getHighestRow();
    $lastColumn = Coordinate::stringFromColumnIndex(2 + $this->dayCount());
    $sheet->mergeCells("A1:{$lastColumn}1");
    $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
    $sheet->getRowDimension(1)->setRowHeight(30);
    $sheet->getStyle("A2:{$lastColumn}2")->getFont()->setBold(true)->setSize(11);
    $this->colorDayHeaders($sheet, 2);
    foreach ($this->employees->values() as $index => $employee) {
        $row = $this->firstDataRow() + $index;
        $this->paintByContract($sheet, "A{$row}:B{$row}", $employee);
    }
    // Fija el título y los encabezados de día, sin línea vertical junto a Nombre.
    $sheet->freezePane('A' . $this->firstDataRow());

    for($col = 1; $col<= 2 + $this->dayCount(); $col++){
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth($col <= 2 ? 16 : 15);
    }
    // Encabezados de día en dos líneas ("28/9 (Lun.) · A" / "sale 13:00") para que no se corten.
    $sheet->getStyle("C2:{$lastColumn}2")->getAlignment()->setWrapText(true)
        ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
    $sheet->getRowDimension(2)->setRowHeight(32);
    $sheet->getStyle("A1:{$lastColumn}{$lastDataRow}")->getBorders()->getAllBorders()
    ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');

    $sheet->getStyle('A' . $this->firstDataRow() . ":{$lastColumn}{$lastDataRow}")->getAlignment()->setWrapText(true);
    $sheet->mergeCells("A{$lastDataRow}:{$lastColumn}{$lastDataRow}");
    $this->wrapConventionRow($sheet, $lastDataRow, 'A', 16 * 2 + 15 * $this->dayCount());

    if ($this->employees->isNotEmpty()) {
        $this->applyListValidation(
            $sheet,
            $this->dayRange($this->firstDataRow(), $this->firstDataRow() + $this->employees->count() - 1),
            '"Apertura,Normal,Cierre,D,VAC,INC"',
            'Apertura, Normal o Cierre = turno. D = descansa, VAC = vacaciones, INC = incapacidad.',
            'Selecciona Apertura, Normal, Cierre, D, VAC o INC.',
        );
    }
 }

 private function styleVariable(Worksheet $sheet): void
 {
    $dayCount = $this->dayCount();
    $lastColumn = Coordinate::stringFromColumnIndex(2 + $dayCount);
    $lastDataRow = $sheet->getHighestRow();

    $positionsHeaderRow = 2;
    $firstPositionRow = $this->firstDataRow();
    $lastPositionRow = $firstPositionRow + $this->workPositions->count() - 1;

    // Columna A oculta: id del puesto.
    $sheet->getColumnDimension('A')->setVisible(false);
    // Ancho según el texto más largo para que nombres y puestos no se desborden a la celda vecina
    // (+4 de margen para el botón de la lista desplegable).
    $longestPosition = $this->workPositions
        ->map(fn ($p) => mb_strlen($p->attraction ? "{$p->name} - {$p->attraction}" : $p->name))
        ->max() ?? 0;
    $longestEmployee = $this->employees->map(fn ($e) => mb_strlen(self::employeeLabel($e)))->max() ?? 0;
    $sheet->getColumnDimension('B')->setWidth(max(30, $longestPosition, $longestEmployee) + 4);
    for ($col = 3; $col <= 2 + $dayCount; $col++) {
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(max(18, $longestEmployee + 4));
    }

    $sheet->mergeCells("B1:{$lastColumn}1");
    $sheet->getStyle('B1')->getFont()->setBold(true)->setSize(14);
    $sheet->getRowDimension(1)->setRowHeight(30);
    // Fija encabezados y filas de resumen, sin línea vertical junto a Puesto.
    $sheet->freezePane('A' . $this->firstDataRow());
    $this->styleRequiredRow($sheet);

    $headerRow = $positionsHeaderRow;
    $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->getFont()->setBold(true);
    $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->getFill()
        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E5E7EB');
    $this->colorDayHeaders($sheet, $headerRow);

    $sheet->getStyle("A1:{$lastColumn}{$lastDataRow}")->getBorders()->getAllBorders()
        ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');
    $sheet->mergeCells("B{$lastDataRow}:{$lastColumn}{$lastDataRow}");
    $this->wrapConventionRow($sheet, $lastDataRow, 'B', max(30, $longestPosition, $longestEmployee) + 4 + max(18, $longestEmployee + 4) * $dayCount);

    if ($this->workPositions->isNotEmpty() && $this->employees->isNotEmpty()) {
        $this->addEmployeeDropdowns($sheet, $firstPositionRow, $lastPositionRow);
    }
 }

 /**
  * La fila de convención va combinada a lo ancho de la hoja: se ajusta en varias líneas y se le
  * da el alto a mano (Excel no autoajusta filas combinadas). $width = ancho total en caracteres.
  */
 private function wrapConventionRow(Worksheet $sheet, int $row, string $fromColumn, float $width): void
 {
    $text = (string) $sheet->getCell("{$fromColumn}{$row}")->getValue();
    $lines = max(1, (int) ceil(mb_strlen($text) * 1.1 / max($width, 1)));
    $sheet->getStyle("{$fromColumn}{$row}")->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
    $sheet->getRowDimension($row)->setRowHeight(15 * $lines + 4);
 }

 private function dayRange(int $firstRow, int $lastRow): string
 {
    $lastColumn = Coordinate::stringFromColumnIndex(2 + $this->dayCount());
    return "C{$firstRow}:{$lastColumn}{$lastRow}";
 }

 private function applyListValidation(Worksheet $sheet, string $range, string $formula, string $prompt, string $error): void
 {
    $validation = new DataValidation();
    $validation->setType(DataValidation::TYPE_LIST);
    $validation->setErrorStyle(DataValidation::STYLE_STOP);
    $validation->setAllowBlank(true);
    $validation->setShowInputMessage(true);
    $validation->setShowErrorMessage(true);
    $validation->setShowDropDown(true);
    $validation->setErrorTitle('Valor inválido');
    $validation->setError($error);
    $validation->setPrompt($prompt);
    $validation->setFormula1($formula);

    foreach ($sheet->rangeToArray($range, null, false, false, true) as $row => $columns) {
        foreach (array_keys($columns) as $column) {
            $sheet->getCell("{$column}{$row}")->setDataValidation(clone $validation);
        }
    }
 }

 private function addEmployeeDropdowns(Worksheet $sheet, int $firstPositionRow, int $lastPositionRow): void
 {
    // La lista vive en una hoja oculta: el usuario solo ve la hoja de la plantilla.
    $spreadsheet = $sheet->getParent();
    $hiddenSheet = $spreadsheet->createSheet();
    $hiddenSheet->setTitle('EmpleadosArea');
    // Orden alfabético sin distinguir mayúsculas: la lista filtrada de abajo asume que los
    // nombres que empiezan igual quedan seguidos.
    $labels = $this->employees->map(fn ($e) => self::employeeLabel($e))
        ->sortBy(fn ($label) => mb_strtolower($label))
        ->values();
    foreach ($labels as $index => $label) {
        $hiddenSheet->setCellValue('A' . ($index + 1), $label);
    }
    $hiddenSheet->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

    $count = $labels->count();
    $spreadsheet->addNamedRange(new NamedRange('EmpleadosLista', $hiddenSheet, "\$A\$1:\$A\${$count}"));

    // Listas de fijos (columna B) y temporales (columna C) en la misma hoja oculta: con ellas las
    // celdas de puesto se pintan solas de verde/amarillo según el empleado que se elija.
    $conditionals = [];
    foreach (['fijo' => ['B', 'FijosLista'], 'temporal' => ['C', 'TemporalesLista']] as $type => [$column, $rangeName]) {
        $typeLabels = $this->employees
            ->filter(fn ($e) => WeeklyStaffingValidator::contractType($e) === $type)
            ->map(fn ($e) => self::employeeLabel($e))
            ->values();
        if ($typeLabels->isEmpty()) {
            continue;
        }
        foreach ($typeLabels as $index => $label) {
            $hiddenSheet->setCellValue($column . ($index + 1), $label);
        }
        $spreadsheet->addNamedRange(new NamedRange($rangeName, $hiddenSheet, "\${$column}\$1:\${$column}\$" . $typeLabels->count()));

        $conditional = new Conditional();
        $conditional->setConditionType(Conditional::CONDITION_EXPRESSION)
            ->addCondition("COUNTIF({$rangeName},C{$firstPositionRow})>0");
        $conditional->getStyle()->getFill()->setFillType(Fill::FILL_SOLID)->getEndColor()->setRGB(self::CONTRACT_COLORS[$type]['fill']);
        $conditional->getStyle()->getFont()->setBold(true)->getColor()->setRGB(self::CONTRACT_COLORS[$type]['font']);
        $conditionals[] = $conditional;
    }
    if (!empty($conditionals)) {
        $sheet->getStyle($this->dayRange($firstPositionRow, $lastPositionRow))->setConditionalStyles($conditionals);
    }

    // Lista "buscable": se escriben las primeras letras en la celda, se abre la flecha y solo
    // aparecen los empleados cuyo nombre empieza así (celda vacía = todos). La fórmula toma el
    // bloque contiguo de coincidencias con MATCH + COUNTIF sobre la lista ordenada; cada celda
    // se referencia a sí misma, por eso la validación se arma celda por celda.
    $validation = new DataValidation();
    $validation->setType(DataValidation::TYPE_LIST);
    $validation->setAllowBlank(true);
    $validation->setShowDropDown(true);
    $validation->setShowInputMessage(true);
    $validation->setPromptTitle('Empleado');
    $validation->setPrompt('Escribe las primeras letras del nombre, presiona Enter, vuelve a la celda y abre la flecha: solo verás los que coinciden.');
    // Sin alerta de error: el texto a medio escribir ("Die") tiene que poder quedarse en la
    // celda para filtrar la lista. Un nombre que no exista lo rechaza la importación.
    $validation->setShowErrorMessage(false);

    foreach ($sheet->rangeToArray($this->dayRange($firstPositionRow, $lastPositionRow), null, false, false, true) as $row => $columns) {
        foreach (array_keys($columns) as $column) {
            $cell = "{$column}{$row}";
            $cellValidation = clone $validation;
            $cellValidation->setFormula1(
                // Sin coincidencias MATCH da error y la flecha no muestra nada.
                "OFFSET(EmpleadosLista,MATCH({$cell}&\"*\",EmpleadosLista,0)-1,0,COUNTIF(EmpleadosLista,{$cell}&\"*\"),1)"
            );
            $sheet->getCell($cell)->setDataValidation($cellValidation);
        }
    }
 }

}
