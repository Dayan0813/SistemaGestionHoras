<?php

namespace App\Exports;

use App\Models\area;
use App\Services\AreaScheduleQuery;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Un libro con una hoja por área (cada hoja es un AreaScheduleExport), para
 * quien puede ver la programación de todas las áreas de una sola vez.
 */
class AllAreasScheduleExport implements WithMultipleSheets
{
    public function __construct(
        private int $year,
        private int $month,
    ) {
    }

    public function sheets(): array
    {
        return area::orderBy('nombre')
            ->get()
            ->map(function (area $areaModel) {
                $employees = AreaScheduleQuery::forMonth($areaModel->id, $this->year, $this->month);

                return new AreaScheduleExport($employees, $this->year, $this->month, $areaModel->nombre);
            })
            ->all();
    }
}
