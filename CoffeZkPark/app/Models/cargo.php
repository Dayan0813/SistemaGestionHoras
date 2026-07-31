<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class cargo extends Model
{
    use HasFactory;

    protected $table = 'cargo';

    protected $fillable = [
        'name',
    ];

    /**
     * Un cargo puede tener muchos empleados
     */
    
    public function employees(){
        return $this->hasMany(Employee::class, 'cargo_id');
    }
}
