<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La temporada alta pasa a definirse en el calendario operativo: un tipo de día (ej. "C")
 * marcado como temporada alta hace que todos los días con ese tipo lo sean. Reemplaza los
 * rangos de fechas que antes se configuraban aparte en "Por Áreas".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('day_types', function (Blueprint $table) {
            $table->boolean('is_high_season')->default(false)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('day_types', function (Blueprint $table) {
            $table->dropColumn('is_high_season');
        });
    }
};
