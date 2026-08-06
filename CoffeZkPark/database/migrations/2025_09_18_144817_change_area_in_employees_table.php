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
        Schema::table('employees', function (Blueprint $table) {
            // Eliminamos el campo string actual
            //$table->dropColumn('area');

            // Agregamos la relación
            if (!Schema::hasColumn('employees', 'area_id')) {
                $table->foreignId('area_id')
                    ->nullable()
                    ->constrained('areas')
                    ->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('area')->nullable();
            $table->dropForeign(['area_id']);
            $table->dropColumn('area_id');
        });
    }
};
