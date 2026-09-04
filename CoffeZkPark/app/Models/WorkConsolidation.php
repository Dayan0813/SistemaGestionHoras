<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkConsolidation extends Model
{
    protected $fillable = [
        'employee_uid',
        'week_start',
        'week_end',

        // Ordinarias

        'ordinary_day',
        'ordinary_night',
        'ordinary_festive_day',
        'ordinary_festive_night',

        // Extras
        'extra_day',
        'extra_night',
        'extra_festive_day',
        'extra_festive_night',

        // No programadas
        'unplanned',

        // JSON con todo el detalle
        'daily_breakdown',
    ];

    protected $casts = [
        'daily_breakdown' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_uid', 'uid');
    }
}
