<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // Saldo de vacaciones fraccionable: se descuenta al registrar una ausencia tipo
            // "vacaciones" (EmployeeAbsenceController::store()) y se restaura al cancelarla.
            // Empleados con contrato "temporal" no tienen derecho a vacaciones (validado por
            // texto en contrato.name, sin flag propio — ver store()), así que el saldo no
            // aplica para ellos aunque la columna exista igual.
            $table->unsignedTinyInteger('dias_vacaciones_disponibles')->default(15)->after('contrato_id');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['dias_vacaciones_disponibles']);
        });
    }
};
