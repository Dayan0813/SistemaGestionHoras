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
        Schema::table('calendars', function (Blueprint $table) {
            $table->string('created_for_employee_uid')->nullable()->after('is_custom');

            $table->foreign('created_for_employee_uid')
                ->references('uid')
                ->on('employees')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calendars', function (Blueprint $table) {
            $table->dropForeign(['created_for_employee_uid']);
            $table->dropColumn('created_for_employee_uid');
        });
    }
};
