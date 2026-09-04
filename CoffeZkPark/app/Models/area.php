<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class area extends Model
{

    use HasFactory;

    protected $fillable = [
        'nombre',
        'centro_costo',
        'descripcion',
        'scheduling_mode',
    ];

    /**
     * ====================
     *  RELACIONES
     * ====================
     * 
     */

    //

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    //

    public function WorkPositions()
    {
        return $this->hasMany(WorkPosition::class, 'area_id');
    }

    //

    public function programations()
    {
        return $this->hasMany(Programations::class);
    }

}
