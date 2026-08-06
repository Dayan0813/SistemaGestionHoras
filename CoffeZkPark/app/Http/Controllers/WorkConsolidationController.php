<?php

namespace App\Http\Controllers;

use App\Models\area;
use App\Models\Employee;
use App\Models\WorkConsolidation;
use App\Services\ConsolidationEngine;
use Carbon\Carbon;
use Illuminate\Http\Request;

class WorkConsolidationController extends Controller
{
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
        $employees = Employee::with('area:id,nombre')
            ->select('uid', 'name', 'area_id')
            ->orderBy('name')
            ->get();

        $areas = area::select('id', 'nombre')->orderBy('nombre')->get();

        // Paginación de consolidaciones
        $recordsPaginator = WorkConsolidation::orderBy('id', 'desc')->Paginate(10);

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

            // ==== DEVOLVER REGISTRO TRANSFORMADO ====
            return [
                'id'            => $record->id,
                'employee_uid'  => $record->employee_uid,
                'week_start'    => $record->week_start,
                'week_end'      => $record->week_end,
                'hours'         => $hours,
                'total_hours'   => $total_hours,
                'payload'       => $record->daily_breakdown,
            ];
        });

        // Enviar todo a React
        return inertia('WorkConsolidation/Index', [
            'employees'        => $employees,
            'areas'            => $areas,
            'consolidado'      => $consolidatedRecords,
            'totales_globales' => $globalTotals, // 👈 sumatorias listas para renderizar
        ]);
    }


    // Generator de las facturas

    public function generator()
    {
        $employees = Employee::with('area:id,nombre')
            ->select('uid', 'name', 'area_id')
            ->orderBy('name')
            ->get();

        $areas = area::select('id', 'nombre')->orderBy('nombre')->get();

        return inertia('WorkConsolidation/Generator', [
            'employees' => $employees,
            'areas'     => $areas,
        ]);
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
        // 1. Determinar empleados a procesar según el modo
        // ==========================================================

        if ($mode === 'persona') {
            if (!$validated['employee_uid']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe seleccionar un empleado'
                ], 422);
            }
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
        // 2. Ejecutar tu motor para cada empleado usando generateAndStore()
        // ==========================================================

        $processed = [];

        foreach ($uids as $uid) {
            $response = $this->generateAndStore($uid, $from, $to);

            // generateAndStore() retorna un JSON Response → extraemos el contenido
            $processed[] = json_decode($response->getContent(), true);
        }

        // ==========================================================
        // 3. Respuesta ligera para el frontend
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
