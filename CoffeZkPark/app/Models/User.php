<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use App\Models\UserRole;

class User extends Authenticatable
{
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
}
