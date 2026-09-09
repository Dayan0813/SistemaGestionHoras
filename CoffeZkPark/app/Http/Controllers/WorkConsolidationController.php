<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\area;
use App\Models\Employee;
use App\Models\WorkConsolidation;
use App\Services\ConsolidationEngine;
use Carbon\Carbon;
use Illuminate\Http\Request;

class WorkConsolidationController extends Controller
{
    use EnsuresAreaAccess;

    protected ConsolidationEngine $engine;

    // ================================
    // Constructor se encarga para la iyeccion de dependencias de servicios
    // ================================

    public function __construct(ConsolidationEngine $engine)
    {
        $this->engine = $engine;
    }

    // Manejo de props para index

    public function indexPage()
    {
        // Todo el que no sea admin queda limitado a su propia área (mismo
        // criterio que Programaciones/Calendarios/Puestos): antes esta
        // pantalla mostraba empleados y consolidados de TODA la empresa.
        $user = auth()->user();
        $areaId = $user->hasRole('admin') ? null : $user->employee?->area_id;

        if (!$user->hasRole('admin') && !$areaId) {
            abort(403, 'Usuario sin empleado asociado');
        }

        $employees = Employee::with('area:id,nombre')
            ->when($areaId, fn($q) => $q->where('area_id', $areaId))
            ->select('uid', 'name', 'area_id')
            ->orderBy('name')
            ->get();

        $areas = area::select('id', 'nombre')
            ->when($areaId, fn($q) => $q->where('id', $areaId))
            ->orderBy('nombre')
            ->get();

        // Paginación de consolidaciones
        $recordsPaginator = WorkConsolidation::orderBy('id', 'desc')
            ->when($areaId, fn($q) => $q->whereHas('employee', fn($eq) => $eq->where('area_id', $areaId)))
            ->Paginate(10);

        // ================================
        // Inicializar acumuladores globales
        // ================================
        $globalTotals = [
            'ordinary_day'           => 0,
            'ordinary_night'         => 0,
            'ordinary_festive_day'   => 0,
            'ordinary_festive_night' => 0,
            'extra_day'              => 0,
            'extra_night'            => 0,
            'extra_festive_day'      => 0,
            'extra_festive_night'    => 0,
            'unplanned'              => 0,
            'total_general'          => 0,
            'scheduled_hours'        => 0,
        ];

        // ================================
        // Transformar registros y sumar totales
        // ================================
        $consolidatedRecords = $recordsPaginator->through(function ($record) use (&$globalTotals) {

            $hours = [
                'ordinary_day'           => $record->ordinary_day,
                'ordinary_night'         => $record->ordinary_night,
                'ordinary_festive_day'   => $record->ordinary_festive_day,
                'ordinary_festive_night' => $record->ordinary_festive_night,
                'extra_day'              => $record->extra_day,
                'extra_night'            => $record->extra_night,
                'extra_festive_day'      => $record->extra_festive_day,
                'extra_festive_night'    => $record->extra_festive_night,
                'unplanned'              => $record->unplanned,
            ];

            // Total por registro, Excluimos Unplanned
            $total_hours = array_sum($hours) - $hours['unplanned'];

            // ==== SUMAS GLOBALES ====
            foreach ($hours as $key => $value) {
                $globalTotals[$key] += $value;
            }

            $globalTotals['total_general'] += $total_hours;
            $globalTotals['scheduled_hours'] += $record->scheduled_hours;

            // ==== DEVOLVER REGISTRO TRANSFORMADO ====
            return [
                'id'              => $record->id,
                'employee_uid'    => $record->employee_uid,
                'week_start'      => $record->week_start,
                'week_end'        => $record->week_end,
                'scheduled_hours' => $record->scheduled_hours,
                'hours'           => $hours,
                'total_hours'     => $total_hours,
                // Marcado - programado: positivo = trabajó más de lo programado (extras/no
                // programado), negativo = trabajó menos de lo que debía.
                'hours_difference' => round($total_hours - $record->scheduled_hours, 2),
                'payload'         => $record->daily_breakdown,
            ];
        });

        // Enviar todo a React
        return inertia('WorkConsolidation/Index', [
            'employees'        => $employees,
            'areas'            => $areas,
            'consolidado'      => $consolidatedRecords,
            'totales_globales' => $globalTotals, // 👈 sumatorias listas para renderizar
            'currentRouteName' => 'consolidations',
        ]);
    }


    // Generator de las facturas

    public function generator()
    {
        $user = auth()->user();
        $areaId = $user->hasRole('admin') ? null : $user->employee?->area_id;

        if (!$user->hasRole('admin') && !$areaId) {
            abort(403, 'Usuario sin empleado asociado');
        }

        $employees = Employee::with('area:id,nombre')
            ->when($areaId, fn($q) => $q->where('area_id', $areaId))
            ->select('uid', 'name', 'area_id')
            ->orderBy('name')
            ->get();

        $areas = area::select('id', 'nombre')
            ->when($areaId, fn($q) => $q->where('id', $areaId))
            ->orderBy('nombre')
            ->get();

        return inertia('WorkConsolidation/Generator', [
            'employees' => $employees,
            'areas'     => $areas,
            'currentRouteName' => 'consolidations',
        ]);
    }

    /* =======================================================
     *  CONSOLIDADO DE SOLO LECTURA POR EMPLEADO
     *  (no persiste nada en work_consolidations; eso lo hace
     *  generateBulk/generateAndStore bajo el permiso "generar")
     * ======================================================= */

    // Semana que contiene la fecha indicada (o la semana actual)

    public function weekly(Request $request, string $uid)
    {
        $employee = Employee::where('uid', $uid)->firstOrFail();
        $this->ensureAreaAcces((int) $employee->area_id);

        $validated = $request->validate([
            'date' => 'nullable|date',
        ]);

        $anchor = isset($validated['date']) ? Carbon::parse($validated['date']) : Carbon::now();
        $from = $anchor->copy()->startOfWeek();
        $to = $anchor->copy()->endOfWeek();

        return response()->json($this->engine->consolidate($uid, $from, $to));
    }

    // Mes indicado (o el mes actual)

    public function monthly(Request $request, string $uid)
    {
        $employee = Employee::where('uid', $uid)->firstOrFail();
        $this->ensureAreaAcces((int) $employee->area_id);

        $validated = $request->validate([
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
        ]);

        $anchor = Carbon::create($validated['year'] ?? now()->year, $validated['month'] ?? now()->month, 1);
        $from = $anchor->copy()->startOfMonth();
        $to = $anchor->copy()->endOfMonth();

        return response()->json($this->engine->consolidate($uid, $from, $to));
    }

    // Rango de fechas libre

    public function range(Request $request, string $uid)
    {
        $employee = Employee::where('uid', $uid)->firstOrFail();
        $this->ensureAreaAcces((int) $employee->area_id);

        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($validated['from'])->startOfDay();
        $to = Carbon::parse($validated['to'])->endOfDay();

        return response()->json($this->engine->consolidate($uid, $from, $to));
    }

    // Funcion Bulk

    public function generateBulk(Request $request)
    {
        $validated = $request->validate([
            'mode'          => 'required|in:persona,area,universal',
            'employee_uid'  => 'nullable|string',
            'area_id'       => 'nullable|integer|exists:areas,id',
            'from'          => 'required|date',
            'to'            => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($validated['from'])->startOfDay();
        $to   = Carbon::parse($validated['to'])->endOfDay();

        $mode = $validated['mode'];

        // ==========================================================
        // 1. Validar que el usuario tenga acceso al alcance pedido
        //    (mismas reglas que Programaciones/Calendarios/Puestos:
        //    todo el que no sea admin queda limitado a su propia área)
        // ==========================================================

        if ($mode === 'universal' && !auth()->user()->hasRole('admin')) {
            abort(403, 'Solo un administrador puede generar el consolidado universal.');
        }

        if ($mode === 'area') {
            if (!$validated['area_id']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe seleccionar un área'
                ], 422);
            }
            $this->ensureAreaAcces((int) $validated['area_id']);
        }

        if ($mode === 'persona') {
            if (!$validated['employee_uid']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe seleccionar un empleado'
                ], 422);
            }

            $targetEmployee = Employee::where('uid', $validated['employee_uid'])->first();

            if (!$targetEmployee) {
                return response()->json([
                    'success' => false,
                    'message' => 'El empleado seleccionado no existe.'
                ], 404);
            }

            $this->ensureAreaAcces((int) $targetEmployee->area_id);
        }

        // ==========================================================
        // 2. Determinar empleados a procesar según el modo
        // ==========================================================

        if ($mode === 'persona') {
            $uids = [$validated['employee_uid']];
        } elseif ($mode === 'area') {
            $uids = Employee::where('area_id', $validated['area_id'])
                ->pluck('uid')
                ->toArray();
        } else { // universal
            $uids = Employee::pluck('uid')->toArray();
        }

        if (empty($uids)) {
            return response()->json([
                'success' => false,
                'message' => 'No hay empleados para procesar.'
            ], 404);
        }

        // ==========================================================
        // 3. Ejecutar tu motor para cada empleado usando generateAndStore()
        // ==========================================================

        $processed = [];

        foreach ($uids as $uid) {
            $response = $this->generateAndStore($uid, $from, $to);

            // generateAndStore() retorna un JSON Response → extraemos el contenido
            $processed[] = json_decode($response->getContent(), true);
        }

        // ==========================================================
        // 4. Respuesta ligera para el frontend
        // ==========================================================

        return response()->json([
            'success' => true,
            'processed_count' => count($processed),
            'range' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString()
            ],
            'results' => $processed
        ]);
    }

    /* =======================================================
     *  FUNCIÓN ÚNICA PARA GENERAR Y GUARDAR CONSOLIDADO
     * ======================================================= */
    private function generateAndStore(string $employeeUid, Carbon $from, Carbon $to)
    {
        $result = $this->engine->consolidate($employeeUid, $from, $to);
        $t = $result['totals'];

        // remplazar si ya existe
        $record = WorkConsolidation::updateOrCreate(
            [
                'employee_uid' => $employeeUid,
                'week_start'   => $from->toDateString(),
                'week_end'     => $to->toDateString(),
            ],
            [
                'scheduled_hours'       => $result['scheduled_hours'],

                'ordinary_day'          => $t['ordinary_day'],
                'ordinary_night'        => $t['ordinary_night'],
                'ordinary_festive_day'  => $t['ordinary_festive_day'],
                'ordinary_festive_night' => $t['ordinary_festive_night'],

                'extra_day'             => $t['extra_day'],
                'extra_night'           => $t['extra_night'],
                'extra_festive_day'     => $t['extra_festive_day'],
                'extra_festive_night'   => $t['extra_festive_night'],

                'unplanned'             => $t['unplanned'],

                'daily_breakdown'       => $result['days'],
            ]
        );

        return response()->json([
            'success'   => true,
            'stored_id' => $record->id,
            'range'     => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString()
            ],
            'data'      => $result
        ]);
    }
}
