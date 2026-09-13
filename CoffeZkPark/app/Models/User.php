<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable
{
    protected $fillable = [
        'email',
        'password',
        'employee_uid',
    ];

    protected $hidden = [
        'password',
    ];

    // Relación laboral
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_uid', 'uid');
    }

    // Roles de sistema
    public function roles()
    {
        return $this->hasMany(UserRole::class, 'user_id');
    }

    // Verifica si el usuario tiene un rol
    public function hasRole(string $role): bool
    {
        return $this->roles()
            ->where('role', $role)
            ->exists();
    }

    // Verifica si el usuario tiene un permiso
    public function hasPermission(string $permission): bool
    {
        return DB::table('role_permissions')
            ->join(
                'permissions',
                'permissions.id',
                '=',
                'role_permissions.permission_id'
            )
            ->whereIn(
                'role_permissions.role',
                $this->roles()->pluck('role')
            )
            ->where('permissions.name', $permission)
            ->exists();
    }

    // Obtener todos los permisos del usuario
    public function getPermissions(): array
    {
        return DB::table('role_permissions')
            ->join(
                'permissions',
                'permissions.id',
                '=',
                'role_permissions.permission_id'
            )
            ->whereIn(
                'role_permissions.role',
                $this->roles()->pluck('role')
            )
            ->pluck('permissions.name')
            ->unique()
            ->values()
            ->all();
    }
}