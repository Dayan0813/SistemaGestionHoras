<?php

namespace App\Http\Controllers;

use App\Models\MarkingLog;
use App\Models\Programations;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CalendarioVsMarcacionesController extends Controller
{
    public function index(Request $request)
    {
        $fecha = $request->query(
            'fecha',
            now()->toDateString()
        );

        $search = trim(
            (string) $request->query('search', '')
        );

        $areaId = $request->query('area_id');

        $user = $request->user();

        /*
        |--------------------------------------------------------------------------
        | RESTRICCIÓN POR ÁREA
        |--------------------------------------------------------------------------
        */

        if (
            $user->hasRole('coordinator') ||
            $user->hasRole('aux_admin_th')
        ) {
            $areaId = $user->employee?->area_id;

            if (!$areaId) {
                abort(
                    403,
                    'El usuario no tiene un área asignada.'
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | PROGRAMACIONES
        |--------------------------------------------------------------------------
        */

        $programations = Programations::query()
            ->where('status', '!=', 'Cancelado')
            ->whereDate('start_date', '<=', $fecha)
            ->whereDate('end_date', '>=', $fecha)

            ->when(
                $areaId,
                fn ($query) =>
                    $query->where('area_id', $areaId)
            )

            ->when(
                $search !== '',
                function ($query) use ($search) {
                    $query->whereHas(
                        'employee',
                        function ($employee) use ($search) {
                            $employee
                                ->where(
                                    'name',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'uid',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'userid',
                                    'like',
                                    "%{$search}%"
                                );
                        }
                    );
                }
            )

            ->with([
                'employee',
                'area',
                'calendar',
                'overrides.calendar',
            ])

            ->orderBy('employee_uid')
            ->get();

        $resultado = [];

        foreach ($programations as $programation) {

            $employee = $programation->employee;

            if (!$employee) {
                continue;
            }

            /*
            |--------------------------------------------------------------------------
            | CALENDARIO DEL DÍA
            |--------------------------------------------------------------------------
            */

            $calendar = $programation->calendar;

            $override = $programation->overrides
                ->first(function ($item) use ($fecha) {
                    return Carbon::parse(
                        $item->date
                    )->isSameDay(
                        Carbon::parse($fecha)
                    );
                });

            if ($override?->calendar) {
                $calendar = $override->calendar;
            }

            if (
                !$calendar ||
                !$calendar->hora_entrada ||
                !$calendar->hora_salida
            ) {
                $resultado[] = [
                    'employee_uid' => $employee->uid,
                    'employee_name' => $employee->name,
                    'area_id' => $programation->area_id,
                    'area_name' => $programation->area?->nombre,
                    'programmed_entry' => null,
                    'programmed_exit' => null,
                    'marking_entry' => null,
                    'marking_exit' => null,
                    'marking_count' => 0,
                    'status' => 'Sin horario',
                ];

                continue;
            }

            /*
            |--------------------------------------------------------------------------
            | HORARIO PROGRAMADO
            |--------------------------------------------------------------------------
            */

            $entry = Carbon::parse(
                $fecha . ' ' . $calendar->hora_entrada
            );

            $exit = Carbon::parse(
                $fecha . ' ' . $calendar->hora_salida
            );

            if (
                $calendar->shift_type === 'N' ||
                $exit->lte($entry)
            ) {
                $exit->addDay();
            }

            /*
            |--------------------------------------------------------------------------
            | MARCACIONES
            |--------------------------------------------------------------------------
            */

            $markings = MarkingLog::query()
                ->where(
                    'empleado_uid',
                    $employee->uid
                )
                ->whereBetween(
                    'timestamp',
                    [
                        $entry->copy()->subHours(4),
                        $exit->copy()->addHours(4),
                    ]
                )
                ->orderBy('timestamp')
                ->get();

            $first = $markings->first();
            $last = $markings->last();

            $firstTime = $first
                ? Carbon::parse($first->timestamp)
                : null;

            $lastTime = $last
                ? Carbon::parse($last->timestamp)
                : null;

            /*
            |--------------------------------------------------------------------------
            | ESTADO
            |--------------------------------------------------------------------------
            */

            $status = 'Completa';

            if (!$firstTime) {
                $status = 'Sin marcación';
            } elseif ($markings->count() === 1) {
                if (now()->gt($exit->copy()->addMinutes(15))) {
                    $status = 'Falta salida';
                } else {
                    $status = 'En jornada';
                }
            } elseif ($firstTime->gt($entry)) {
                $status = 'Entrada tardía';
            }

            /*
            |--------------------------------------------------------------------------
            | RESULTADO
            |--------------------------------------------------------------------------
            */

            $resultado[] = [
                'employee_uid' => $employee->uid,
                'employee_name' => $employee->name,
                'area_id' => $programation->area_id,
                'area_name' => $programation->area?->nombre,

                'programmed_entry' =>
                    $entry->format('H:i'),

                'programmed_exit' =>
                    $exit->format('H:i'),

                'marking_entry' =>
                    $firstTime?->format('H:i'),

                'marking_exit' =>
                    $lastTime?->format('H:i'),

                'marking_count' =>
                    $markings->count(),

                'status' => $status,
            ];
        }

        /*
        |--------------------------------------------------------------------------
        | ÁREAS
        |--------------------------------------------------------------------------
        */

        $areas = \App\Models\area::query()
            ->when(
                $user->hasRole('coordinator') ||
                $user->hasRole('aux_admin_th'),
                fn ($query) =>
                    $query->where(
                        'id',
                        $user->employee?->area_id
                    )
            )
            ->orderBy('nombre')
            ->get([
                'id',
                'nombre',
            ]);

        return response()->json([
            'success' => true,
            'fecha' => $fecha,
            'data' => $resultado,
            'areas' => $areas,
        ]);
    }
}