<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeAbsence extends Model
{
    protected $table = 'employee_absences';

    protected $fillable = [
        'employee_uid',
        'area_id',
        'type',
        'planned_month',
        'start_date',
        'end_date',
        'days',
        'replacement_employee_uid',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_uid', 'uid');
    }

    public function replacementEmployee()
    {
        return $this->belongsTo(Employee::class, 'replacement_employee_uid', 'uid');
    }

    public function area()
    {
        return $this->belongsTo(area::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Copias de las filas de Programations del ausente recortadas al registrar esta
    // ausencia — ver EmployeeAbsenceController::hideAbsentDays()/destroy().
    public function snapshots()
    {
        return $this->hasMany(EmployeeAbsenceSnapshot::class, 'employee_absence_id');
    }

    // Marca las Programations creadas para el reemplazo por ESTA ausencia, para poder
    // identificarlas y revertirlas al cancelar sin tocar el schema de programations.
    public function groupCode(): string
    {
        return "absence:{$this->id}";
    }

    // true si esta ausencia es solo una "reserva de mes" (planned_month) sin fechas exactas
    // definidas todavía — ver EmployeeAbsenceController::storeReservation(). No tiene
    // Programations recortadas ni saldo descontado hasta que se confirmen fechas reales.
    public function isReservationOnly(): bool
    {
        return $this->start_date === null && $this->planned_month !== null;
    }
}
