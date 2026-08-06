<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            $table->foreignId('work_position_id')
                ->nullable()
                ->after('calendar_id')
                ->constrained('work_positions')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            $table->dropForeign(['work_position_id']);
            $table->dropColumn('work_position_id');
        });
    }
};
