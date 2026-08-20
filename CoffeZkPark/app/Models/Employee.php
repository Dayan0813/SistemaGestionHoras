<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;


class Employee extends Model
{
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
        'cargo_id',
        'dependencia',
        'centrocosto',
        'area_id',
        'contrato_id',
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

    public function user()
    {
        return $this->hasOne(User::class, 'employee_uid', 'uid');
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
