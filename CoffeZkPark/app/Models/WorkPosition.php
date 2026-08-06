<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkPosition extends Model
{
    use HasFactory;

    /**
     * Los atributos que se pueden asignar masivamente.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'area_id',
        'attraction',
        'name',
        'active',
    ];

    /**
     * Los atributos que deben ser convertidos a tipos nativos.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'active' => 'boolean',
    ];

    /**
     * Obtener el área a la que pertenece el puesto de trabajo.
     * * Relación: Muchos a Uno (Many-to-One)
     */
    public function area()
    {
        return $this->belongsTo(area::class);
    }
}
