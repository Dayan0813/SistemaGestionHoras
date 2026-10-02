<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El nombre del empleado queda solo en `nombres` y `apellidos`; `name` deja de ser columna (el
 * modelo Employee lo calcula como nombres + apellidos). Los empleados que aún no tenían nombres
 * ni apellidos conservan su nombre completo en `nombres` — no se adivina dónde empieza el
 * apellido; se separa editando al empleado.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('employees')
            ->where(fn ($q) => $q->whereNull('nombres')->orWhere('nombres', ''))
            ->where(fn ($q) => $q->whereNull('apellidos')->orWhere('apellidos', ''))
            ->update(['nombres' => DB::raw('name')]);

        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('name');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->string('nombres')->nullable(false)->default('')->change();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('name')->default('')->after('userid');
            $table->string('nombres')->nullable()->default(null)->change();
        });

        DB::table('employees')->update(['name' => DB::raw("TRIM(CONCAT_WS(' ', nombres, apellidos))")]);
    }
};
