<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_consolidations', function (Blueprint $table) {
            // Total de horas PROGRAMADAS en la semana (suma de la duración de cada turno
            // asignado, día por día — sin desglose día/noche/festivo, a diferencia de las
            // columnas de horas ya MARCADAS/trabajadas). Sirve para comparar de un vistazo
            // "lo que se programó" contra "lo que realmente se marcó" esa semana.
            $table->decimal('scheduled_hours', 8, 2)->default(0)->after('week_end');
        });
    }

    public function down(): void
    {
        Schema::table('work_consolidations', function (Blueprint $table) {
            $table->dropColumn('scheduled_hours');
        });
    }
};
