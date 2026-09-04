<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * No existía ninguna forma de crear un empleado desde la UI: se agrega
     * el permiso "empleados.crear", otorgado a los mismos roles que ya
     * pueden editar/eliminar empleados.
     */
    private function roles(): array
    {
        return ['coordinator', 'aux_admin_th', 'admin_nomina', 'aux_th'];
    }

    public function up(): void
    {
        DB::table('permissions')->updateOrInsert(
            ['name' => 'empleados.crear'],
            ['description' => 'Crear empleados', 'created_at' => now(), 'updated_at' => now()]
        );

        $permissionId = DB::table('permissions')->where('name', 'empleados.crear')->value('id');

        // admin ya tiene todos los permisos existentes; se le agrega este también
        $roles = [...$this->roles(), 'admin'];

        foreach ($roles as $role) {
            DB::table('role_permissions')->updateOrInsert(
                ['role' => $role, 'permission_id' => $permissionId],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'empleados.crear')->value('id');
        DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('permissions')->where('name', 'empleados.crear')->delete();
    }
};
