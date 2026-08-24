<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissionId = DB::table('permissions')
            ->where('name', 'programaciones.cancelar')
            ->value('id');

        if ($permissionId) {
            DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->insertGetId([
            'name' => 'programaciones.cancelar',
            'description' => 'Cancelar programaciones',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (['admin', 'coordinator', 'aux_admin_th'] as $role) {
            DB::table('role_permissions')->insert([
                'role' => $role,
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};