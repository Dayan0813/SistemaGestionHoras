<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class calendars extends Model
{
    protected $fillable = [
<<<<<<< HEAD
        'area_id',
        'hora_entrada',
        'hora_salida',
        'shift_type', // D or N
        'is_custom', // true = creado al vuelo para un empleado, no aparece en el catálogo general del área
        'created_for_employee_uid', // dueño del turno cuando is_custom = true
=======
        'hora_entrada',
        'hora_salida',
        'shift_type', // D or N
>>>>>>> origin/feature/hernandez
    ];

    //

    public function programations()
    {
        return $this->hasMany(Programations::class, 'calendar_id');
    }

    //

    public function overrides()
    {
        return $this->hasMany(ProgramationOverride::class, 'calendar_id');
    }
<<<<<<< HEAD

    //

    public function createdForEmployee()
    {
        return $this->belongsTo(Employee::class, 'created_for_employee_uid', 'uid');
    }
=======
>>>>>>> origin/feature/hernandez
}
