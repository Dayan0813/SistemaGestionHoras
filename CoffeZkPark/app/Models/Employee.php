<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'uid',
        'userid',
        'name',
        'nombres',
        'apellidos',
        'cardno',
        'estado',
        'documentos',
        'dispositivo',
        'horario',
        'empresa',
        'cargo',
        'cargo_id',
        'tipo_contrato',
        'dependencia',
        'centrocosto',
        'area_id',
        'contrato_id',
        'dias_vacaciones_disponibles',
    ];

    /**
     * Nombre completo en SQL, para buscar con LIKE (ver scopeWhereNameLike()). La tabla ya no
     * tiene columna `name`: se guardan nombres y apellidos por separado.
     */
    public const FULL_NAME_SQL = "TRIM(CONCAT_WS(' ', nombres, apellidos))";

    // `name` (nombre completo) va en el JSON de todas las pantallas como si fuera una columna.
    protected $appends = ['name'];

    /**
     * `name` = nombres + apellidos. Ya no es una columna: lo lee todo el sistema (programación,
     * plantillas, exportaciones) y se calcula aquí.
     *
     * Asignarlo (como hace la sincronización de los huelleros con el nombre del dispositivo) solo
     * llena `nombres` si el empleado todavía no tiene nombres ni apellidos — así un empleado
     * nuevo del huellero queda con nombre, pero el huellero no pisa el nombre real (el del
     * dispositivo suele venir cortado).
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn ($value, array $attributes) => trim(preg_replace('/\s+/', ' ', ($attributes['nombres'] ?? '') . ' ' . ($attributes['apellidos'] ?? ''))),
            set: fn ($value, array $attributes) => trim((string) ($attributes['nombres'] ?? '')) === '' && trim((string) ($attributes['apellidos'] ?? '')) === ''
                ? ['nombres' => trim((string) $value)]
                : [],
        );
    }

    /** Ordena por nombre completo (nombres y luego apellidos). */
    public function scopeOrderByName($query)
    {
        return $query->orderBy('nombres')->orderBy('apellidos');
    }

    /** Filtra por nombre completo que contenga $search. */
    public function scopeWhereNameLike($query, string $search)
    {
        return $query->whereRaw(self::FULL_NAME_SQL . ' LIKE ?', ["%{$search}%"]);
    }

    /** Igual que scopeWhereNameLike() pero con OR, para combinar con otros filtros. */
    public function scopeOrWhereNameLike($query, string $search)
    {
        return $query->orWhereRaw(self::FULL_NAME_SQL . ' LIKE ?', ["%{$search}%"]);
    }

    // Relaciones

    //

    public function area()
    {
        return $this->belongsTo(area::class);
    }

    //

    public function cargo()
    {
        return $this->belongsTo(cargo::class);
    }

    //

    public function contrato()
    {
        return $this->belongsTo(contrato::class);
    }

    //

    public function programations()
    {
        return $this->hasMany(Programations::class, 'employee_uid', 'uid');
    }

    //

    public function workConsolidations()
    {
        return $this->hasMany(WorkConsolidation::class);
    }

    //

    public function markingLogs()
    {
        return $this->hasMany(MarkingLog::class, 'empleado_uid', 'uid');
    }

    //

    public function user()
    {
        return $this->hasOne(User::class, 'employee_uid', 'uid');
    }

    //

    public function absences()
    {
        return $this->hasMany(EmployeeAbsence::class, 'employee_uid', 'uid');
    }


    /**
     * ======================================
     * 
     *  Creacion de SCOPES
     * 
     * ======================================
     */

    public function scopeActivos($q)
    {
        return $q->where('estado', 'Activo');
    }

    public function scopeInactivos($q)
    {
        return $q->where('estado', 'Inactivo');
    }
}
