<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE user_roles MODIFY role ENUM('admin', 'coordinator', 'aux_admin_th', 'admin_nomina', 'aux_nomina', 'aux_th') NOT NULL");

        DB::table('user_roles')
            ->where('role', 'aux_nomina')
            ->update(['role' => 'aux_th']);

        DB::table('role_permissions')
            ->where('role', 'aux_nomina')
            ->update(['role' => 'aux_th']);
    }

    public function down(): void
    {
        DB::table('user_roles')
            ->where('role', 'aux_th')
            ->update(['role' => 'aux_nomina']);

        DB::table('role_permissions')
            ->where('role', 'aux_th')
            ->update(['role' => 'aux_nomina']);

        DB::statement("ALTER TABLE user_roles MODIFY role ENUM('admin', 'coordinator', 'aux_admin_th', 'admin_nomina', 'aux_nomina') NOT NULL");
    }
};
