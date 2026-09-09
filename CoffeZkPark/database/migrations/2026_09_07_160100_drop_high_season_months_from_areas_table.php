<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Se reemplaza por company_settings (clave 'high_season_months'): la temporada alta
        // aplica igual a TODA la empresa, no tenía sentido configurarla área por área.
        Schema::table('areas', function (Blueprint $table) {
            $table->dropColumn('high_season_months');
        });
    }

    public function down(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            $table->json('high_season_months')->nullable()->after('scheduling_mode');
        });
    }
};
