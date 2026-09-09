<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // start_date/end_date son NOT NULL hoy — una "reserva de mes" (sin fechas exactas
        // todavía, ver EmployeeAbsenceController::storeReservation()) las deja nulas hasta
        // que se confirman. El proyecto no tiene doctrine/dbal instalado, así que se usa SQL
        // crudo en vez de ->nullable()->change().
        DB::statement('ALTER TABLE employee_absences MODIFY start_date DATE NULL');
        DB::statement('ALTER TABLE employee_absences MODIFY end_date DATE NULL');

        Schema::table('employee_absences', function (Blueprint $table) {
            // 'YYYY-MM' del mes reservado para esta tanda de vacaciones, antes de definir
            // fechas exactas — null una vez que start_date/end_date ya están definidas.
            $table->string('planned_month', 7)->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('employee_absences', function (Blueprint $table) {
            $table->dropColumn(['planned_month']);
        });

        DB::statement('ALTER TABLE employee_absences MODIFY start_date DATE NOT NULL');
        DB::statement('ALTER TABLE employee_absences MODIFY end_date DATE NOT NULL');
    }
};
