<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Programations extends Model
{
    use HasFactory;

    protected $table = 'programations';

    protected $fillable = [
        'employee_uid',
        'type',
        'area_id',
        'calendar_id',
        'work_position_id',
        'start_date',
        'end_date',
        'status',
        'group_code',
        'work_days',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'work_days' => 'array',
    ];

    // Relacion empleados
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_uid', 'uid');
    }

    //

    public function calendar()
    {
        return $this->belongsTo(calendars::class, 'calendar_id');
    }

    //

    public function area()
    {
        return $this->belongsTo(area::class);
    }

    //

    public function overrides()
    {
        return $this->hasMany(ProgramationOverride::class, 'programation_id');
    }
}
