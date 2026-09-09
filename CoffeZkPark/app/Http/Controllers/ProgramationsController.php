<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\area;
use App\Models\calendars;
use App\Models\WorkPosition;
use App\Models\Employee;
use App\Models\ProgramationOverride;
use App\Models\Programations;
use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProgramationsController extends Controller
{
    use EnsuresAreaAccess;

    /**
     * ============================
     * 
     *  Listado de las programaciones
     * 
     * ==============================
     * */

    public function getCard(Request $request)
    {
        $year = $request->query('year', now()->year);
        $month = $request->query('month', now()->month);

        $startOfMonth = sprintf('%04d-%02d-01', $year, $month);
        $endOfMonth = date('Y-m-t', strtotime($startOfMonth));

        $areas = DB::table('Programations')
            ->join('areas', 'Programations.area_id', '=', 'areas.id')
            ->select(
                'areas.id as area_id',
                'areas.nombre as area_name',
                DB::raw('COUNT(DISTINCT Programations.employee_uid) as employees_count'), // ← ¡Importante!
                DB::raw('GROUP_CONCAT(DISTINCT Programations.status SEPARATOR ",") as statuses')
            )
            ->where(function ($query) use ($startOfMonth, $endOfMonth) {
                $query->whereBetween('Programations.start_date', [$startOfMonth, $endOfMonth])
                    ->orWhereBetween('Programations.end_date', [$startOfMonth, $endOfMonth])
                    ->orWhere(function ($q) use ($startOfMonth, $endOfMonth) {
                        $q->where('Programations.start_date', '<=', $endOfMonth)
                            ->where('Programations.end_date', '>=', $startOfMonth);
                    });
            })
            ->groupBy('areas.id', 'areas.nombre')
            ->havingRaw('employees_count > 0')
            ->get();

        return response()->json($areas);
    }

    /**
     * ===========================================
     *
     *  Aplicar un turno como excepcion a uno o varios
     *  dias puntuales, para todos los empleados del
     *  area que esten programados esos dias
     *
     * ===========================================
     */

    public function bulkOverride(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|integer|exists:areas,id',
            'calendar_id' => 'required|exists:calendars,id',
            'dates' => 'required|array|min:1',
            'dates.*' => 'date',
        ]);

        $this->ensureAreaAcces($validated['area_id']);

        // Solo turnos del catálogo general del área, no personalizados de un empleado
        $calendar = calendars::where('id', $validated['calendar_id'])
            ->where('area_id', $validated['area_id'])
            ->where('is_custom', false)
            ->firstOrFail();

        // Todas las excepciones del lote se aplican como una sola unidad: si una fecha a mitad
        // falla, se revierten también las anteriores en vez de dejar el override aplicado solo
        // a una parte de las fechas pedidas.
        $employeesAfectados = DB::transaction(function () use ($validated, $calendar) {
            $employeesAfectados = 0;

            foreach ($validated['dates'] as $date) {
                $isoWeekday = Carbon::parse($date)->isoWeekday();

                // Mismo criterio que coveredDates(): una fila con work_days
                // solo aplica a los días de la semana que realmente incluye.
                $programations = Programations::where('area_id', $validated['area_id'])
                    ->where('status', '!=', 'Cancelado')
                    ->where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date)
                    ->get()
                    ->filter(fn ($p) => empty($p->work_days) || in_array($isoWeekday, $p->work_days, true));

                foreach ($programations as $programation) {
                    $this->upsertOverride($programation->id, $date, $validated['area_id'], $calendar->id, null, touchWorkPosition: false);

                    $employeesAfectados++;
                }
            }

            return $employeesAfectados;
        });

        return response()->json([
            'success' => true,
            'empleados_afectados' => $employeesAfectados,
        ]);
    }

    /**
     * ===========================================
     *
     *  Retorno de los valores dinamicos para el detalle
     *
     * ===========================================
     */

    public function DinamicDetails(Request $request, int $areaId)
    {
        $this->ensureAreaViewAccess($areaId);

        $validated = $request->validate([
            'year' => 'required|integer',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $employees = \App\Services\AreaScheduleQuery::forMonth($areaId, $validated['year'], $validated['month']);

        return response()->json([
            'employees' => $employees,
            'high_season_ranges' => \App\Models\CompanySetting::get('high_season_ranges', []),
        ]);
    }

    /**
     * ===========================================
     *
     *  Exportar a Excel la programación de un área/mes
     *  (mismos datos que DinamicDetails, en formato descargable)
     *
     * ===========================================
     */

    public function exportMonth(Request $request, int $areaId)
    {
        $this->ensureAreaViewAccess($areaId);

        // Un coordinador ya ve su área completa en pantalla; exportar a Excel queda solo
        // para los roles que consultan varias áreas (mismo criterio que exportAllAreas).
        if (auth()->user()->hasRole('coordinator')) {
            abort(403, 'Los coordinadores no pueden exportar la programación a Excel.');
        }

        $validated = $request->validate([
            'year' => 'required|integer',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $areaModel = area::findOrFail($areaId);
        $employees = \App\Services\AreaScheduleQuery::forMonth($areaId, $validated['year'], $validated['month']);

        $fileName = sprintf(
            'programacion-%s-%d-%02d.xlsx',
            \Illuminate\Support\Str::slug($areaModel->nombre),
            $validated['year'],
            $validated['month']
        );

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\AreaScheduleExport(
                $employees,
                (int) $validated['year'],
                (int) $validated['month'],
                $areaModel->nombre,
                highSeasonRanges: \App\Models\CompanySetting::get('high_season_ranges', []),
                areaId: (int) $areaId,
            ),
            $fileName
        );
    }

    /**
     * ===========================================
     *
     *  Exportar a Excel la programación de TODAS las áreas
     *  (una hoja por área en el mismo libro). Solo para roles
     *  que pueden ver más de un área a la vez.
     *
     * ===========================================
     */

    public function exportAllAreas(Request $request)
    {
        $user = auth()->user();

        if (!$user->hasRole('admin') && !$user->hasRole('aux_admin_th') && !$user->hasRole('aux_th')) {
            abort(403, 'No tienes acceso a la programación de todas las áreas.');
        }

        $validated = $request->validate([
            'year' => 'required|integer',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $fileName = sprintf('programacion-todas-las-areas-%d-%02d.xlsx', $validated['year'], $validated['month']);

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\AllAreasScheduleExport((int) $validated['year'], (int) $validated['month']),
            $fileName
        );
    }

    /**
     * ============================
     *
     *  Almacenamiento de la programacion
     *
     * ============================
     */

    public function store(Request $request)
    {
        $user = auth()->user();

        $validated = $request->validate([
            'area_id' => 'required|exists:areas,id',
            'calendar_id' => 'required|exists:calendars,id',
            'work_position_id' => 'nullable|exists:work_positions,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'duration' => 'nullable|integer|in:7,15,30,60',
            'employees' => 'required|array|min:1',
            'employees.*' => 'string|exists:employees,uid',
            'group_code' => 'nullable|string',
            'day_overrides' => 'nullable|string',
            'work_days' => 'nullable|array',
            'work_days.*' => 'integer|between:1,7',
        ]);

        // Validacion del area
        if ($user->hasRole('coordinator') || $user->hasRole('aux_admin_th')) {

            if (!$user->employee) {
                abort(403, 'Usuario sin empleado asociado');
            }

            // Si el empleado del usuario no tiene área, seguir de largo con
            // area_id = null hace que la validación de "empleados de otra
            // área" más abajo compare contra NULL y de un 403 con un mensaje
            // que no tiene que ver con el problema real.
            if (!$user->employee->area_id) {
                abort(403, 'Tu usuario no tiene un área asignada. Pide a un administrador que te asigne una antes de programar turnos.');
            }

            $validated['area_id'] = $user->employee->area_id;
        }

        // Cierra el hueco para cualquier otro rol que llegue a tener
        // "programaciones.crear" en el futuro: sin esto, bastaba con mandar
        // cualquier area_id (solo se validaba que existiera) para crear
        // programaciones en un área ajena.
        $this->ensureAreaAcces((int) $validated['area_id']);

        if (!empty($validated['duration'])) {
            $expectedEndDate = Carbon::parse($validated['start_date'])
                ->addDays((int) $validated['duration'] - 1)
                ->toDateString();

            if ($validated['end_date'] !== $expectedEndDate) {
                return back()
                    ->withErrors(['duration' => 'El rango de fechas no coincide con la duración seleccionada.'])
                    ->withInput();
            }
        }

        // whereNull explícito: "area_id != X" en SQL excluye las filas con
        // area_id NULL (no es ni verdadero ni falso), así que un empleado sin
        // área asignada pasaba este chequeo sin querer.
        $employeesOutsideArea = Employee::whereIn('uid', $validated['employees'])
            ->where(function ($q) use ($validated) {
                $q->whereNull('area_id')->orWhere('area_id', '!=', $validated['area_id']);
            })
            ->exists();

        if ($employeesOutsideArea) {
            abort(403, 'No puedes programar empleados de otra área');
        }

        // Turnos específicos por día definidos al crear (aplican a todos los empleados del lote)
        $dayOverrides = json_decode(
            $validated['day_overrides'] ?? '{}',
            true
        );

        // Creacion del codigo de grupo

        $groupCode = $validated['group_code'] ?? null;

        if (empty($groupCode)) {
            $lastGroup = Programations::where('group_code', 'like', 'ParCafe%')
                ->orderByDesc('id')
                ->value('group_code');

            $next = 1;
            if ($lastGroup && preg_match('/ParCafe(\d+)/', $lastGroup, $m)) {
                $next = ((int) $m[1]) + 1;
            }

            $groupCode = sprintf('ParCafe%02d', $next);
        }


        //Crear Programaciones

        // Todo el lote se guarda como una sola unidad: si un empleado a mitad del lote falla
        // (calendario/puesto ya no pertenece al área, etc.), se revierte TODO en vez de dejar
        // programaciones a medio crear para unos empleados sí y otros no. Además se serializa
        // por área (withAreaLock): sin esto, dos requests concurrentes para la MISMA área (dos
        // coordinadores, o un doble-submit) podrían leer "puesto libre" ambos antes de que
        // cualquiera escriba, y terminar los dos asignando el mismo puesto el mismo día — el
        // lock hace que el segundo espere a que el primero termine antes de leer nada.
        [$skippedEmployees, $skippedForPositionConflict, $replacedDaysTotal, $positionConflictDaysTotal] = $this->withAreaLock((int) $validated['area_id'], function () use ($validated, $dayOverrides, $groupCode) {
            return DB::transaction(function () use ($validated, $dayOverrides, $groupCode) {
            $skippedEmployees = [];
            $skippedForPositionConflict = [];
            $replacedDaysTotal = 0;
            $positionConflictDaysTotal = 0;

            // Mapa día -> puesto -> empleado que lo ocupa, precalculado con UNA sola query
            // para todo el área/rango en vez de una query por día por empleado (antes
            // positionTakenByOther() consultaba la BD por cada día de cada empleado del
            // lote — con 50 empleados x varios días eso eran cientos de queries). Se
            // actualiza en memoria conforme el propio lote va asignando puestos, para
            // que dos empleados de ESTE MISMO lote tampoco choquen entre sí.
            $occupiedByDayAndPosition = $this->loadOccupiedPositions(
                (int) $validated['area_id'],
                $validated['start_date'],
                $validated['end_date']
            );

            foreach ($validated['employees'] as $employeeUid) {

                // 1 Datos base (compartidos por todo el lote)
                $calendarId = $validated['calendar_id'];
                $workPositionId = $validated['work_position_id'] ?? null;
                $startDate = $validated['start_date'];
                $endDate = $validated['end_date'];
                $workDays = $validated['work_days'] ?? null;

                // 3 Obtener calendario REAL (DE AQUÍ SALE TYPE)
                $calendar = calendars::where('id', $calendarId)
                    ->where('area_id', $validated['area_id'])
                    ->firstOrFail();

                // 4 Validar puesto contra área
                if ($workPositionId) {
                    WorkPosition::where('id', $workPositionId)
                        ->where('area_id', $validated['area_id'])
                        ->firstOrFail();
                }

                // 5 Días reales que cubre este lote para este empleado
                $newDays = $this->coveredDates($startDate, $endDate, $workDays);

                // 5b Un puesto solo puede tener UN empleado activo por día: si otro empleado ya
                // lo ocupa ese día, ese día puntual se descarta para este lote (no se crea
                // duplicado ni se le quita el puesto al que ya lo tenía).
                $hadDaysBeforePositionCheck = !empty($newDays);
                if ($workPositionId) {
                    $conflictDays = array_filter(
                        $newDays,
                        fn ($day) => isset($occupiedByDayAndPosition[$day][$workPositionId])
                            && $occupiedByDayAndPosition[$day][$workPositionId] !== $employeeUid
                    );
                    if (!empty($conflictDays)) {
                        $positionConflictDaysTotal += count($conflictDays);
                        $newDays = array_values(array_diff($newDays, $conflictDays));
                    }
                }

                if (empty($newDays)) {
                    if ($hadDaysBeforePositionCheck) {
                        $skippedForPositionConflict[] = $employeeUid;
                    } else {
                        $skippedEmployees[] = $employeeUid;
                    }
                    continue;
                }

                // 6 ¿Alguno de esos días ya estaba cubierto por otra programación
                // activa del mismo empleado EN ESTA MISMA ÁREA? En vez de rechazar
                // todo el lote por el choque (como antes), se reemplaza el turno de
                // ESE día puntual mediante una excepción — el resto del rango de la
                // fila vieja queda intacto. Se restringe a la misma área a propósito:
                // si el empleado cambió de área, sus filas viejas de la otra área no
                // deben pisarse con el calendar_id/work_position_id de esta área —
                // esos días quedan como "frescos" y crean una fila nueva aquí abajo.
                $existingProgramations = Programations::where('employee_uid', $employeeUid)
                    ->where('area_id', $validated['area_id'])
                    ->where('status', '!=', 'Cancelado')
                    ->where(function ($q) use ($startDate, $endDate) {
                        $q->whereBetween('start_date', [$startDate, $endDate])
                            ->orWhereBetween('end_date', [$startDate, $endDate])
                            ->orWhere(function ($q2) use ($startDate, $endDate) {
                                $q2->where('start_date', '<=', $startDate)
                                    ->where('end_date', '>=', $endDate);
                            });
                    })
                    ->get();

                $dayToExistingProgramation = [];
                foreach ($existingProgramations as $existingProgramation) {
                    $existingDays = $this->coveredDates(
                        $existingProgramation->start_date->toDateString(),
                        $existingProgramation->end_date->toDateString(),
                        $existingProgramation->work_days
                    );
                    foreach ($existingDays as $day) {
                        if (in_array($day, $newDays, true)) {
                            $dayToExistingProgramation[$day] = $existingProgramation;
                        }
                    }
                }

                // 7 Días que ya estaban cubiertos: reemplazar vía excepción puntual
                foreach ($dayToExistingProgramation as $day => $existingProgramation) {
                    $this->upsertOverride($existingProgramation->id, $day, $validated['area_id'], $calendarId, $workPositionId);
                    $replacedDaysTotal++;
                }

                // 8 Días frescos (sin choque): crear programación(es) nueva(s),
                // agrupadas en rangos continuos porque una fila solo admite un
                // rango simple de start_date/end_date.
                $freshDays = array_values(array_diff($newDays, array_keys($dayToExistingProgramation)));
                sort($freshDays);

                foreach ($this->toContiguousDateRanges($freshDays) as $range) {
                    $newProgramation = Programations::create([
                        'employee_uid' => $employeeUid,
                        'type' => $calendar->shift_type,
                        'area_id' => $validated['area_id'],
                        'calendar_id' => $calendarId,
                        'work_position_id' => $workPositionId,
                        'start_date' => $range['start'],
                        'end_date' => $range['end'],
                        'status' => 'Programado',
                        'group_code' => $groupCode,
                        'work_days' => $workDays,
                    ]);

                    // 9 Turnos específicos por día (excepciones puntuales definidas al crear)
                    if (!empty($dayOverrides) && is_array($dayOverrides)) {
                        $this->applyDayOverrides($newProgramation, $dayOverrides, $validated['area_id'], $range['start'], $range['end']);
                    }
                }

                // Reflejar en el mapa en memoria que este empleado ya ocupa el puesto en TODOS
                // los días que terminó cubriendo este lote (reemplazados y frescos por igual),
                // para que el siguiente empleado del mismo lote también choque contra esto —
                // mismo efecto que antes tenía consultar la BD en vivo por cada empleado.
                if ($workPositionId) {
                    foreach ($newDays as $day) {
                        $occupiedByDayAndPosition[$day][$workPositionId] = $employeeUid;
                    }
                }
            }

            return [$skippedEmployees, $skippedForPositionConflict, $replacedDaysTotal, $positionConflictDaysTotal];
            });
        });


        if (!empty($skippedEmployees)) {
            $skippedNames = Employee::whereIn('uid', $skippedEmployees)->pluck('name')->implode(', ');

            return redirect()
                ->route('programaciones')
                ->with('warning', "⚠️ Se omitieron " . count($skippedEmployees) . " empleado(s): el rango de fechas no cubre ningún día real: {$skippedNames}");
        }

        if (!empty($skippedForPositionConflict)) {
            $skippedNames = Employee::whereIn('uid', $skippedForPositionConflict)->pluck('name')->implode(', ');

            return redirect()
                ->route('programaciones')
                ->with('warning', "⚠️ Se omitieron " . count($skippedForPositionConflict) . " empleado(s) porque el puesto ya estaba ocupado por otro empleado en todos esos días: {$skippedNames}");
        }

        if ($positionConflictDaysTotal > 0) {
            return redirect()
                ->route('programaciones')
                ->with('warning', "⚠️ Programación creada, pero {$positionConflictDaysTotal} día(s) no se asignaron porque el puesto ya estaba ocupado por otro empleado ese día (un puesto solo admite un empleado por día).");
        }

        if ($replacedDaysTotal > 0) {
            return redirect()
                ->route('programaciones')
                ->with('success', "✅ Programación creada correctamente ({$replacedDaysTotal} día(s) reemplazaron una programación existente).");
        }

        return redirect()
            ->route('programaciones')
            ->with('success', '✅ Programación creada correctamente');
    }

    /**
     * Serializa cualquier escritura de programación para UNA MISMA área usando un lock de
     * aplicación de MySQL (GET_LOCK): mientras un request tiene el lock de un área, cualquier
     * otro request para esa misma área espera. Cierra la ventana de carrera "leer puesto
     * libre -> escribir" entre dos requests concurrentes (dos coordinadores de la misma área,
     * o un doble-submit del mismo) — sin esto, ambos podían leer "libre" antes de que
     * cualquiera insertara, y los dos terminaban asignando el mismo puesto el mismo día.
     * Áreas distintas no se bloquean entre sí (el nombre del lock incluye el area_id).
     */
    private function withAreaLock(int $areaId, \Closure $callback)
    {
        $lockName = "programations_area_{$areaId}";

        // Hasta 10s esperando el lock antes de desistir (evita que un request cuelgue
        // indefinidamente si algo más se queda pegado sosteniendo el lock).
        $acquired = DB::selectOne('SELECT GET_LOCK(?, 10) AS acquired', [$lockName]);

        if (!$acquired || (int) $acquired->acquired !== 1) {
            abort(423, 'Esta área está siendo modificada por otro usuario en este momento. Intenta de nuevo en unos segundos.');
        }

        try {
            return $callback();
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) AS released', [$lockName]);
        }
    }

    /**
     * Mapa día ISO -> work_position_id -> employee_uid que lo ocupa, para TODAS las
     * programaciones activas del área que tocan el rango [startDate, endDate]. Reemplaza a
     * consultar la BD día por día por empleado (antes positionTakenByOther() hacía eso, una
     * query por cada combinación día/empleado del lote — cientos de queries para un lote
     * grande): con esto basta UNA query para todo el lote, sin importar cuántos empleados o
     * días cubra. Considera tanto el puesto de la fila como la excepción puntual de ese día
     * (una excepción que solo cambió el turno no trae puesto propio y ahí se sigue mirando el
     * de la fila) — mismo criterio que getWorkPositionIdForDay() en el frontend.
     */
    private function loadOccupiedPositions(int $areaId, string $startDate, string $endDate): array
    {
        $candidates = Programations::where('area_id', $areaId)
            ->where('status', '!=', 'Cancelado')
            ->whereNotNull('work_position_id')
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate)
            ->with(['overrides' => fn ($q) => $q->whereBetween('date', [$startDate, $endDate])])
            ->get();

        $occupiedByDayAndPosition = [];

        foreach ($candidates as $candidate) {
            $overridesByDate = $candidate->overrides->keyBy('date');

            foreach ($this->coveredDates($candidate->start_date->toDateString(), $candidate->end_date->toDateString(), $candidate->work_days) as $day) {
                if ($day < $startDate || $day > $endDate) {
                    continue;
                }

                $override = $overridesByDate->get($day);
                $effectiveWorkPositionId = ($override && $override->work_position_id !== null)
                    ? $override->work_position_id
                    : $candidate->work_position_id;

                if ($effectiveWorkPositionId !== null) {
                    $occupiedByDayAndPosition[$day][(int) $effectiveWorkPositionId] = $candidate->employee_uid;
                }
            }
        }

        return $occupiedByDayAndPosition;
    }

    /**
     * Agrupa fechas ISO ordenadas en rangos de días calendario consecutivos
     * (una fila de Programations solo admite un rango simple start/end).
     */
    private function toContiguousDateRanges(array $sortedDates): array
    {
        if (empty($sortedDates)) {
            return [];
        }

        $ranges = [];
        $start = $sortedDates[0];
        $prev = $sortedDates[0];

        for ($i = 1; $i < count($sortedDates); $i++) {
            $current = $sortedDates[$i];
            $expectedNext = Carbon::parse($prev)->addDay()->toDateString();

            if ($current === $expectedNext) {
                $prev = $current;
                continue;
            }

            $ranges[] = ['start' => $start, 'end' => $prev];
            $start = $current;
            $prev = $current;
        }

        $ranges[] = ['start' => $start, 'end' => $prev];

        return $ranges;
    }

    /**
     * ===========================================
     *
     *  Editar una programación existente
     *
     * ===========================================
     */

    public function update(Request $request, Programations $programation)
    {
        $this->ensureAreaAcces((int) $programation->area_id);

        $validated = $request->validate([
            'calendar_id' => 'required|exists:calendars,id',
            'work_position_id' => 'nullable|exists:work_positions,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'work_days' => 'nullable|array',
            'work_days.*' => 'integer|between:1,7',
        ]);

        // El calendario debe pertenecer al área de la programación
        $calendar = calendars::where('id', $validated['calendar_id'])
            ->where('area_id', $programation->area_id)
            ->firstOrFail();

        // El puesto (si viene) debe pertenecer al área
        if (!empty($validated['work_position_id'])) {
            WorkPosition::where('id', $validated['work_position_id'])
                ->where('area_id', $programation->area_id)
                ->firstOrFail();
        }

        // Días solapados con OTRAS programaciones activas del mismo empleado en esta área:
        // en vez de rechazar la edición completa (como antes), se reemplaza el turno de
        // ESOS días puntuales mediante una excepción — mismo criterio que store(), para que
        // ambos flujos se comporten igual ante un choque de horarios. Ambos pasos (reemplazar
        // overrides + actualizar la fila) van en una transacción, y todo el bloque se
        // serializa por área (withAreaLock) para no correr al mismo tiempo que un store()/
        // update() concurrente sobre la misma área — mismo motivo que en store().
        $replacedDaysTotal = $this->withAreaLock((int) $programation->area_id, function () use ($programation, $validated, $calendar) {
            return DB::transaction(function () use ($programation, $validated, $calendar) {
            // Un puesto de trabajo solo puede tener UN empleado activo por día — mismo
            // chequeo que store() (loadOccupiedPositions), ausente aquí hasta ahora: sin
            // esto, editar una programación podía asignarle a un empleado un puesto que otro
            // empleado YA tiene ocupado ese mismo día, sin ningún aviso. Se hace DENTRO del
            // lock de área (igual que la revalidación de saldo en EmployeeAbsenceController)
            // para que no quede stale frente a un store()/update() concurrente sobre la
            // misma área.
            if (!empty($validated['work_position_id'])) {
                $occupiedByDayAndPosition = $this->loadOccupiedPositions(
                    (int) $programation->area_id,
                    $validated['start_date'],
                    $validated['end_date']
                );
                $newDays = $this->coveredDates($validated['start_date'], $validated['end_date'], $validated['work_days'] ?? null);
                $conflictDays = array_filter(
                    $newDays,
                    fn ($day) => isset($occupiedByDayAndPosition[$day][$validated['work_position_id']])
                        && $occupiedByDayAndPosition[$day][$validated['work_position_id']] !== $programation->employee_uid
                );
                if (!empty($conflictDays)) {
                    $conflictDay = reset($conflictDays);
                    $conflictName = Employee::where('uid', $occupiedByDayAndPosition[$conflictDay][$validated['work_position_id']])->value('name');
                    abort(422, "Ese puesto ya está ocupado por {$conflictName} el {$conflictDay}.");
                }
            }

            $replacedDaysTotal = $this->replaceOverlappingDays(
                $programation->employee_uid,
                (int) $programation->area_id,
                $validated['start_date'],
                $validated['end_date'],
                $validated['work_days'] ?? null,
                (int) $validated['calendar_id'],
                $validated['work_position_id'] ?? null,
                $programation->id
            );

            $programation->update([
                'calendar_id' => $validated['calendar_id'],
                'type' => $calendar->shift_type,
                'work_position_id' => $validated['work_position_id'] ?? null,
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'work_days' => $validated['work_days'] ?? null,
            ]);

            return $replacedDaysTotal;
            });
        });

        // NOTA: ningún caller en el frontend consume "programations.update" todavía (no hay
        // modal de edición cableado a este endpoint) — replaced_days_total queda listo para
        // cuando exista, con el mismo criterio de aviso que store() ya expone vía flash
        // 'warning'. Se envía como campo propio de la respuesta (no vía setAttribute() sobre
        // el modelo, que lo mezclaba de forma confusa con los atributos reales de Programation).
        return response()->json([
            'programation' => $programation->fresh()->load(['calendar', 'area', 'employee']),
            'replaced_days_total' => $replacedDaysTotal,
        ]);
    }

    /**
     * ===========================================
     *
     *  Días en los que un empleado ya tiene otra programación activa que se
     *  solapa con el rango dado: en vez de rechazar, se reemplaza el turno de
     *  ESOS días puntuales mediante una excepción (ProgramationOverride) sobre
     *  la programación vieja — mismo criterio que el bloque 6-7 de store().
     *  Devuelve el total de días reemplazados.
     *
     * ===========================================
     */

    private function replaceOverlappingDays(
        string $employeeUid,
        int $areaId,
        string $startDate,
        string $endDate,
        ?array $workDays,
        int $calendarId,
        ?int $workPositionId,
        ?int $excludeProgramationId = null
    ): int {
        // 1) Candidatas: mismo empleado, MISMA ÁREA (una fila vieja de una área
        // anterior del empleado no debe pisarse con esta edición), mismo rango
        // de fechas tocado (chequeo barato en SQL).
        $candidates = Programations::where('employee_uid', $employeeUid)
            ->where('area_id', $areaId)
            ->where('status', '!=', 'Cancelado')
            ->when($excludeProgramationId, fn ($q) => $q->where('id', '!=', $excludeProgramationId))
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($q2) use ($startDate, $endDate) {
                        $q2->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            })
            ->get();

        if ($candidates->isEmpty()) {
            return 0;
        }

        // 2) Solapamiento real: dos rangos solo chocan si comparten al menos un dia
        // concreto una vez aplicado el patron de dias laborales de cada uno
        // (work_days = null equivale a "todos los dias del rango").
        $newDays = $this->coveredDates($startDate, $endDate, $workDays);

        $replacedDaysTotal = 0;

        foreach ($candidates as $candidate) {
            $existingDays = $this->coveredDates(
                $candidate->start_date->toDateString(),
                $candidate->end_date->toDateString(),
                $candidate->work_days
            );

            $overlapDays = array_intersect($newDays, $existingDays);

            foreach ($overlapDays as $day) {
                $this->upsertOverride($candidate->id, $day, $areaId, $calendarId, $workPositionId);
                $replacedDaysTotal++;
            }
        }

        return $replacedDaysTotal;
    }

    /**
     * Fechas ISO ('YYYY-MM-DD') cubiertas por un rango, respetando work_days
     * (null o vacio = todos los dias del rango).
     */
    private function coveredDates(string $startDate, string $endDate, ?array $workDays): array
    {
        $dates = [];
        $cursor = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        while ($cursor->lte($end)) {
            if (empty($workDays) || in_array($cursor->dayOfWeekIso, $workDays, true)) {
                $dates[] = $cursor->toDateString();
            }
            $cursor->addDay();
        }

        return $dates;
    }

    /**
     * ===========================================
     *
     *  Crea los overrides de turno por día definidos
     *  al momento de crear una programación. Ignora
     *  silenciosamente fechas fuera de rango o turnos
     *  que no pertenezcan al área.
     *
     * ===========================================
     */

    /**
     * ===========================================
     *
     *  Único punto de entrada para crear/actualizar un ProgramationOverride:
     *  centraliza la garantía de que calendar_id y work_position_id (si viene)
     *  pertenezcan al área dada, para que un futuro call site no pueda olvidar
     *  ese chequeo como pasaba antes, repetido a mano en cada sitio.
     *
     * ===========================================
     */

    private function upsertOverride(int $programationId, string $date, int $areaId, int $calendarId, ?int $workPositionId, bool $touchWorkPosition = true): ProgramationOverride
    {
        $calendar = calendars::where('id', $calendarId)
            ->where('area_id', $areaId)
            ->firstOrFail();

        if ($workPositionId) {
            WorkPosition::where('id', $workPositionId)
                ->where('area_id', $areaId)
                ->firstOrFail();
        }

        $values = ['calendar_id' => $calendar->id];
        if ($touchWorkPosition) {
            $values['work_position_id'] = $workPositionId;
        }

        return ProgramationOverride::updateOrCreate(
            ['programation_id' => $programationId, 'date' => $date],
            $values
        );
    }

    private function applyDayOverrides(Programations $programation, array $dayOverrides, int $areaId, string $startDate, string $endDate): void
    {
        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->endOfDay();

        foreach ($dayOverrides as $date => $calendarId) {
            if (!$calendarId) {
                continue;
            }

            $parsedDate = Carbon::parse($date)->startOfDay();

            if (!$parsedDate->betweenIncluded($start, $end)) {
                continue;
            }

            $calendar = calendars::where('id', $calendarId)
                ->where('area_id', $areaId)
                ->first();

            if (!$calendar) {
                continue;
            }

            ProgramationOverride::create([
                'programation_id' => $programation->id,
                'date' => $parsedDate->toDateString(),
                'calendar_id' => $calendar->id,
            ]);
        }
    }

    /**
     * ============================
     *
     * Filtro de empleados + contrato
     *
     * ============================
     */

    public function getEmployeesFiltered(Request $request)
    {
        $request->validate([
            'area_id' => 'required|integer',
            'contrato_id' => 'nullable|integer',
            'work_position_id' => 'nullable|exists:work_positions,id',
        ]);

        $this->ensureAreaAcces((int) $request->area_id);

        $query = Employee::query();

        // Filtro por área (OBLIGATORIO)
        $query->where('area_id', $request->area_id);

        // Filtro por contrato (SOLO si viene seleccionado)
        if (!empty($request->contrato_id)) {
            $query->where('contrato_id', $request->contrato_id);
        }

        return response()->json(
            $query
                ->with(['cargo', 'contrato'])
                ->orderBy('name')
                ->get()
        );
    }

    /**
     * ===========================
     * 
     *  Busqueda por area
     * 
     * ===========================
     */

    public function getEmployeesAreaFiltered(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|exists:areas,id',
            'contrato_id' => 'nullable|exists:contrato,id',
            'search' => 'nullable|string|max:255',
            'limit' => 'nullable|integer|min:1|max:200'
        ]);

        $this->ensureAreaAcces((int) $validated['area_id']);

        $query = Employee::query()
            ->where('area_id', $validated['area_id']); // -> Restringe el area seleccionada

        // filtro por contrato (Opcional)
        if (!empty($validated['contrato_id'])) {
            $query->where('contrato_id', $validated['contrato_id']);
        }

        // Busqueda solo dentro del area
        if (!empty($validated['search'])) {
            $search = $validated['search'];

            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('uid', 'LIKE', "{$search}%");
            });
        }

        // Retorno del filtro en json 
        return response()->json([
            $query
                ->select('uid', 'name', 'area_id', 'contrato_id')
                ->with(['contrato:id,name'])
                ->orderBy('name')
                ->limit($validated['limit'] ?? 50)
                ->get()
        ]);
    }

    /**
     * ==========================================================
     *
     *  Acceso de SOLO LECTURA a la programación de un área.
     *  aux_admin_th y aux_th pueden consultar lo que subieron los
     *  coordinadores de CUALQUIER área (para el filtro de áreas
     *  en /programaciones); el resto de roles conserva la
     *  restricción a su propia área definida en ensureAreaAcces.
     *
     * ==========================================================
     */

    private function ensureAreaViewAccess(int $areaId): void
    {
        $user = auth()->user();

        if ($user->hasRole('aux_admin_th') || $user->hasRole('aux_th')) {
            return;
        }

        $this->ensureAreaAcces($areaId);
    }

    /**
     * ==========================================================
     * 
     *  Metodo ShowByArea
     * 
     * ==========================================================
     */

    public function showByArea(int $area)
    {
        $this->ensureAreaViewAccess($area);

        $areaModel = area::findOrFail($area);

        return Inertia::render('Programations/DetailsProgramations', [
            'areaId' => $areaModel->id,
            'areaName' => $areaModel->nombre,
            'currentRouteName' => 'areas',
        ]);
    }
}
