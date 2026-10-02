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
        return self::forRange(
            $areaId,
            Carbon::create($year, $month)->startOfMonth()->toDateString(),
            Carbon::create($year, $month)->endOfMonth()->toDateString(),
        );
    }

    /**
     * Igual que forMonth() pero para un rango arbitrario de fechas (Y-m-d, ambos inclusive),
     * p. ej. una semana de lunes a domingo para la exportación semanal.
     */
    public static function forRange(int $areaId, string $rangeStart, string $rangeEnd): Collection
    {
        return Employee::query()
            ->where('area_id', $areaId)
            ->whereHas('programations', function ($q) use ($rangeStart, $rangeEnd) {
                $q->where(function ($query) use ($rangeStart, $rangeEnd) {
                    $query->whereBetween('start_date', [$rangeStart, $rangeEnd])
                        ->orWhereBetween('end_date', [$rangeStart, $rangeEnd])
                        ->orWhere(function ($q) use ($rangeStart, $rangeEnd) {
                            $q->where('start_date', '<=', $rangeEnd)
                                ->where('end_date', '>=', $rangeStart);
                        });
                });
            })
            ->with([
                'contrato:id,name',
                'programations' => function ($q) use ($rangeStart, $rangeEnd) {
                    $q->where(function ($query) use ($rangeStart, $rangeEnd) {
                        $query->whereBetween('start_date', [$rangeStart, $rangeEnd])
                            ->orWhereBetween('end_date', [$rangeStart, $rangeEnd])
                            ->orWhere(function ($q) use ($rangeStart, $rangeEnd) {
                                $q->where('start_date', '<=', $rangeEnd)
                                    ->where('end_date', '>=', $rangeStart);
                            });
                    })
                        ->with([
                            'calendar:id,area_id,hora_entrada,hora_salida,shift_type',
                            'workPosition:id,area_id,attraction,name',
                            'overrides' => function ($oq) use ($rangeStart, $rangeEnd) {
                                $oq->whereBetween('date', [$rangeStart, $rangeEnd])
                                    ->with([
                                        'calendar:id,area_id,hora_entrada,hora_salida,shift_type',
                                        'workPosition:id,area_id,attraction,name',
                                    ]);
                            }
                        ]);
                }
            ])
            ->orderByName()
            ->get(['uid', 'nombres', 'apellidos', 'contrato_id']);
    }

    public static function activeEmployees(int $areaId): Collection
    {
        return Employee::query()
        ->where('area_id', $areaId)
        ->where('estado','Activo')
        ->orderByName()
        ->get();
    }
}
