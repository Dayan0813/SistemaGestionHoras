<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Tipo de día asignado a una fecha del calendario operativo (la fecha es la llave). */
class OperatingDay extends Model
{
    protected $primaryKey = 'date';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['date', 'day_type_id'];

    public function dayType()
    {
        return $this->belongsTo(DayType::class);
    }
}
