<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\User;
use App\Models\UserRole;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(PermissionSeeder::class);

        // Empleado + usuario admin de prueba para poder entrar en un entorno recién migrado.
        $employee = Employee::factory()->create([
            'name' => 'Admin',
        ]);

        $user = User::factory()->create([
            'email' => 'test@example.com',
            'employee_uid' => $employee->uid,
        ]);

        UserRole::create([
            'user_id' => $user->id,
            'role' => 'admin',
        ]);
    }
}
