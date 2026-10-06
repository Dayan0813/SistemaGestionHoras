<?php
namespace App\Imports;
use App\Exports\AreaScheduleTemplateExport;
use App\Models\calendars;
use App\Models\Employee;
use App\Models\Programations;
use App\Models\WorkPosition;
use App\Services\WeeklyStaffingValidator;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use App\Http\Controllers\CalendarsController;
use App\Http\Controllers\EmployeeAbsenceController;
use App\Http\Controllers\ProgramationsController;

/**
 * Importa la plantilla generada por AreaScheduleTemplateExport (el período sale de su título).
 *
 * - Área fija: fila por empleado, celda por día con Apertura, Normal, Cierre, D, VAC o INC (también se acepta
 *   HH:MM-HH:MM de plantillas anteriores). Los turnos usan los horarios elegidos al subir el archivo.
 * - Área variable: fila por puesto, celda por día = empleado que cubre el puesto. Todos los
 *   turnos usan el horario ($calendarId) elegido al subir el archivo. Las plantillas anteriores
 *   traían además una sección de ausencias (VAC/INC por empleado), que se sigue leyendo.
 */
class AreaScheduleTemplateImport implements ToCollection, WithMultipleSheets{
    private const FIRST_DAY_COLUMN = 2; // 0 = Cédula/ID, 1 = Nombre/Puesto

    private array $errors = [];
     private array $warnings = [];
    private int $programationsCreated = 0 ;
    private int $absencesCreated = 0;
    private int $calendarsCreated = 0;
    private bool $isVariable;
    private int $dayCount;
    /** @var array<int, string> fecha (Y-m-d) de cada columna de día; [0] = primera columna */
    private array $dates = [];
    /** @var Collection<string, Employee> empleados del área por cédula */
    private Collection $employeesByCedula;
    /**
     * Celdas ya interpretadas por empleado, listas para agrupar e importar.
     * @var array<string, array{employee: Employee, days: array<int, array>}>
     */
    private array $plan = [];
    /** @var array<int, int|null> horarios de los turnos ya validados contra el área */
    private array $areaCalendarIds = [];
    /** @var array<int, array> ver WeeklyStaffingValidator::validate() */
    private array $staffingIssues = [];
    /** @var array<int, true> días del período con al menos una celda escrita (decide qué se valida) */
    private array $filledDays = [];


    public function __construct(
        private int $areaId,
        private int $year,
        private int $month,
        private string $schedulingMode = 'fijo',
        private ?int $calendarId = null,
        // Áreas fijas: horario elegido al subir el archivo para cada turno de la lista,
        // p. ej. ['APERTURA' => 3, 'NORMAL' => null, 'CIERRE' => 23] (ver SHIFT_NAMES).
        private array $shiftCalendarIds = [],
    ){
        $this->isVariable = $this->schedulingMode === 'variable';
        $this->setDates(Carbon::create($this->year, $this->month, 1), Carbon::create($this->year, $this->month, 1)->endOfMonth());
    }

    private function setDates(Carbon $from, Carbon $to): void
    {
        $this->dates = [];
        for ($date = $from->copy()->startOfDay(); $date->lte($to); $date->addDay()) {
            $this->dates[] = $date->toDateString();
        }
        $this->dayCount = count($this->dates);
    }

    /**
     * Las plantillas nuevas traen su período en el título ("... del 05/10/2026 al 11/10/2026"):
     * cada columna de día se ubica desde ahí, sin importar el mes elegido al subir. Las plantillas
     * mensuales viejas, sin rango, siguen usando $year/$month.
     */
    private function readPeriodFromTitle(Collection $rows): void
    {
        $titleRow = $rows->first();
        $title = trim((string) ($titleRow[0] ?? '')) . ' ' . trim((string) ($titleRow[1] ?? ''));
        $range = AreaScheduleTemplateExport::parseRangeFromTitle($title);
        if ($range !== null && $range[0]->lte($range[1]) && $range[0]->diffInDays($range[1]) < 92) {
            $this->setDates($range[0], $range[1]);
        }
    }
    /** Solo se lee la hoja de la plantilla; la hoja oculta con la lista de empleados se ignora. */
    public function sheets(): array
    {
        return [0 => $this];
    }

    public function hasErrors():bool
    {
        return !empty($this->errors);
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    /** Problemas de contrato (fijos/temporales) con sus datos, para pintarlos en pantalla. */
    public function getStaffingIssues(): array
    {
        return $this->staffingIssues;
    }

    public function getWarnings(): array{
        return $this->warnings;
    }
    public function getSummary(): array
    {
        return [
            'programations_created' => $this->programationsCreated,
            'absences_created' => $this->absencesCreated,
            'calendars_created' => $this->calendarsCreated,

        ];
    }

    public function collection(Collection $rows):void
    {
        $this->employeesByCedula = Employee::where('area_id', $this->areaId)->get()->keyBy(fn ($e) => trim((string) $e->documentos));
        $this->readPeriodFromTitle($rows);

        $this->isVariable ? $this->buildVariablePlan($rows) : $this->buildFixedPlan($rows);
        if( $this->hasErrors()){
            return;
        }

        if (empty($this->filledDays)) {
            $this->errors[] = 'La plantilla no tiene ningún día diligenciado.';
            return;
        }

        // Solo se valida lo que el coordinador llenó, para que pueda subir el mes por partes
        // (p. ej. del 1 al 8) sin que los días que aún no programa bloqueen la subida:
        // - personal mínimo, temporales y parque cerrado: del primer al último día escrito;
        // - 42 h de los fijos: solo las semanas que con este archivo quedan completas (su
        //   domingo ya está cubierto), sumando lo guardado en subidas anteriores.
        $overlay = $this->planAsOverlay();
        [$firstDate, $lastDate] = $this->filledRange();
        $this->staffingIssues = array_values(array_filter(
            WeeklyStaffingValidator::validate($this->areaId, $firstDate, $lastDate, $overlay),
            fn ($issue) => $issue['kind'] !== 'fijo_hours',
        ));
        foreach ($this->completedWeeks($firstDate, $lastDate) as [$from, $to]) {
            foreach (WeeklyStaffingValidator::validate($this->areaId, $from, $to, $overlay) as $issue) {
                if ($issue['kind'] === 'fijo_hours') {
                    $this->staffingIssues[] = $issue;
                }
            }
        }
        $this->errors = array_column($this->staffingIssues, 'message');
        if( $this->hasErrors()){
            return;
        }
        $this->importPlan();
    }

    /**
     * El plan en el formato de WeeklyStaffingValidator: [uid][Y-m-d] => turno con sus horas
     * o ausencia. Los días de descanso no se incluyen (importar no borra lo ya guardado).
     */
    private function planAsOverlay(): array
    {
        $calendarIds = [];
        foreach ($this->plan as $entry) {
            foreach ($entry['days'] as $parsed) {
                if (isset($parsed['calendar_id'])) {
                    $calendarIds[$parsed['calendar_id']] = true;
                }
            }
        }
        $calendarsById = calendars::whereIn('id', array_keys($calendarIds))->get()->keyBy('id');

        $overlay = [];
        foreach ($this->plan as $entry) {
            $uid = $entry['employee']->uid;
            foreach ($entry['days'] as $day => $parsed) {
                $dateIso = $this->dateLabel($day);
                if ($parsed['type'] === 'vacaciones' || $parsed['type'] === 'incapacidad') {
                    $overlay[$uid][$dateIso] = ['type' => $parsed['type']];
                } elseif ($parsed['type'] === 'shift') {
                    $calendar = isset($parsed['calendar_id']) ? $calendarsById->get($parsed['calendar_id']) : null;
                    $overlay[$uid][$dateIso] = [
                        'type' => 'shift',
                        'hora_entrada' => $calendar?->hora_entrada ?? $parsed['hora_entrada'] ?? null,
                        'hora_salida' => $calendar?->hora_salida ?? $parsed['hora_salida'] ?? null,
                    ];
                }
            }
        }

        return $overlay;
    }

    /** Primer y último día escrito en la plantilla (Y-m-d). */
    private function filledRange(): array
    {
        $days = array_keys($this->filledDays);
        return [$this->dateLabel(min($days)), $this->dateLabel(max($days))];
    }

    /**
     * Semanas (lunes a domingo, recortadas al período de la plantilla) que tocan el rango escrito
     * y cuyo último día ya está cubierto por él, como [desde, hasta] en Y-m-d. Una semana a medio
     * llenar se revisa en la subida que la complete.
     * @return array<int, array{0: string, 1: string}>
     */
    private function completedWeeks(string $firstDate, string $lastDate): array
    {
        $periodStart = $this->dates[0];
        $periodEnd = end($this->dates);
        $weeks = [];
        for ($monday = Carbon::parse($firstDate)->startOfWeek(Carbon::MONDAY); $monday->toDateString() <= $lastDate; $monday->addWeek()) {
            $end = min($monday->copy()->endOfWeek(Carbon::SUNDAY)->toDateString(), $periodEnd);
            if ($end <= $lastDate) {
                $weeks[] = [max($monday->toDateString(), $periodStart), $end];
            }
        }
        return $weeks;
    }

    /** Número de fila tal como se ve en Excel (las llaves de la colección empiezan en 0). */
    private function excelRow(int $rowIndex): int
    {
        return $rowIndex + 1;
    }

    /** Fecha (Y-m-d) de la columna de día número $day (1 = primera columna de días). */
    private function dateLabel(int $day): string
    {
        return $this->dates[$day - 1];
    }

    private function cell($row, int $day): string
    {
        return trim((string) ($row[self::FIRST_DAY_COLUMN - 1 + $day] ?? ''));
    }

    // ---------------------------------------------------------------- Área fija

    private function buildFixedPlan(Collection $rows): void
    {
        $seenCedulas = [];
        // Un solo mensaje por turno sin horario elegido, en vez de uno por celda.
        $missingTurno = [];

        foreach ($rows->slice(2) as $rowIndex => $row) {
            $cedula = trim((string) ($row[0] ?? ''));
            $nombre = trim((string) ($row[1] ?? ''));
            if ($cedula === '' || $nombre === '') {
                continue;
            }
            $excelRow = $this->excelRow($rowIndex);

            if (isset($seenCedulas[$cedula])) {
                $this->errors[] = "Fila {$excelRow}: la cédula '{$cedula}' está repetida (ya aparece en la fila {$seenCedulas[$cedula]}).";
                continue;
            }
            $seenCedulas[$cedula] = $excelRow;

            $employee = $this->employeesByCedula->get($cedula);
            if (!$employee) {
                $this->errors[] = "Fila {$excelRow}: la cédula '{$cedula}' no corresponde a ningún empleado activo de esta área.";
                continue;
            }

            $days = [];
            for ($day = 1; $day <= $this->dayCount; $day++) {
                $cellValue = $this->cell($row, $day);
                if ($cellValue !== '') {
                    $this->filledDays[$day] = true;
                }
                $parsed = $this->parseCell($cellValue);
                if ($parsed === null) {
                    $this->errors[] = "Fila {$excelRow} ({$employee->name}), día {$this->dateLabel($day)}: valor '{$cellValue}' no reconocido. Use Apertura, Normal, Cierre, D, VAC o INC.";
                    continue;
                }
                if ($parsed['type'] === 'shift' && array_key_exists('calendar_id', $parsed) && $parsed['calendar_id'] === null) {
                    $turno = ucfirst(strtolower($cellValue));
                    $missingTurno[$turno] = "Debe elegir el horario de {$turno} al subir la plantilla.";
                    continue;
                }
                $days[$day] = $parsed;
            }
            $this->plan[$cedula] = ['employee' => $employee, 'days' => $days];
        }
        foreach ($missingTurno as $message) {
            array_unshift($this->errors, $message);
        }
    }

    /** Id del horario elegido para un turno, solo si pertenece al área. */
    private function areaCalendarId(?int $calendarId): ?int
    {
        if ($calendarId === null) {
            return null;
        }
        if (!array_key_exists($calendarId, $this->areaCalendarIds)) {
            $this->areaCalendarIds[$calendarId] = calendars::where('id', $calendarId)->where('area_id', $this->areaId)->value('id');
        }
        return $this->areaCalendarIds[$calendarId];
    }

    private function parseCell(string $value): ?array
    {
        $value = strtoupper(trim($value));

        if (in_array($value, AreaScheduleTemplateExport::SHIFT_NAMES, true)) {
            return [
                'type' => 'shift',
                'calendar_id' => $this->areaCalendarId($this->shiftCalendarIds[$value] ?? null),
            ];
        }

        // Vacío o D = descansa (no se guarda nada ese día).
        if ($value === '' || $value === 'D') {
            return ['type' => 'rest'];
        }
        if($value === 'VAC'){
            return ['type'=>'vacaciones'];
        }
        if($value === 'INC'){
            return ['type' => 'incapacidad'];
        }

        if (preg_match('/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/', $value, $matches)){
            return [
                'type' => 'shift',
                'hora_entrada'=> $this->normalizeTime($matches[1]),
                'hora_salida'=> $this->normalizeTime($matches[2]),
            ];
        }
        return null;
    }
    private function normalizeTime(string $time) : string
    {
        [$hours , $minutes ] =explode(':', $time);
        return sprintf('%02d:%02d', (int) $hours, (int) $minutes);
    }

    // ------------------------------------------------------------ Área variable

    private function buildVariablePlan(Collection $rows): void
    {
        $calendar = $this->calendarId
            ? calendars::where('id', $this->calendarId)->where('area_id', $this->areaId)->first()
            : null;
        if (!$calendar) {
            $this->errors[] = 'Debe elegir un horario válido del área para subir la plantilla.';
            return;
        }

        $positions = WorkPosition::where('area_id', $this->areaId)->get()->keyBy('id');
        // [cedula][dia] => ['position' => nombre, 'row' => fila excel]
        $assignments = [];
        // [cedula][dia] => 'vacaciones' | 'incapacidad'
        $absences = [];
        $section = 'positions';

        foreach ($rows->slice(2) as $rowIndex => $row) {
            $key = trim((string) ($row[0] ?? ''));
            $label = trim((string) ($row[1] ?? ''));
            $excelRow = $this->excelRow($rowIndex);

            if ($label === AreaScheduleTemplateExport::ABSENCES_MARKER) {
                $section = 'absences_header';
                continue;
            }
            if ($section === 'absences_header') {
                $section = 'absences';
                continue;
            }
            if (str_starts_with($label, AreaScheduleTemplateExport::CONVENTION_PREFIX)) {
                break;
            }
            if ($key === '') {
                continue;
            }

            if ($section === 'positions') {
                $position = $positions->get((int) $key);
                if (!$position) {
                    $this->errors[] = "Fila {$excelRow}: el puesto '{$label}' no existe en esta área. Descargue de nuevo la plantilla.";
                    continue;
                }
                for ($day = 1; $day <= $this->dayCount; $day++) {
                    $cellValue = $this->cell($row, $day);
                    if ($cellValue === '') {
                        continue;
                    }
                    $this->filledDays[$day] = true;
                    $employee = $this->findEmployee($cellValue);
                    if (!$employee) {
                        $this->errors[] = "Fila {$excelRow} ({$label}), día {$this->dateLabel($day)}: el empleado '{$cellValue}' no pertenece a esta área.";
                        continue;
                    }
                    $cedula = trim((string) $employee->documentos);
                    if (isset($assignments[$cedula][$day])) {
                        $previous = $assignments[$cedula][$day];
                        $employeeLabel = AreaScheduleTemplateExport::employeeLabel($employee);
                        $this->errors[] = "Fila {$excelRow} ({$label}), día {$this->dateLabel($day)}: {$employeeLabel} ya está asignado al puesto '{$previous['position']}' (fila {$previous['row']}) ese mismo día.";
                        continue;
                    }
                    $assignments[$cedula][$day] = ['position' => $label, 'position_id' => $position->id, 'row' => $excelRow];
                }
                continue;
            }

            // Sección de ausencias
            $employee = $this->employeesByCedula->get($key);
            if (!$employee) {
                $this->errors[] = "Fila {$excelRow}: la cédula '{$key}' no corresponde a ningún empleado activo de esta área.";
                continue;
            }
            for ($day = 1; $day <= $this->dayCount; $day++) {
                $cellValue = strtoupper($this->cell($row, $day));
                if ($cellValue === '') {
                    continue;
                }
                $this->filledDays[$day] = true;
                if (!in_array($cellValue, ['VAC', 'INC'], true)) {
                    $this->errors[] = "Fila {$excelRow} ({$employee->name}), día {$this->dateLabel($day)}: valor '{$cellValue}' no reconocido. En ausencias use VAC o INC.";
                    continue;
                }
                $absences[$key][$day] = $cellValue === 'VAC' ? 'vacaciones' : 'incapacidad';
            }
        }

        foreach ($absences as $cedula => $days) {
            foreach ($days as $day => $type) {
                if (isset($assignments[$cedula][$day])) {
                    $name = AreaScheduleTemplateExport::employeeLabel($this->employeesByCedula->get($cedula));
                    $label = $type === 'vacaciones' ? 'VAC' : 'INC';
                    $this->errors[] = "Día {$this->dateLabel($day)}: {$name} tiene {$label} pero está asignado al puesto '{$assignments[$cedula][$day]['position']}' (fila {$assignments[$cedula][$day]['row']}).";
                }
            }
        }
        if ($this->hasErrors()) {
            return;
        }

        foreach (array_unique(array_merge(array_keys($assignments), array_keys($absences))) as $cedula) {
            $cedula = (string) $cedula;
            // Los días que no aparecen descansan (groupConsecutiveDays los toma como 'rest').
            $days = [];
            foreach ($assignments[$cedula] ?? [] as $day => $assignment) {
                $days[$day] = ['type' => 'shift', 'calendar_id' => $calendar->id, 'work_position_id' => $assignment['position_id']];
            }
            foreach ($absences[$cedula] ?? [] as $day => $type) {
                $days[$day] = ['type' => $type];
            }
            $this->plan[$cedula] = ['employee' => $this->employeesByCedula->get($cedula), 'days' => $days];
        }
    }

    /** Acepta el texto de la lista "Nombre (cédula)" o solo la cédula. */
    private function findEmployee(string $value): ?Employee
    {
        $cedula = preg_match('/\(([^()]+)\)\s*$/', $value, $matches) ? trim($matches[1]) : $value;
        return $this->employeesByCedula->get($cedula);
    }

    // ---------------------------------------------------------------- Guardado

    private function importPlan():void
    {
        $programationsController = new ProgramationsController();
        $calendarsController = new CalendarsController();
        $absenceController = new EmployeeAbsenceController();
        $programationsController->withAreaLock($this->areaId, function () use ($programationsController , $calendarsController , $absenceController ){
        DB::transaction(function () use ($programationsController, $calendarsController, $absenceController){
            foreach ($this->plan as $entry) {
                foreach($this->groupConsecutiveDays($entry['days']) as $group){
                    $this->applyGroup($entry['employee'], $group, $programationsController, $calendarsController, $absenceController);
                }
            }
        });
        });
    }
    private function groupConsecutiveDays(array $cellsByDay): array
    {
        $groups = [];
        $currentGroup = null;
        for ($day = 1; $day <= $this->dayCount; $day++){
        $parsed = $cellsByDay[$day] ?? ['type' => 'rest'];
         if($currentGroup !== null && $this->sameContent($currentGroup['parsed'] , $parsed)){
            $currentGroup['days'][] = $day;
            continue;
         }
         if($currentGroup !== null){
            $groups[] = $currentGroup;
         }
         $currentGroup = ['parsed' => $parsed , 'days' => [$day]];
        }
        if ($currentGroup !== null){
            $groups[] = $currentGroup;
        }
        return $groups;
    }
    private function sameContent(array $a, array $b):bool
    {
        if($a['type'] !== $b['type']){
            return false;
        }
        if ($a['type'] === 'shift'){
            // Un cambio de horario o de puesto corta el grupo.
            foreach (['hora_entrada', 'hora_salida', 'calendar_id', 'work_position_id'] as $field) {
                if (($a[$field] ?? null) !== ($b[$field] ?? null)) {
                    return false;
                }
            }
        }
        return true;
    }
    private function applyGroup(Employee $employee, array $group , ProgramationsController $programationsController, CalendarsController $calendarsController, EmployeeAbsenceController $absenceController):void
    {
        $type = $group['parsed']['type'];
        if($type ==='rest'){
          return ;
         }

        $startDate = $this->dateLabel($group['days'][0]);
        $endDate= $this->dateLabel(end($group['days']));
        if($type === 'vacaciones' || $type === 'incapacidad'){
            $absenceController->createAbsenceRecord(
                $employee,
                $type,
                $startDate,
                $endDate,
                null,
                'Creado desde planilla excel ',
            );
            $this->absencesCreated++;
            return;
        }

        $workPositionId = $group['parsed']['work_position_id'] ?? null;
        if (isset($group['parsed']['calendar_id'])) {
            $calendar = calendars::findOrFail($group['parsed']['calendar_id']);
        } else {
            $horaEntrada = $group['parsed']['hora_entrada'];
            $horaSalida = $group['parsed']['hora_salida'];
            $shiftType = $horaSalida <= $horaEntrada ? 'N' : 'D';
           [$calendar , $durationError] = $calendarsController->resolveOrCreateCalendar(
            $this->areaId,
            $horaEntrada,
            $horaSalida,
            $shiftType,
            forceCreate:true,
    );
       if($durationError !== null){
        $this->warnings[]="{$employee->name} , {$startDate} a {$endDate} : {$durationError}";
       }

            if ($calendar->wasRecentlyCreated) {
                $this->calendarsCreated++;
            }
        }

        // Cada día va a la programación que ya lo cubre (fecha dentro de su rango y día de la
        // semana dentro de sus work_days) como excepción puntual; los días que ninguna cubre se
        // guardan en programaciones nuevas, una por tramo seguido. Meter una excepción en una
        // programación que no cubre ese día la dejaría guardada pero invisible.
        $existing = Programations::where('employee_uid', $employee->uid)
            ->where('area_id', $this->areaId)
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate)
            ->orderBy('start_date')
            ->get();

        $uncoveredDays = [];
        foreach ($group['days'] as $day) {
            $date = $this->dateLabel($day);
            $weekday = Carbon::parse($date)->isoWeekday();
            $covering = $existing->first(fn ($p) => $p->start_date->toDateString() <= $date
                && $p->end_date->toDateString() >= $date
                && (empty($p->work_days) || in_array($weekday, $p->work_days, true)));
            if ($covering) {
                $programationsController->upsertOverride($covering->id, $date, $this->areaId, $calendar->id, $workPositionId);
            } else {
                $uncoveredDays[] = $day;
            }
        }

        foreach ($this->consecutiveRuns($uncoveredDays) as $run) {
            Programations::create([
                'employee_uid' => $employee->uid,
                'type' => $calendar->shift_type,
                'area_id' => $this->areaId,
                'calendar_id' => $calendar->id,
                'work_position_id' => $workPositionId,
                'start_date' => $this->dateLabel($run[0]),
                'end_date' => $this->dateLabel(end($run)),
                'status' => 'Borrador',
                'group_code' => 'plantilla-excel',
                'work_days' => null,
            ]);
            $this->programationsCreated++;
        }
    }

    /** Parte una lista ordenada de días (índices de columna) en tramos seguidos: [1,2,4] → [[1,2],[4]]. */
    private function consecutiveRuns(array $days): array
    {
        $runs = [];
        foreach ($days as $day) {
            $last = array_key_last($runs);
            if ($last !== null && end($runs[$last]) === $day - 1) {
                $runs[$last][] = $day;
            } else {
                $runs[] = [$day];
            }
        }
        return $runs;
    }


}
