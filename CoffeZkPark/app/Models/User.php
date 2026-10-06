<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use App\Models\UserRole;

class User extends Authenticatable
{
    use HasFactory;

    protected $fillable = [
        'email',
        'password',
        'employee_uid',
    ];

    protected $hidden = ['password'];

    // Relación laboral
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_uid', 'uid');
    }

    // Áreas asignadas al coordinador (puede tener varias)
    public function coordinatorAreas()
    {
        return $this->hasMany(CoordinatorArea::class);
    }

    public function coordinatorAreaIds(): array
    {
        return $this->coordinatorAreas()->pluck('area_id')->map(fn ($id) => (int) $id)->all();
    }

    //  Roles de sistema (UNO A MUCHOS)
    public function roles()
    {
        return $this->hasMany(UserRole::class);
    }

    //  Método CORRECTO usado por el middleware
    public function hasRole(string $role): bool
    {
        return $this->roles()->where('role', $role)->exists();
    }

    public function hasPermission(string $permission): bool
    {
        return $this->roles()
            ->whereHas('permissions', fn ($query) => $query->where('name', $permission))
            ->exists();
    }
}
