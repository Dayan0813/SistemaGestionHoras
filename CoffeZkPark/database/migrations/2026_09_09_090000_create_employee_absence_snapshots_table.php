<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Guarda, por cada Programations del empleado AUSENTE que se recortó al registrar una
     * ausencia (para que ya no aparezca cubriendo turno esos días), una copia exacta de sus
     * valores originales — para poder RECREARLA tal cual al cancelar la ausencia, sin
     * importar qué tan compleja fuera (work_days, puesto, etc.). No usa foreignId a
     * programations porque la fila original puede haber sido borrada por completo si quedó
     * enteramente dentro del rango de la ausencia.
     */
    public function up(): void
    {
        Schema::create('employee_absence_snapshots', function (Blueprint $table) {
            $table->id();

            $table->foreignId('employee_absence_id')
                ->constrained('employee_absences')
                ->onDelete('cascade');

            $table->string('employee_uid');
            $table->foreignId('calendar_id')->nullable();
            $table->foreignId('work_position_id')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status');
            $table->string('type', 5)->nullable();
            $table->string('group_code')->nullable();
            $table->json('work_days')->nullable();

            $table->timestamps();

            $table->index(['employee_absence_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_absence_snapshots');
    }
};
