<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Calendario operativo del parque: el administrador define tipos de día (AA, A, B, C...),
 * asigna un tipo a cada fecha y fija cuántas personas necesita cada área según el tipo.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Tipos de día configurables (nombre, color y orden en que se muestran).
        Schema::create('day_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 30)->unique();
            $table->string('color', 7)->default('#95c020');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Tipo de día de cada fecha (una fecha sin fila = sin tipo asignado).
        Schema::create('operating_days', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->foreignId('day_type_id')->constrained('day_types')->cascadeOnDelete();
            $table->timestamps();
        });

        // Personal mínimo programado por área según el tipo de día.
        Schema::create('day_type_staffing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('area_id')->constrained('areas')->cascadeOnDelete();
            $table->foreignId('day_type_id')->constrained('day_types')->cascadeOnDelete();
            $table->unsignedSmallInteger('min_staff');
            $table->timestamps();
            $table->unique(['area_id', 'day_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('day_type_staffing');
        Schema::dropIfExists('operating_days');
        Schema::dropIfExists('day_types');
    }
};
