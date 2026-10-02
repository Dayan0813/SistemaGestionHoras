<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nombres y apellidos por separado. `name` se conserva como el nombre completo que usa todo el
 * sistema (programación, plantillas, exportaciones): el modelo Employee lo arma solo a partir de
 * nombres + apellidos. Los empleados existentes quedan con ambos vacíos (no se adivina dónde
 * termina el nombre y empieza el apellido) hasta que se editen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('nombres')->nullable()->after('name');
            $table->string('apellidos')->nullable()->after('nombres');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['nombres', 'apellidos']);
        });
    }
};
