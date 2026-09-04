<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla pivote creada por migración pero nunca usada por ninguna relación
     * de Eloquent (Programations usa una sola columna work_position_id en su
     * lugar). Estaba vacía; se elimina en vez de dejarla como esquema muerto.
     */
    public function up(): void
    {
        Schema::dropIfExists('employee_work_position');
    }

    public function down(): void
    {
        Schema::create('employee_work_position', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('work_position_id')->constrained('work_positions')->cascadeOnDelete();
            $table->timestamps();
        });
    }
};
