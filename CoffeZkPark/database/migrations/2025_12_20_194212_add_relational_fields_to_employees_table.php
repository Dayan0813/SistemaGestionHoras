<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->unsignedBigInteger('cargo_id')->nullable()->after('cargo');
            $table->unsignedBigInteger('contrato_id')->nullable()->after('tipo_contrato');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['cargo_id', 'contrato_id']);
        });
    }
};
