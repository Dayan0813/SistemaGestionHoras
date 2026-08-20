<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Holidays extends Model
{
    protected $fillable = ['date', 'name', 'is_movable'];

    protected $casts = ['date' => 'date'];
}
