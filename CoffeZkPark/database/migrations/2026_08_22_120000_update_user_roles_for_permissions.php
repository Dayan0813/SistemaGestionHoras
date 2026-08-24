<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE user_roles MODIFY role ENUM('admin', 'coordinator', 'aux_admin_th', 'admin_nomina', 'aux_th') NOT NULL");
    }

    public function down(): void
    {
        DB::table('user_roles')->whereNotIn('role', ['admin', 'coordinator'])->delete();
        DB::statement("ALTER TABLE user_roles MODIFY role ENUM('admin', 'coordinator') NOT NULL");
    }
};
