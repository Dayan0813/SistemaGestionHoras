<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * cargo_id y contrato_id se agregaron como unsignedBigInteger sueltos,
     * sin llave foránea real: la integridad dependía por completo de la
     * validación `exists:` a nivel de aplicación.
     */
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->foreign('cargo_id')->references('id')->on('cargo')->nullOnDelete();
            $table->foreign('contrato_id')->references('id')->on('contrato')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropForeign(['cargo_id']);
            $table->dropForeign(['contrato_id']);
        });
    }
};
