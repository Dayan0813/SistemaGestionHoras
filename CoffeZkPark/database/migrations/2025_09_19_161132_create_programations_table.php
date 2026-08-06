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
        Schema::create('Programations', function (Blueprint $table) {
            $table->id();

            //Relacion con empleados
            $table->string('employee_uid');

            $table->foreign('employee_uid')
                ->references('uid')
                ->on('employees')
                ->onDelete('cascade');

            //Relacion con areas
            $table->foreignId('area_id')
                ->constrained('areas')
                ->onDelete('cascade');

            //Mes/año de la programacion
            $table->date('start_date');
            $table->date('end_date');

            //Status de la programacion
            $table->enum('status', ['Programado', 'Sin Programar', 'Completado', 'Cancelado'])
                ->default('Sin Programar');


            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('Programations');
    }
};
