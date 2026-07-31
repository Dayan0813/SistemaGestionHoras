<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarkingLog extends Model
{
    protected $table = 'marking_logs';

    protected $fillable = [
        'empleado_uid',
        'device_id',
        'timestamp',
        'fecha',
        'hora',
        'raw',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'fecha'     => 'date',
        'hora'      => 'datetime:H:i:s',
        'raw'       => 'array',
    ];

    public function employee() {
        return $this->belongsTo(Employee::class, 'empleado_uid', 'uid');
    }

    public function device() {
        return $this->belongsTo(Device::class);
    }
}
