<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class contrato extends Model
{
    use HasFactory;

    protected $table = 'contrato';

    protected $fillable = [
        'name',
    ];


    /**
     * Un contrato puede tener muchos empleados
     */


    public function employees()
    {
        return $this->hasMany(Employee::class, 'contrato_id');
    }
}
