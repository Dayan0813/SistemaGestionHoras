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
        Schema::create('marking_logs', function (Blueprint $table) {
            $table->id();

            $table->string('empleado_uid');          // UID del empleado
            $table->foreign('empleado_uid')
                ->references('uid')
                ->on('employees')
                ->onDelete('cascade');

            $table->foreignId('device_id')
                ->nullable()
                ->constrained('devices')
                ->onDelete('set null');

            $table->dateTime('timestamp');          // Marcación exacta
            $table->date('fecha');                  // YYYY-MM-DD
            $table->time('hora');

            $table->json('raw')->nullable();

            $table->timestamps();

            // Evita duplicados reales: misma marcación 2 veces
            $table->unique(['empleado_uid', 'timestamp']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('markings_logs');
    }
};
