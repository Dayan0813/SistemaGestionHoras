<?php

namespace App\Exports;

use App\Models\Employee;
use App\Models\EmployeeAbsence;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Una fila por puesto de trabajo (agrupado bajo una fila de título por
 * atracción), un día del mes por columna, con los nombres de los empleados
 * que cubren ese puesto ese día (sin horario — mismo criterio de agrupación
 * que la grilla "Consulta por área" del frontend, que muestra atracción +
 * puesto por fila y empleado por celda). Respeta las excepciones puntuales
 * en programation_overrides. Si el área no tiene puestos configurados (modo
 * fijo), cae a una fila por empleado con su horario, como antes.
 */
class AreaScheduleExport implements FromArray, WithTitle, WithEvents
{
    private const HEADER_ROW = 2;

    /** @var int[] Filas de la hoja (1-based) que son título de atracción — se les da negrita/tamaño después. */
    private array $attractionTitleRows = [];

    /** @var array<int, int> Fila de la hoja (1-based) => cuántos nombres trae su celda con más, para la altura. */
    private array $rowLineCounts = [];

    // Cuántas columnas de "etiqueta" hay antes de los días: 1 (Atracción/Puesto) en modo
    // variable, 3 (Empleado/UID/Contrato) en el respaldo de modo fijo.
    private int $labelColumns = 1;

    // Filas (1-based) del bloque "Resumen de horas por empleado": título y encabezado.
    private int $hoursTitleRow = 0;
    private int $hoursHeaderRow = 0;

    // Cuántas columnas ocupa el resumen de horas (Empleado + una columna "Sem. N" por cada
    // semana calendario) — casi siempre más ancho que la grilla principal, así que se
    // estiliza con su propio último-columna.
    private int $hoursColumns = 0;

    public function __construct(
        private Collection $employees,
        private int $year,
        private int $month,
        private string $areaName,
        // En el respaldo de modo fijo (sin puestos configurados), cuántas columnas de etiqueta
        // usar: 3 (Empleado/UID/Contrato) para el Excel de una sola área, 1 (solo Empleado) para
        // que las columnas de día calcen con el resto cuando varias áreas comparten una hoja
        // (ver AllAreasScheduleExport, que siempre fuerza 1).
        private int $fijoLabelColumns = 3,
        // Rangos de fechas [{start,end}] (Y-m-d) marcados globalmente como temporada alta: dentro
        // de esos rangos NO aplica el recorte de lunes/martes de hoursForEmployeeDay().
        private array $highSeasonRanges = [],
        // Opcional: si se pasa, se agrega una fila extra por tipo de ausencia
        // (Vacaciones/Incapacidad) con los nombres de los empleados ausentes ese día — ver
        // buildAbsenceRows(). null cuando no aplica (ej. el llamador no tiene el área todavía).
        private ?int $areaId = null,
    ) {
    }

    public function title(): string
    {
        // Los nombres de hoja de Excel no pueden pasar de 31 caracteres.
        return substr(sprintf('%s %02d-%d', $this->areaName, $this->month, $this->year), 0, 31);
    }

    public function array(): array
    {
        $built = $this->buildRows();
        // buildRows() da índices 0-based relativos a $rows; en una hoja propia, el bloque
        // empieza en la fila 1, así que la fila absoluta (1-based) es el índice + 1.
        $this->attractionTitleRows = array_map(fn (int $i) => $i + 1, $built['attractionTitleRows']);
        $this->rowLineCounts = [];
        foreach ($built['rowLineCounts'] as $relativeRow => $count) {
            $this->rowLineCounts[$relativeRow + 1] = $count;
        }
        $this->labelColumns = $built['labelColumns'];
        $this->hoursTitleRow = $built['hoursTitleRow'] + 1;
        $this->hoursHeaderRow = $built['hoursHeaderRow'] + 1;
        $this->hoursColumns = $built['hoursColumns'];

        return $built['rows'];
    }

    /**
     * Arma las filas de esta área sola (título + encabezado + atracciones/puestos o el
     * respaldo por empleado), sin tocar ningún estado de instancia relativo a NÚMERO de fila
     * en la hoja — eso lo calcula quien use este bloque (esta misma clase para una hoja propia,
     * o AllAreasScheduleExport cuando lo apila junto con otras áreas). $attractionTitleRows
     * viene en índices 0-based RELATIVOS a $rows.
     */
    public function buildRows(): array
    {
        $days = $this->daysInMonth();
        $monthLabel = ucfirst($days[0]->locale('es')->isoFormat('MMMM'));
        $dayHeaders = array_map(fn (Carbon $d) => $d->format('d') . ' ' . ucfirst($d->locale('es')->isoFormat('ddd')), $days);

        $grid = $this->buildPositionGrid($days);

        $rows = [];
        $attractionTitleRows = [];
        // Fila (0-based, relativa a $rows) => cuántos nombres trae la celda con MÁS nombres
        // de esa fila (separados por ", ") — para darle a esa fila más alto que a una con
        // pocos o ningún nombre, en vez de una altura fija que corta el texto o deja huecos.
        $rowLineCounts = [];
        $rows[] = ["Programación — {$this->areaName} — {$monthLabel} {$this->year}"];

        if (!empty($grid)) {
            $labelColumns = 1;
            $rows[] = array_merge(['Atracción / Puesto'], $dayHeaders);

            foreach ($grid as $attraction => $positions) {
                // 0-based: índice de la fila que estamos a punto de agregar dentro de $rows.
                $attractionTitleRows[] = count($rows);
                $rows[] = [$attraction];

                foreach ($positions as $positionName => $cellsByDate) {
                    $row = [$positionName];
                    foreach ($days as $date) {
                        // 'X' marca el día sin nadie asignado a este puesto (en vez de dejarlo
                        // en blanco, que se confundía con "no revisado todavía").
                        $row[] = $cellsByDate[$date->toDateString()] ?? 'X';
                    }
                    $rowLineCounts[count($rows)] = $this->maxNamesInRow($cellsByDate);
                    $rows[] = $row;
                }
            }
        } else {
            // Sin puestos configurados (modo fijo): una fila por TURNO (igual criterio que
            // modo variable, que agrupa por puesto), no por empleado — así el nombre del
            // empleado ya no ocupa la primera columna de cada fila, sino que aparece dentro
            // de la celda del día, junto con los demás que comparten ese turno ese día.
            $labelColumns = 1;
            $rows[] = array_merge(['Turno'], $dayHeaders);

            $fixedGrid = $this->buildFixedModeGrid($days);
            foreach ($fixedGrid as $shiftLabel => $cellsByDate) {
                $row = [$shiftLabel];
                foreach ($days as $date) {
                    $row[] = $cellsByDate[$date->toDateString()] ?? 'X';
                }
                $rowLineCounts[count($rows)] = $this->maxNamesInRow($cellsByDate);
                $rows[] = $row;
            }
        }

        // Filas extra "Vacaciones"/"Incapacidad" con el nombre del empleado ausente en cada
        // día que duró su ausencia — el ausente ya no aparece cubriendo turno esos días (su
        // Programations fue recortada por EmployeeAbsenceController::store()), así que sin
        // esto no quedaría ningún rastro de por qué falta en la grilla de arriba.
        if ($this->areaId !== null) {
            $absenceGrid = $this->buildAbsenceGrid($days);
            foreach ($absenceGrid as $typeLabel => $cellsByDate) {
                $row = [$typeLabel];
                foreach ($days as $date) {
                    $row[] = $cellsByDate[$date->toDateString()] ?? '';
                }
                $rowLineCounts[count($rows)] = $this->maxNamesInRow($cellsByDate);
                $rows[] = $row;
            }
        }

        // Resumen de horas por empleado: solo el total de cada semana calendario del mes —
        // sin desglose día por día ni total del mes (lo que se controla legalmente es la
        // jornada semanal, no la mensual). Solo se listan las semanas que realmente tienen
        // algo programado — si no, salían todas las semanas del mes calendario (incluidas
        // semanas vacías) aunque solo se hubiera programado una.
        $isFijoArea = empty($grid);
        $allWeekGroups = $this->weekGroups($days);
        $weekGroups = array_values(array_filter($allWeekGroups, function (array $dayIndexes) use ($days, $isFijoArea) {
            foreach ($dayIndexes as $dayIndex) {
                foreach ($this->employees as $employee) {
                    if ($this->hoursForEmployeeDay($employee, $days[$dayIndex], $isFijoArea) > 0) {
                        return true;
                    }
                }
            }

            return false;
        }));

        $rows[] = ['']; // separador — OJO: [] vacío se salta al escribir la hoja, usar [''].
        $hoursTitleRow = count($rows);
        $rows[] = ['Resumen de horas por empleado'];

        $hoursHeaderRow = count($rows);
        $hoursHeader = ['Empleado'];
        foreach (array_keys($weekGroups) as $weekIndex) {
            $hoursHeader[] = 'Sem. ' . ($weekIndex + 1);
        }
        $rows[] = $hoursHeader;

        foreach ($this->employees as $employee) {
            $row = [$employee->name];
            foreach ($weekGroups as $dayIndexes) {
                $weekTotal = 0.0;
                foreach ($dayIndexes as $dayIndex) {
                    $weekTotal += $this->hoursForEmployeeDay($employee, $days[$dayIndex], $isFijoArea);
                }
                $row[] = round($weekTotal, 1);
            }
            $rows[] = $row;
        }

        $hoursColumns = 1 + count($weekGroups);

        return [
            'rows' => $rows,
            'attractionTitleRows' => $attractionTitleRows,
            'rowLineCounts' => $rowLineCounts,
            'labelColumns' => $labelColumns,
            'hoursTitleRow' => $hoursTitleRow,
            'hoursHeaderRow' => $hoursHeaderRow,
            'hoursColumns' => $hoursColumns,
        ];
    }

    /**
     * De las celdas de una fila (fecha ISO => "Nombre 1, Nombre 2, ..."), cuántos nombres
     * trae la celda con más — sirve para calcular cuánto alto necesita esa fila para que el
     * texto envuelto (wrap) no quede cortado.
     *
     * @param array<string, string> $cellsByDate
     */
    private function maxNamesInRow(array $cellsByDate): int
    {
        $max = 0;
        foreach ($cellsByDate as $cell) {
            if ($cell === '') {
                continue;
            }
            $count = count(array_filter(array_map('trim', explode(',', $cell))));
            $max = max($max, $count);
        }

        return $max;
    }

    /**
     * Agrupa los índices (0-based, en el mismo orden que $days) de cada semana calendario
     * (lunes a domingo, ISO) del mes — para las columnas "Sem. N" del resumen de horas.
     *
     * @param Carbon[] $days
     * @return array<int, int[]> semana ISO => índices de $days que caen en ella, en orden.
     */
    private function weekGroups(array $days): array
    {
        $groups = [];
        foreach ($days as $index => $date) {
            $groups[$date->weekOfYear][] = $index;
        }

        return array_values($groups);
    }

    // Política de la empresa SOLO para áreas de jornada fija: el lunes se trabaja máximo hasta
    // el medio día y el martes hasta las 4:00pm, sin importar el turno asignado — si el turno
    // termina después de ese tope ese día puntual, las horas se cuentan solo hasta el tope (no
    // se cambia el turno guardado, solo el cálculo de horas efectivas). Mismo criterio que
    // AreaScheduleGrid.tsx.
    private const FIXED_AREA_MONDAY_CUTOFF_MINUTES = 12 * 60;
    private const FIXED_AREA_TUESDAY_CUTOFF_MINUTES = 16 * 60;

    /**
     * true si $date cae dentro de algún rango [start,end] marcado como temporada alta.
     */
    private function isHighSeasonDate(Carbon $date): bool
    {
        $dateIso = $date->toDateString();
        foreach ($this->highSeasonRanges as $range) {
            if (($range['start'] ?? null) !== null && ($range['end'] ?? null) !== null && $dateIso >= $range['start'] && $dateIso <= $range['end']) {
                return true;
            }
        }

        return false;
    }

    /**
     * Horas que dura el turno efectivo de un empleado en una fecha concreta (0 si no
     * trabaja ese día). Un turno nocturno que cruza medianoche cuenta completo en el día
     * en que empieza — mismo criterio que shiftHours() en AreaScheduleGrid.tsx. $isFijoArea
     * indica si el área NO tiene puestos configurados (modo fijo), lo que activa el tope de
     * lunes/martes.
     */
    private function hoursForEmployeeDay(Employee $employee, Carbon $date, bool $isFijoArea = false): float
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
            $hours = $this->shiftHoursDecimal($calendar);

            if (!$isFijoArea || !$calendar || !$calendar->hora_entrada) {
                return $hours;
            }

            // En temporada alta esta política de horario corto no aplica — se trabaja normal.
            if ($this->isHighSeasonDate($date)) {
                return $hours;
            }

            $cutoffMinutes = match ($date->isoWeekday()) {
                1 => self::FIXED_AREA_MONDAY_CUTOFF_MINUTES,
                2 => self::FIXED_AREA_TUESDAY_CUTOFF_MINUTES,
                default => null,
            };
            if ($cutoffMinutes === null) {
                return $hours;
            }

            [$inH, $inM] = array_map('intval', explode(':', $calendar->hora_entrada));
            $entradaMinutes = $inH * 60 + $inM;
            if ($entradaMinutes >= $cutoffMinutes) {
                return $hours; // turno nocturno u otro caso raro: no recortar a negativo.
            }

            return min($hours * 60, $cutoffMinutes - $entradaMinutes) / 60;
        }

        return 0.0;
    }

    private function shiftHoursDecimal($calendar): float
    {
        if (!$calendar || !$calendar->hora_entrada || !$calendar->hora_salida) {
            return 0.0;
        }

        [$inH, $inM] = array_map('intval', explode(':', $calendar->hora_entrada));
        [$outH, $outM] = array_map('intval', explode(':', $calendar->hora_salida));
        $minutes = ($outH * 60 + $outM) - ($inH * 60 + $inM);
        if ($minutes <= 0) {
            $minutes += 24 * 60;
        }

        return $minutes / 60;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $dayColumns = count($this->daysInMonth());
                $sheet = $event->sheet->getDelegate();
                $lastDataRow = $sheet->getHighestRow();

                // Anchos, alto de fila, bordes y ajuste de texto — deja la hoja generosa y
                // organizada como una grilla real en vez de todo apretado/junto.
                self::applyGridFormatting($sheet, $this->labelColumns, $dayColumns, 1, $lastDataRow, $this->rowLineCounts);

                $lastColumn = Coordinate::stringFromColumnIndex($this->labelColumns + $dayColumns);

                $sheet->mergeCells("A1:{$lastColumn}1");
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
                $sheet->getRowDimension(1)->setRowHeight(30);

                $sheet->getStyle('A' . self::HEADER_ROW . ':' . $lastColumn . self::HEADER_ROW)
                    ->getFont()->setBold(true)->setSize(11);

                // Fija el encabezado de días al hacer scroll vertical, para no perder de
                // vista qué día es cada columna en una hoja larga — solo la fila, no la
                // columna (fijar columna A dejaba una línea divisoria vertical de por medio).
                $sheet->freezePane('A' . (self::HEADER_ROW + 1));

                // Cada fila de atracción se ve como un título propio: mergeada de punta a
                // punta, en negrita y más grande que los puestos que trae debajo.
                foreach ($this->attractionTitleRows as $rowNumber) {
                    $sheet->mergeCells("A{$rowNumber}:{$lastColumn}{$rowNumber}");
                    $sheet->getStyle("A{$rowNumber}")->getFont()->setBold(true)->setSize(12);
                    $sheet->getStyle("A{$rowNumber}:{$lastColumn}{$rowNumber}")->getFill()
                        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('EAF3D3');
                }

                self::styleHoursSection($sheet, $this->hoursTitleRow, $this->hoursHeaderRow, $this->hoursColumns, $lastDataRow);
            },
        ];
    }

    /**
     * Formato del bloque "Resumen de horas por empleado" (título, encabezado, bordes/ancho
     * de sus propias columnas) — usado tanto por esta clase para una hoja propia como por
     * AllAreasScheduleExport para cada bloque de área en la hoja combinada.
     */
    public static function styleHoursSection($sheet, int $titleRow, int $headerRow, int $columns, int $lastDataRow): void
    {
        if ($titleRow === 0 || $columns === 0) {
            return;
        }

        $lastColumn = Coordinate::stringFromColumnIndex($columns);

        $sheet->mergeCells("A{$titleRow}:{$lastColumn}{$titleRow}");
        $sheet->getStyle("A{$titleRow}")->getFont()->setBold(true)->setSize(12);
        $sheet->getStyle("A{$titleRow}:{$lastColumn}{$titleRow}")->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('FCE8E9');

        $sheet->getStyle("A{$headerRow}:{$lastColumn}{$headerRow}")->getFont()->setBold(true);

        // Mismo ancho uniforme que el resto de la hoja (applyGridFormatting) — estas columnas
        // comparten letra con las de la grilla principal, así que deben coincidir.
        for ($col = 1; $col <= $columns; $col++) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(30);
        }

        $range = "A{$headerRow}:{$lastColumn}{$lastDataRow}";
        $sheet->getStyle($range)->getFont()->setSize(11);
        $sheet->getStyle($range)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');
        $sheet->getStyle("B" . ($headerRow + 1) . ":{$lastColumn}{$lastDataRow}")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER);
    }

    // Alto (puntos) que ocupa cada línea de texto envuelto dentro de una celda con fuente 11,
    // y alto mínimo/base para una fila sin (o con pocos) nombres — valores empíricos para que
    // el wrap no quede cortado ni la fila se vea exageradamente alta de más.
    private const ROW_LINE_HEIGHT = 15;
    private const ROW_BASE_HEIGHT = 24;

    /**
     * Formato compartido de la grilla (columnas anchas, filas altas, bordes finos, texto
     * envuelto y centrado verticalmente) — lo usa esta clase para una hoja propia y
     * AllAreasScheduleExport para cada bloque de área dentro de la hoja combinada, así el
     * Excel se ve igual de organizado en los dos casos.
     *
     * @param array<int, int> $rowLineCounts Fila (1-based) => cuántos nombres trae su celda
     * con más, para darle más alto a las filas con varios empleados en una misma celda y que
     * el texto envuelto (wrap) no quede cortado. Filas ausentes usan el alto base.
     */
    public static function applyGridFormatting($sheet, int $labelColumns, int $dayColumns, int $firstRow, int $lastRow, array $rowLineCounts = []): void
    {
        $lastColumnIndex = $labelColumns + $dayColumns;
        $lastColumn = Coordinate::stringFromColumnIndex($lastColumnIndex);

        // Mismo ancho para todas las columnas (etiqueta y días) — evita que UID u otras
        // columnas angostas se vean amontonadas junto a columnas más anchas.
        for ($col = 1; $col <= $lastColumnIndex; $col++) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(30);
        }

        $range = "A{$firstRow}:{$lastColumn}{$lastRow}";

        $sheet->getStyle($range)->getFont()->setSize(11);
        for ($row = $firstRow; $row <= $lastRow; $row++) {
            $lineCount = $rowLineCounts[$row] ?? 0;
            $height = max(self::ROW_BASE_HEIGHT, $lineCount * self::ROW_LINE_HEIGHT);
            $sheet->getRowDimension($row)->setRowHeight($height);
        }

        $sheet->getStyle($range)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');
        $sheet->getStyle($range)->getAlignment()
            ->setWrapText(true)->setVertical(Alignment::VERTICAL_CENTER);
    }

    /** @return Carbon[] */
    private function daysInMonth(): array
    {
        $start = Carbon::create($this->year, $this->month, 1);

        return collect(range(1, $start->daysInMonth))
            ->map(fn (int $day) => $start->copy()->day($day))
            ->all();
    }

    /**
     * atracción => [puesto => [fecha ISO => "Nombre 1, Nombre 2"]], ordenado
     * alfabéticamente por atracción y por puesto. Vacío si el área no tiene
     * puestos configurados (modo fijo).
     *
     * @param Carbon[] $days
     */
    private function buildPositionGrid(array $days): array
    {
        $grid = [];

        foreach ($this->employees as $employee) {
            foreach ($employee->programations as $programation) {
                foreach ($days as $date) {
                    $dateIso = $date->toDateString();

                    if ($dateIso < $programation->start_date->toDateString() || $dateIso > $programation->end_date->toDateString()) {
                        continue;
                    }

                    if (!empty($programation->work_days) && !in_array($date->isoWeekday(), $programation->work_days, true)) {
                        continue;
                    }

                    $override = $programation->overrides->first(fn ($o) => $o->date === $dateIso);
                    $workPosition = ($override && $override->work_position_id !== null) ? $override->workPosition : $programation->workPosition;

                    if (!$workPosition) {
                        continue;
                    }

                    $isAbsenceReplacement = str_starts_with((string) $programation->group_code, 'absence:');
                    $grid[$workPosition->attraction][$workPosition->name][$dateIso][] = $isAbsenceReplacement
                        ? "{$employee->name} (reemplazo)"
                        : $employee->name;
                }
            }
        }

        ksort($grid);
        foreach ($grid as &$positions) {
            ksort($positions);
            foreach ($positions as &$cellsByDate) {
                foreach ($cellsByDate as &$names) {
                    $names = implode(', ', $names);
                }
            }
        }
        unset($positions, $cellsByDate, $names);

        return $grid;
    }

    /**
     * Modo fijo (sin puestos configurados): agrupa por TURNO (horario) en vez de por
     * empleado, igual criterio que buildPositionGrid() agrupa por puesto en modo variable.
     * Cada celda [turno][fecha] trae los nombres de los empleados que tienen ese turno ese
     * día, separados por coma — así el nombre deja de ocupar su propia fila/columna y pasa a
     * vivir dentro de la celda del día, como en la hoja de modo variable.
     *
     * @return array<string, array<string, string>> etiqueta de turno => fecha ISO => nombres
     */
    private function buildFixedModeGrid(array $days): array
    {
        $grid = [];

        foreach ($this->employees as $employee) {
            foreach ($days as $date) {
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

                    $shiftLabel = ($calendar && $calendar->hora_entrada && $calendar->hora_salida)
                        ? substr($calendar->hora_entrada, 0, 5) . ' - ' . substr($calendar->hora_salida, 0, 5)
                        : 'Horario no definido';

                    $isAbsenceReplacement = str_starts_with((string) $programation->group_code, 'absence:');
                    $grid[$shiftLabel][$dateIso][] = $isAbsenceReplacement
                        ? "{$employee->name} (reemplazo)"
                        : $employee->name;

                    // Un empleado no debería tener dos programaciones vigentes el mismo día,
                    // pero por si acaso, la primera que calce gana y se deja de buscar.
                    break;
                }
            }
        }

        ksort($grid);
        foreach ($grid as &$cellsByDate) {
            ksort($cellsByDate);
            foreach ($cellsByDate as &$names) {
                $names = implode(', ', $names);
            }
        }
        unset($cellsByDate, $names);

        return $grid;
    }

    /**
     * "Vacaciones" / "Incapacidad" => [fecha ISO => "Nombre 1, Nombre 2"] con los empleados
     * del área que estuvieron ausentes ese día — para dejar constancia en el Excel de por qué
     * esos empleados ya no aparecen cubriendo turno esos días (su Programations original fue
     * recortada al registrar la ausencia, ver EmployeeAbsenceController::hideEmployeeDays()).
     * Solo ausencias con status "Activa": una cancelada ya no aplicó de verdad.
     *
     * @param Carbon[] $days
     */
    private function buildAbsenceGrid(array $days): array
    {
        $typeLabels = ['vacaciones' => 'Vacaciones', 'incapacidad' => 'Incapacidad'];

        $absences = EmployeeAbsence::where('area_id', $this->areaId)
            ->where('status', 'Activa')
            ->where('start_date', '<=', $days[count($days) - 1]->toDateString())
            ->where('end_date', '>=', $days[0]->toDateString())
            ->with('employee:uid,name')
            ->get();

        $grid = [];

        foreach ($absences as $absence) {
            $employeeName = $absence->employee?->name ?? $absence->employee_uid;
            $typeLabel = $typeLabels[$absence->type] ?? ucfirst($absence->type);

            foreach ($days as $date) {
                $dateIso = $date->toDateString();
                if ($dateIso < $absence->start_date->toDateString() || $dateIso > $absence->end_date->toDateString()) {
                    continue;
                }

                $grid[$typeLabel][$dateIso][] = $employeeName;
            }
        }

        ksort($grid);
        foreach ($grid as &$cellsByDate) {
            ksort($cellsByDate);
            foreach ($cellsByDate as &$names) {
                $names = implode(', ', $names);
            }
        }
        unset($cellsByDate, $names);

        return $grid;
    }
}
