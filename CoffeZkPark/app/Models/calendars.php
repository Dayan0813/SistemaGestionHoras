<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class calendars extends Model
{
    protected $fillable = [
        'hora_entrada',
        'hora_salida',
        'shift_type', // D or N
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
}
