<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employee_absences', function (Blueprint $table) {
            // Días de vacaciones descontados del saldo del empleado al crear esta ausencia
            // (rango completo inclusivo start_date..end_date) — se guarda una sola vez en
            // store() para poder restaurar el saldo exacto al cancelar (destroy()), sin
            // tener que recalcular el diff de fechas ahí. Solo aplica a type "vacaciones";
            // queda null para "incapacidad".
            $table->unsignedSmallInteger('days')->nullable()->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('employee_absences', function (Blueprint $table) {
            $table->dropColumn(['days']);
        });
    }
};
