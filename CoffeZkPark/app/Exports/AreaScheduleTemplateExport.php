<?php

namespace App\Exports;

use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class AreaScheduleTemplateExport implements FromArray,WithTitle,WithEvents{
public function __construct(
    private Collection $employees,
    private int $year,
    private int $month,
    private string $areaName,
) {

}

public function title(): string 
{
    return substr(sprintf('Plantilla %s %02d-%d', $this->areaName,$this->month,$this->year),0,31);
}
public function array():array{
    $daysInMonth = Carbon::create($this->year,$this->month, 1)->daysInMonth;

    $firstDay = Carbon::create($this->year, $this->month, 1);
    $monthLabel = ucfirst($firstDay->locale('es')->isoFormat('MMM'));

    $dayHeaders =[];
    for ($day = 1 ; $day <= $daysInMonth; $day++){
        $date = Carbon::create($this->year, $this->month, $day);
        $weekdayAbbrev = ucfirst($date->locale('es')->isoFormat('ddd'));
        $dayHeaders[] = sprintf('%d (%s)', $day, $weekdayAbbrev);
    }
    $rows=[];
    $rows[] = [sprintf('PROGRAMACION MENSUAL - %s - %s %d ', $this->areaName,$monthLabel, $this->year)];

    $headerRow = array_merge(['Cedúla' ,'Nombre',], $dayHeaders);
    $rows[] = $headerRow;

    foreach($this->employees as $employee){
        $row = [$employee->documentos, $employee->name];
        for ($day = 1; $day <= $daysInMonth; $day++){
            $row[]='';
        }
        $rows[] = $row;
    }
    $rows[] = [''];
    $rows[] = ['Convención : HH:MM-HH:MM = horario del turno .D = Descansa . VAC = vacaciones . INC = Incapacidad'];


    return $rows;
}
 public function registerEvents():array{
    return[
        AfterSheet::class=> function (AfterSheet $event){
            $daysInMonth = Carbon::create($this->year , $this->month, 1)->daysInMonth;
            $sheet = $event->sheet->getDelegate();   
            $lastDataRow = $sheet->getHighestRow();
            $lastColumn = Coordinate::stringFromColumnIndex(2 + $daysInMonth);
            $sheet->mergeCells("A1:{$lastColumn}1");
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
            $sheet->getRowDimension(1)->setRowHeight(30);
            $sheet->getStyle("A2:{$lastColumn}2")->getFont()->setBold(true)->setSize(11);
            $sheet->freezePane('A3');

            for($col = 1; $col<= 2 + $daysInMonth; $col++){
                $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(14);
            }
            $range = "A1:{$lastColumn}{$lastDataRow}";
            $sheet->getStyle($range)->getBorders()->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D1D5DB');

            $sheet->getStyle("A3:{$lastColumn}{$lastDataRow}")->getAlignment()->setWrapText(true);
            $sheet->mergeCells("A{$lastDataRow}:{$lastColumn}{$lastDataRow}");
            $sheet->mergeCells("A" . ($lastDataRow -1 ) . ":{$lastColumn}" . ($lastDataRow - 1 ));
            $sheet->getStyle("A" . ($lastDataRow - 1 ) . ":A{$lastDataRow}")->getAlignment()->setWrapText(false);
               },
    ];
 }
}