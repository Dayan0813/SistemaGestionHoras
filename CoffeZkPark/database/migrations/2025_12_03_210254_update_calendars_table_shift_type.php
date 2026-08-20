<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('calendars', function (Blueprint $table) {

            // 1. ELIMINAR CAMPOS QUE NO SE NECESITAN

            // Elimina campos viejos (A/B/C/D)
            $old = ['tipo', 'turno', 'modulo', 'variacion'];
            foreach ($old as $col) {
                if (Schema::hasColumn('calendars', $col)) {
                    $table->dropColumn($col);
                }
            }

            // Elimina 'name' y 'description' según tu requisito
            if (Schema::hasColumn('calendars', 'name')) {
                $table->dropColumn('name');
            }
            if (Schema::hasColumn('calendars', 'description')) {
                $table->dropColumn('description');
            }

            // 2. AÑADIR NUEVOS CAMPOS REQUERIDOS

            if (!Schema::hasColumn('calendars', 'area_id')) {

                // 2. Definimos la relación explícitamente
                $table->foreignId('area_id')
                    ->nullable()
                    ->after('id') // Ahora sí funcionará porque es una creación
                    ->constrained('areas')
                    ->cascadeOnDelete();
            }

            // Añadir 'hora_entrada'
            if (!Schema::hasColumn('calendars', 'hora_entrada')) {
                // Posicionamos el campo después del 'id'
                $table->time('hora_entrada')->nullable()->after('area_id');
            }

            // Añadir 'hora_salida'
            if (!Schema::hasColumn('calendars', 'hora_salida')) {
                $table->time('hora_salida')->nullable()->after('hora_entrada');
            }

            // Añadir/Actualizar 'shift_type' (D o N)
            if (!Schema::hasColumn('calendars', 'shift_type')) {
                $table->enum('shift_type', ['D', 'N'])->default('D')->after('hora_salida');
            }
        });
    }

    public function down(): void
    {
        // En caso de querer revertir (rollback) la migración
        Schema::table('calendars', function (Blueprint $table) {

            // Revertir la eliminación de 'name' y 'description' (generalmente se añaden de nuevo al revertir)
            if (!Schema::hasColumn('calendars', 'name')) {
                $table->string('name')->nullable();
            }
            if (!Schema::hasColumn('calendars', 'description')) {
                $table->string('description')->nullable();
            }

            // Revertir los campos nuevos
            if (Schema::hasColumn('calendars', 'hora_entrada')) {
                $table->dropColumn('hora_entrada');
            }

            if (Schema::hasColumn('calendars', 'hora_salida')) {
                $table->dropColumn('hora_salida');
            }

            if (Schema::hasColumn('calendars', 'shift_type')) {
                $table->dropColumn('shift_type');
            }

            // NOTA: Revertir la eliminación de campos viejos (tipo, turno, etc.) es complejo y generalmente no se hace
            // a menos que tengas el esquema original de creación, por lo que se omite aquí.
        });
    }
};
