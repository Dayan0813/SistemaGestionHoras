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
        Schema::table('Programations', function (Blueprint $table) {
            // Nueva columna para frecuencia 
            
            //Columna para agrupar varias Programaciones juntas
            $table->string('group_code')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('Programations', function (Blueprint $table) {
            $table->dropColumn(['group_code']);
        });
    }
};
