<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Tipo de día del calendario operativo del parque (AA, A, B, C...): define cuánto personal
 * necesita cada área ese día (ver DayTypeStaffing). Configurable por el administrador.
 */
class DayType extends Model
{
    // is_high_season: los días con este tipo cuentan como temporada alta — el parque abre
    // aunque sea lunes o martes (ver OperatingCalendar::isParkClosed()).
    protected $fillable = ['name', 'color', 'sort_order', 'is_high_season'];

    protected $casts = [
        'is_high_season' => 'boolean',
    ];

    public function operatingDays()
    {
        return $this->hasMany(OperatingDay::class);
    }

    public function staffing()
    {
        return $this->hasMany(DayTypeStaffing::class);
    }
}
