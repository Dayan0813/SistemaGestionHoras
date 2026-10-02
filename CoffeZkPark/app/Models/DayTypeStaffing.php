<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Personal mínimo que debe estar programado en un área en un día de cierto tipo. */
class DayTypeStaffing extends Model
{
    protected $table = 'day_type_staffing';

    protected $fillable = ['area_id', 'day_type_id', 'min_staff'];

    public function area()
    {
        return $this->belongsTo(area::class);
    }

    public function dayType()
    {
        return $this->belongsTo(DayType::class);
    }
}
