<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            // Cubre las queries de solapamiento/conflicto de puesto (store/update de
            // ProgramationsController): filtran por area_id + status + rango de fechas.
            $table->index(['area_id', 'status', 'start_date', 'end_date'], 'programations_area_status_dates_index');

            // Cubre el chequeo de solapamiento por empleado dentro de una misma área.
            $table->index(['employee_uid', 'area_id', 'status'], 'programations_employee_area_status_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            $table->dropIndex('programations_area_status_dates_index');
            $table->dropIndex('programations_employee_area_status_index');
        });
    }
};
