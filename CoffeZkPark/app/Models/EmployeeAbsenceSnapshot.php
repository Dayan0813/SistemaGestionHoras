<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Copia exacta de una fila de Programations del empleado AUSENTE justo antes de que
 * EmployeeAbsenceController::store() la recortara para ocultar los días cubiertos por el
 * reemplazo — permite reconstruirla tal cual al cancelar la ausencia (ver
 * EmployeeAbsenceController::destroy()).
 */
class EmployeeAbsenceSnapshot extends Model
{
    protected $table = 'employee_absence_snapshots';

    protected $fillable = [
        'employee_absence_id',
        'employee_uid',
        'calendar_id',
        'work_position_id',
        'start_date',
        'end_date',
        'status',
        'type',
        'group_code',
        'work_days',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'work_days' => 'array',
    ];

    public function absence()
    {
        return $this->belongsTo(EmployeeAbsence::class, 'employee_absence_id');
    }
}
