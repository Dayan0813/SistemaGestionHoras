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
        Schema::create('employee_absences', function (Blueprint $table) {
            $table->id();

            // Empleado ausente
            $table->string('employee_uid');
            $table->foreign('employee_uid')
                ->references('uid')
                ->on('employees')
                ->onDelete('cascade');

            // Desnormalizado (copiado del área del empleado ausente al crear) para poder
            // filtrar/restringir por área sin join, igual que programations.area_id.
            $table->foreignId('area_id')
                ->constrained('areas')
                ->onDelete('cascade');

            $table->enum('type', ['vacaciones', 'incapacidad']);

            $table->date('start_date');
            $table->date('end_date');

            // Empleado que cubre los turnos del ausente en ese rango.
            $table->string('replacement_employee_uid')->nullable();
            $table->foreign('replacement_employee_uid')
                ->references('uid')
                ->on('employees')
                ->onDelete('set null');

            $table->enum('status', ['Activa', 'Cancelada'])->default('Activa');

            $table->string('notes')->nullable();

            $table->foreignId('created_by')
                ->constrained('users')
                ->onDelete('cascade');

            $table->timestamps();

            $table->index(['area_id', 'status']);
            $table->index(['employee_uid', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_absences');
    }
};
