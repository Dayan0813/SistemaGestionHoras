<?php

namespace App\Services;

use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

/**
 * Empleados de un área con sus programaciones/excepciones de un mes dado.
 * Compartido por la vista de "Consulta por área" (JSON), su exportación a
 * Excel de una sola área, y la exportación de todas las áreas juntas.
 */
class AreaScheduleQuery
{
    public static function forMonth(int $areaId, int $year, int $month): Collection
    {
        $startOfMonth = Carbon::create($year, $month)->startOfMonth()->toDateString();
        $endOfMonth = Carbon::create($year, $month)->endOfMonth()->toDateString();

        return Employee::query()
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
                'contrato:id,name',
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
                            'calendar:id,area_id,hora_entrada,hora_salida,shift_type',
                            'workPosition:id,area_id,attraction,name',
                            'overrides' => function ($oq) use ($startOfMonth, $endOfMonth) {
                                $oq->whereBetween('date', [$startOfMonth, $endOfMonth])
                                    ->with([
                                        'calendar:id,area_id,hora_entrada,hora_salida,shift_type',
                                        'workPosition:id,area_id,attraction,name',
                                    ]);
                            }
                        ]);
                }
            ])
            ->orderBy('name')
            ->get(['uid', 'name', 'contrato_id']);
    }
}
