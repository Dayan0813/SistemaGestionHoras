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
        Schema::table('programations', function (Blueprint $table) {
            //Relacion con Calendarios
            $table->foreignId('calendar_id')
                ->constrained('calendars')
                ->onDelete('cascade');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

        Schema::table('programations', function (Blueprint $table) {

            // 1. Eliminar la CLAVE FORÁNEA primero
            $table->dropForeign(['calendar_id']);

            // 2. Eliminar las TRES COLUMNAS añadidas
            $table->dropColumn(['calendar_id']);
        });
    }
};
