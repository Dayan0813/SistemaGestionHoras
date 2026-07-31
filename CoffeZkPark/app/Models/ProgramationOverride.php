<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProgramationOverride extends Model
{
    protected $fillable = [
        'programation_id',
        'date',
        'calendar_id',
    ];

    //

    public function programation()
    {
        return $this->belongsTo(Programations::class, 'programation_id');
    }

    //

    public function calendar()
    {
        return $this->belongsTo(calendars::class, 'calendar_id');
    }
}
