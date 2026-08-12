<?php

namespace App\Http\Controllers;

use App\Models\User;
use Auth;
use Illuminate\Http\Request;
use App\Models\area;
use App\Models\calendars;
use App\Models\WorkPosition;
use App\Models\Contrato as ModelsContrato;
use App\Models\Employee;
use App\Models\ProgramationOverride;
use App\Models\Programations;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProgramationsController extends Controller
{

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
     *  Render detalle de las cards de programaciones
     * 
     * ===========================================
     */

    public function viewDetails()
    {
        return Inertia::render('Programations/DetailsProgramations');
    }

    /**
     * ===========================================
     * 
     *  Guardado de los overrides
     * 
     * ===========================================
     */

    public function saveOverride(Request $request, Programations $programation)
    {
        $this->ensureAreaAcces((int) $programation->area_id);

        $validated = $request->validate([
            'date' => 'required|date',
            'calendar_id' => 'required|exists:calendars,id',
        ]);

        // Validar que la fecha esté dentro del rango de la programacion
        $date = Carbon::parse($validated['date'])->startOfDay();

        $start = Carbon::parse($programation->start_date)->startOfDay();
        $end = Carbon::parse($programation->end_date)->endOfDay();

        if (!$date->betweenIncluded($start, $end)) {
            return response()->json([
                'message' => 'La fecha está fuera del rango de la programación.'
            ], 422);
        }

        // Validar que el calendario pertenezca al área de la programación
        calendars::where('id', $validated['calendar_id'])
            ->where('area_id', $programation->area_id)
            ->firstOrFail();

        // Guardar (upsert)
        $override = ProgramationOverride::updateOrCreate(
            [
                'programation_id' => $programation->id,
                'date' => $validated['date'],
            ],
            [
                'calendar_id' => $validated['calendar_id'],
            ]
        );

        return response()->json($override->load('calendar'));
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

        $employeesAfectados = 0;

        foreach ($validated['dates'] as $date) {
            $programations = Programations::where('area_id', $validated['area_id'])
                ->where('status', '!=', 'Cancelado')
                ->where('start_date', '<=', $date)
                ->where('end_date', '>=', $date)
                ->get();

            foreach ($programations as $programation) {
                ProgramationOverride::updateOrCreate(
                    [
                        'programation_id' => $programation->id,
                        'date' => $date,
                    ],
                    [
                        'calendar_id' => $calendar->id,
                    ]
                );

                $employeesAfectados++;
            }
        }

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
        $this->ensureAreaAcces($areaId);

        $validated = $request->validate([
            'year' => 'required|integer',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $startOfMonth = Carbon::create(
            $validated['year'],
            $validated['month']
        )->startOfMonth()->toDateString();

        $endOfMonth = Carbon::create(
            $validated['year'],
            $validated['month']
        )->endOfMonth()->toDateString();

        $employees = Employee::query()
            ->where('area_id', $areaId)
            ->whereHas('programations', function ($q) use ($startOfMonth, $endOfMonth) {
                $q->where(function ($query) use ($startOfMonth, $endOfMonth) {
                    $query->whereBetween('start_date', [$startOfMonth, $endOfMonth])
                        ->orWhereBetween('end_date', [$startOfMonth, $endOfMonth])
                        ->orWhere(function ($q) use ($startOfMonth, $endOfMonth) {
                            $q->where('start_date', '<=', $endOfMonth)
                                ->where('end_date', '>=', $startOfMonth);
                        });
                });
            })
            ->with([
                'programations' => function ($q) use ($startOfMonth, $endOfMonth) {
                    $q->where(function ($query) use ($startOfMonth, $endOfMonth) {
                        $query->whereBetween('start_date', [$startOfMonth, $endOfMonth])
                            ->orWhereBetween('end_date', [$startOfMonth, $endOfMonth])
                            ->orWhere(function ($q) use ($startOfMonth, $endOfMonth) {
                                $q->where('start_date', '<=', $endOfMonth)
                                    ->where('end_date', '>=', $startOfMonth);
                            });
                    })
                        ->with([
                            'calendar:id,area_id,hora_entrada,hora_salida',
                            'overrides' => function ($oq) use ($startOfMonth, $endOfMonth) {
                                $oq->whereBetween('date', [$startOfMonth, $endOfMonth])
                                    ->with('calendar:id,area_id,hora_entrada,hora_salida');
                            }
                        ]);
                }
            ])
            ->orderBy('name')
            ->get(['uid', 'name']);

        return response()->json($employees);
    }

    /**
     * ===========================================
     * 
     *  Retorno del detalle de la creacion de programaciones
     * 
     * ===========================================
     */

    public function index()
    {
        $user = User::with('employee')->findOrFail(Auth::id());

        // =========================
        // ÁREAS SEGÚN ROL
        // =========================
        $areasQuery = area::query();

        if ($user->hasRole('coordinator')) {
            if (!$user->employee?->area_id) {
                abort(403, 'Usuario sin área asignada');
            }

            $areasQuery->where('id', $user->employee->area_id);
        }

        $areas = $areasQuery
            ->orderBy('nombre')
            ->pluck('nombre', 'id');

        // =========================
        // RESTO IGUAL
        // =========================
        $employees = Employee::all();
        $calendars = calendars::all();
        $programations = Programations::with(['employee', 'calendar', 'area'])->get();
        $contracts = ModelsContrato::orderBy('name')->get(['id', 'name']);

        // Próximos meses
        $currentMonth = Carbon::now()->startOfMonth();
        $months = [];

        for ($i = 0; $i < 5; $i++) {
            $monthDate = $currentMonth->copy()->addMonths($i);
            $months[] = [
                'value' => $monthDate->format('Y-m'),
                'label' => ucfirst($monthDate->locale('es')->translatedFormat('F Y')),
            ];
        }

        // Código de grupo
        $lastGroup = Programations::where('group_code', 'like', 'ParCafe%')
            ->orderByDesc('id')
            ->value('group_code');

        $nextGroupNumber = 1;
        if ($lastGroup && preg_match('/ParCafe(\d+)/', $lastGroup, $m)) {
            $nextGroupNumber = ((int) $m[1]) + 1;
        }

        return Inertia::render('Programations/index', [
            'areas' => $areas,
            'employees' => $employees,
            'calendars' => $calendars,
            'programations' => $programations,
            'months' => $months,
            'nextGroupNumber' => $nextGroupNumber,
            'contracts' => $contracts,
        ]);
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
            'employees' => 'required|array|min:1',
            'employees.*' => 'string|exists:employees,uid',
            'group_code' => 'nullable|string',
            'custom_programations' => 'nullable|string',
        ]);

        // Validacion del area
        if ($user->hasRole('coordinator')) {

            if (!$user->employee) {
                abort(403, 'Usuario sin empleado asociado');
            }

            $validated['area_id'] = $user->employee->area_id;
        }

        $customProgramations = json_decode(
            $validated['custom_programations'] ?? '{}',
            true
        );

        // Creacion del codigo de grupo

        $groupCode = $validated['group_code'];

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

        foreach ($validated['employees'] as $employeeUid) {

            // 1️ Datos base (global)
            $calendarId = $validated['calendar_id'];
            $workPositionId = $validated['work_position_id'] ?? null;
            $startDate = $validated['start_date'];
            $endDate = $validated['end_date'];

            // 2️ Override individual (si existe)
            if (!empty($customProgramations[$employeeUid])) {
                $override = $customProgramations[$employeeUid];

                $calendarId = $override['calendar_id'] ?? $calendarId;
                $workPositionId = $override['work_position_id'] ?? $workPositionId;
                $startDate = $override['start_date'] ?? $startDate;
                $endDate = $override['end_date'] ?? $endDate;
            }

            // 3️ Obtener calendario REAL (DE AQUÍ SALE TYPE)
            $calendar = calendars::where('id', $calendarId)
                ->where('area_id', $validated['area_id'])
                ->firstOrFail();

            // 4️ Validar puesto contra área
            if ($workPositionId) {
                WorkPosition::where('id', $workPositionId)
                    ->where('area_id', $validated['area_id'])
                    ->firstOrFail();
            }

            // 5️ Evitar solapamientos (ignorando programaciones ya canceladas)
            if ($this->hasOverlap($employeeUid, $startDate, $endDate)) {
                continue;
            }

            // 6️⃣ Crear programación CORRECTA
            Programations::create([
                'employee_uid' => $employeeUid,
                'type' => $calendar->shift_type, // 🔥 AQUÍ SE ARREGLA
                'area_id' => $validated['area_id'],
                'calendar_id' => $calendarId,
                'work_position_id' => $workPositionId,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => 'Programado',
                'group_code' => $groupCode,
            ]);
        }


        return redirect()
            ->route('newprogramations')
            ->with('success', '✅ Programación creada correctamente');
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

        // Evitar solapamientos con OTRAS programaciones activas del mismo empleado
        if ($this->hasOverlap($programation->employee_uid, $validated['start_date'], $validated['end_date'], $programation->id)) {
            return response()->json([
                'message' => 'Ya existe otra programación activa para este empleado que se solapa con ese rango de fechas.',
            ], 422);
        }

        $programation->update([
            'calendar_id' => $validated['calendar_id'],
            'type' => $calendar->shift_type,
            'work_position_id' => $validated['work_position_id'] ?? null,
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
        ]);

        return response()->json(
            $programation->fresh()->load(['calendar', 'area', 'employee'])
        );
    }

    /**
     * ===========================================
     *
     *  Cancelar (baja lógica) una programación
     *
     * ===========================================
     */

    public function cancel(Programations $programation)
    {
        $this->ensureAreaAcces((int) $programation->area_id);

        $programation->update(['status' => 'Cancelado']);

        return response()->json($programation);
    }

    /**
     * ===========================================
     *
     *  Verifica si un empleado ya tiene otra programación
     *  activa que se solape con el rango de fechas dado
     *
     * ===========================================
     */

    private function hasOverlap(string $employeeUid, string $startDate, string $endDate, ?int $excludeProgramationId = null): bool
    {
        return Programations::where('employee_uid', $employeeUid)
            ->where('status', '!=', 'Cancelado')
            ->when($excludeProgramationId, fn($q) => $q->where('id', '!=', $excludeProgramationId))
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($q2) use ($startDate, $endDate) {
                        $q2->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            })
            ->exists();
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
     * ==========================================
     * 
     *  HELPER PARA VALIDACIONES
     * 
     * ===========================================
     */

    public function ensureAreaAcces(int $areaId): void
    {
        $user = auth()->user();

        // Admin puede ver todo
        if ($user->hasRole('admin')) {
            return;
        }

        // coordinador SIN empleado -> error

        if (!$user->employee) {
            abort(403, 'Usuario sin empleado asociado');
        }

        // Coordinador SOLO su area
        if ((int) $user->employee->area_id !== (int) $areaId) {
            abort(403);
        }
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
        $this->ensureAreaAcces($area);

        return Inertia::render('Programations/DetailsProgramations', [
            'areaId' => $area,
        ]);
    }
}
