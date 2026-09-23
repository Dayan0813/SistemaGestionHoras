<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // La importación de plantilla Excel (AreaScheduleTemplateImport) crea programaciones
        // con status 'Borrador' desde que se agregó ese flujo, pero el enum original de esta
        // columna nunca incluyó ese valor — causaba "Data truncated for column 'status'".
        DB::statement("ALTER TABLE programations MODIFY status ENUM('Programado', 'Sin Programar', 'Completado', 'Cancelado', 'Borrador') NOT NULL DEFAULT 'Sin Programar'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE programations MODIFY status ENUM('Programado', 'Sin Programar', 'Completado', 'Cancelado') NOT NULL DEFAULT 'Sin Programar'");
    }
};
