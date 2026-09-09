<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            // Meses (1-12) que son temporada alta para esta área — solo relevante para áreas de
            // jornada fija: en temporada alta NO aplica el recorte de lunes/martes (política de
            // horario corto solo rige en temporada baja). null/[] = todo el año es temporada baja.
            $table->json('high_season_months')->nullable()->after('scheduling_mode');
        });
    }

    public function down(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            $table->dropColumn('high_season_months');
        });
    }
};
