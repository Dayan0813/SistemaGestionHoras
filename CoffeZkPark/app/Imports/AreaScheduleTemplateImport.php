<?php 
namespace App\Imports;
use App\Models\Employee;
use App\Models\Programations;
use App\Models\WorkPosition;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use App\Http\Controllers\CalendarsController;
use App\Http\Controllers\EmployeeAbsenceController;
use App\Http\Controllers\ProgramationsController;

class AreaScheduleTemplateImport implements ToCollection{
    private array $errors = [];
     private array $warnings = [];
    private int $programationsCreated = 0 ;
    private int $absencesCreated = 0;
    private int $calendarsCreated = 0;
    private bool $isVariable;
    private int $firstDayColumn;


    public function __construct(
        private int $areaId,
        private int $year,
        private int $month,
        private string $schedulingMode = 'fijo',
    ){
        $this->isVariable = $this->schedulingMode === 'variable';
        // Columna 0 = Cédula, 1 = Nombre, 2 = Puesto (solo si es variable)
        $this->firstDayColumn = $this->isVariable ? 3 : 2;
    }
    public function hasErrors():bool
    {
        return !empty($this->errors);
    }

    public function getErrors(): array 
    {
        return $this->errors;
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
        $daysInMonth = Carbon::create($this->year, $this->month, 1 )->daysInMonth;
        $employeeRows = $rows->slice(2);

        $this->validateAllRows($employeeRows,$daysInMonth);
        if( $this->hasErrors()){
            return;
        }
        $this->importAllRows($employeeRows, $daysInMonth);
    }
        private function validateAllRows(Collection $employeeRows, int $daysInMonth): void
    {
        $seenCedulas = [];
        // [dia => [puesto_normalizado => "fila (empleado)"]] — detecta que dos empleados
        // no queden asignados al mismo puesto el mismo día.
        $positionUsageByDay = [];

        foreach ($employeeRows as $rowIndex => $row) {
            $cedula = trim((string) ($row[0] ?? ''));
            if ($cedula === '') {
                continue;
            }
            $nombre = trim((string) ($row[1] ?? ''));
              if ($nombre === '')
            {
                continue;
            }


            if (isset($seenCedulas[$cedula])) {
                $this->errors[] = "Fila " . ($rowIndex + 3) . ": la cédula '{$cedula}' está repetida (ya aparece en la fila {$seenCedulas[$cedula]}).";
                continue;
            }
            $seenCedulas[$cedula] = $rowIndex + 3;

            $employee = Employee::where('documentos', $cedula)->where('area_id', $this->areaId)->first();
            if (!$employee) {
                $this->errors[] = "Fila " . ($rowIndex + 3) . ": la cédula '{$cedula}' no corresponde a ningún empleado activo de esta área.";
                continue;
            }

            $posicionNombre = null;
            if ($this->isVariable) {
                $posicionNombre = trim((string) ($row[2] ?? ''));
                if ($posicionNombre === '') {
                    $this->errors[] = "Fila " . ($rowIndex + 3) . " ({$employee->name}): esta área es de horario variable, debe indicar el puesto.";
                } elseif (!WorkPosition::where('area_id', $this->areaId)->where('name', $posicionNombre)->exists()) {
                    $this->errors[] = "Fila " . ($rowIndex + 3) . " ({$employee->name}): el puesto '{$posicionNombre}' no existe en esta área.";
                    $posicionNombre = null;
                }
            }

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $columnIndex = $this->firstDayColumn - 1 + $day;
                $cellValue = trim((string) ($row[$columnIndex] ?? ''));
                $parsed = $this->parseCell($cellValue);
                if ($parsed === null) {
                    $date = Carbon::create($this->year, $this->month, $day)->toDateString();
                    $this->errors[] = "Fila " . ($rowIndex + 3) . " ({$employee->name}), día {$date}: valor '{$cellValue}' no reconocido. Use HH:MM-HH:MM, D, VAC o INC.";
                    continue;
                }

                if ($posicionNombre !== null && $parsed['type'] === 'shift') {
                    $key = mb_strtoupper($posicionNombre);
                    if (isset($positionUsageByDay[$day][$key])) {
                        $date = Carbon::create($this->year, $this->month, $day)->toDateString();
                        $this->errors[] = "Fila " . ($rowIndex + 3) . " ({$employee->name}), día {$date}: el puesto '{$posicionNombre}' ya está asignado a {$positionUsageByDay[$day][$key]} ese mismo día.";
                    } else {
                        $positionUsageByDay[$day][$key] = $employee->name;
                    }
                }
            }
        }
    }
    private function parseCell(string $value): ?array
    {
        $value = strtoupper(trim($value));

        if($value ===''){
            return ['type' =>  'rest'];
        }

        if($value === 'D'){
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
    private function importAllRows(Collection $employeeRows, int  $daysInMonth):void 
    {
        $programationsController = new ProgramationsController();
        $calendarsController = new CalendarsController();
        $absenceController = new EmployeeAbsenceController();
        $programationsController->withAreaLock($this->areaId, function () use ($employeeRows, $daysInMonth, $programationsController , $calendarsController , $absenceController ){
        \Illuminate\Support\Facades\DB::transaction(function () use ($employeeRows, $daysInMonth, $programationsController, $calendarsController, $absenceController){
                        foreach ($employeeRows as $row) {
                $cedula = trim((string) ($row[0] ?? ''));
                if ($cedula === '') {
                    continue;
                }
                $employee = Employee::where('documentos', $cedula)->where('area_id', $this->areaId)->first();
                if (!$employee) {
                    continue;
                }
                $workPositionId = null;
                if ($this->isVariable) {
                    $posicionNombre = trim((string) ($row[2] ?? ''));
                    $workPositionId = WorkPosition::where('area_id', $this->areaId)
                        ->where('name', $posicionNombre)
                        ->value('id');
                }
                $cellsByDay = [];
                for ($day = 1; $day <= $daysInMonth; $day++) {
                    $columnIndex = $this->firstDayColumn - 1 + $day;

                $cellValue = trim((string) ($row[$columnIndex] ?? ''));
                $cellsByDay[$day] = $this->parseCell($cellValue);
            }
            $groups = $this->groupConsecutiveDays($cellsByDay, $daysInMonth);
            foreach($groups as $group){
                $this->applyGroup($employee, $group, $programationsController, $calendarsController, $absenceController, $workPositionId);
            }
            }
        });
        });
    }
    private function groupConsecutiveDays(array $cellsByDay, int $daysInMonth): array
    {
        $groups = [];
        $currentGroup = null;
        for ($day = 1; $day <= $daysInMonth ; $day++){
        $parsed = $cellsByDay[$day];
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
                return $a['hora_entrada']===$b['hora_entrada'] && $a['hora_salida'] === $b['hora_salida'];
            }
        return true;
    }
    private function applyGroup(Employee $employee, array $group , ProgramationsController $programationsController, CalendarsController $calendarsController, EmployeeAbsenceController $absenceController, ?int $workPositionId = null):void
    {
        $type = $group['parsed']['type'];
        if($type ==='rest'){
          return ;
         }

        $startDate = Carbon::create($this->year,$this->month, $group['days'][0])->toDateString();
        $endDate= Carbon::create($this->year , $this->month, end($group['days']))->toDateString();
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

        $existingProgramation = Programations::where('employee_uid', $employee->uid)
        ->where('area_id', $this->areaId)
        ->where('status' , '!=', 'Cancelado')
        ->where('start_date','<=', $endDate)
        ->where('end_date', '>=',$startDate)
        ->first();

        if($existingProgramation){
            foreach ($group['days'] as $day){
              $date = Carbon::create($this->year, $this->month, $day)->toDateString();
              $programationsController->upsertOverride($existingProgramation->id, $date, $this->areaId, $calendar->id, $workPositionId);
            }
            return;
        }
        Programations::create([
            'employee_uid' => $employee->uid,
            'type' => $calendar->shift_type,
            'area_id' => $this->areaId,
            'calendar_id' => $calendar->id,
            'work_position_id' => $workPositionId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => 'Borrador', 
            'group_code' => 'plantilla-excel',
            'work_days' => null,
        ]);
        $this->programationsCreated++;
    }


}
