<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkConsolidationsTable extends Migration
{
    public function up()
    {
        Schema::create('work_consolidations', function (Blueprint $table) {

            $table->id();

            // Identificación del empleado
            $table->string('employee_uid');

            // Rango de la semana consolidada
            $table->date('week_start');
            $table->date('week_end');

            $table->decimal('ordinary_day', 8, 2)->default(0);              // Día ordinaria
            $table->decimal('ordinary_night', 8, 2)->default(0);            // Noche ordinaria

            $table->decimal('ordinary_festive_day', 8, 2)->default(0);      // Día festiva ordinaria
            $table->decimal('ordinary_festive_night', 8, 2)->default(0);    // Nocturna festiva ordinaria

          
            $table->decimal('extra_day', 8, 2)->default(0);                 // Extra diurna
            $table->decimal('extra_night', 8, 2)->default(0);               // Extra nocturna

            $table->decimal('extra_festive_day', 8, 2)->default(0);         // Extra festiva diurna
            $table->decimal('extra_festive_night', 8, 2)->default(0);       // Extra festiva nocturna

    
            $table->decimal('unplanned', 8, 2)->default(0);

      
            $table->json('daily_breakdown')->nullable();

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('work_consolidations');
    }
}
