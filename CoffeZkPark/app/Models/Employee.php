<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'uid',
        'userid',
        'name',
        'cardno',
        'estado',
        'documentos',
        'dispositivo',
        'horario',
        'empresa',
        'cargo',
        'cargo_id',
        'tipo_contrato',
        'dependencia',
        'centrocosto',
        'area_id',
        'contrato_id',
        'dias_vacaciones_disponibles',
    ];


    // Relaciones

    //

    public function area()
    {
        return $this->belongsTo(area::class);
    }

    //

    public function cargo()
    {
        return $this->belongsTo(cargo::class);
    }

    //

    public function contrato()
    {
        return $this->belongsTo(contrato::class);
    }

    //

    public function programations()
    {
        return $this->hasMany(Programations::class, 'employee_uid', 'uid');
    }

    //

    public function workConsolidations()
    {
        return $this->hasMany(WorkConsolidation::class);
    }

    //

    public function markingLogs()
    {
        return $this->hasMany(MarkingLog::class, 'empleado_uid', 'uid');
    }

    //

    public function user()
    {
        return $this->hasOne(User::class, 'employee_uid', 'uid');
    }

    //

    public function absences()
    {
        return $this->hasMany(EmployeeAbsence::class, 'employee_uid', 'uid');
    }


    /**
     * ======================================
     * 
     *  Creacion de SCOPES
     * 
     * ======================================
     */

    public function scopeActivos($q)
    {
        return $q->where('estado', 'Activo');
    }

    public function scopeInactivos($q)
    {
        return $q->where('estado', 'Inactivo');
    }
}
