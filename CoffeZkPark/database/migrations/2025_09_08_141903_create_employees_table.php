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
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();   // Relación con attendance.uid
            $table->string('userid')->nullable();
            $table->string('name');
            $table->string('cardno')->nullable();
            $table->string('estado')->default('Activo');
            $table->string('documentos')->nullable();
            $table->string('dispositivo')->nullable();
            $table->string('horario')->nullable();
            $table->string('empresa')->nullable();
            $table->string('cargo')->nullable();
            $table->string('dependencia')->nullable();
            $table->string('centrocosto')->nullable();
            $table->string('tipo_contrato')->nullable();
            $table->timestamps();
            $table->foreignId('area_id')->nullable()->constrained('areas')->onDelete('set null');
        }); 
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
