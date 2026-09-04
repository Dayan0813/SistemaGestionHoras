<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            // Array de enteros ISO-8601 (1=Lunes ... 7=Domingo). NULL = cubre todos los
            // dias del rango (comportamiento actual, modo de programacion "variable").
            $table->json('work_days')->nullable()->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('programations', function (Blueprint $table) {
            $table->dropColumn('work_days');
        });
    }
};
