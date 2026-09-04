<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            $table->enum('scheduling_mode', ['fijo', 'variable'])->default('fijo')->after('descripcion');
        });
    }

    public function down(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            $table->dropColumn('scheduling_mode');
        });
    }
};
