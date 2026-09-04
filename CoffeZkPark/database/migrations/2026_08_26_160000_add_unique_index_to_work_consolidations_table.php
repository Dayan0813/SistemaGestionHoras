<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * generateAndStore() hace updateOrCreate() sobre este trío asumiendo que
     * es único, pero nada lo garantizaba a nivel de base de datos: dos
     * peticiones concurrentes de generación masiva podían crear filas
     * duplicadas y duplicar el conteo de horas.
     */
    public function up(): void
    {
        Schema::table('work_consolidations', function (Blueprint $table) {
            $table->unique(['employee_uid', 'week_start', 'week_end'], 'work_consolidations_employee_week_unique');
        });
    }

    public function down(): void
    {
        Schema::table('work_consolidations', function (Blueprint $table) {
            $table->dropUnique('work_consolidations_employee_week_unique');
        });
    }
};
