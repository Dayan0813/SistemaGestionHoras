<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Configuración global de la empresa, clave-valor — evita crear una tabla nueva cada
        // vez que aparece un ajuste que aplica a TODA la empresa (no por área), como los meses
        // de temporada alta.
        Schema::create('company_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
