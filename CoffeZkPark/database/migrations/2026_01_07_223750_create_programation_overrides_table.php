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
        Schema::create('programation_overrides', function (Blueprint $table) {
            $table->id();

            $table->foreignId('programation_id')
                ->constrained('programations') 
                ->cascadeOnDelete();

            $table->date('date');

            $table->foreignId('calendar_id')
                ->constrained('calendars')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->unique(['programation_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programation_overrides');
    }
};
