<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Device extends Model
{
    protected $fillable = ['name', 'ip', 'port', 'state'];

    protected $casts = [
        'state' => 'boolean',
        'port' => 'integer'
    ];
}
