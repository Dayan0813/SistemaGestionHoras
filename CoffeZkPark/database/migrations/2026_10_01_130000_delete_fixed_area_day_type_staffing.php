<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * El personal mínimo por tipo de día solo aplica a áreas variables (Operaciones): se borran los
 * mínimos que se habían guardado para áreas de turno fijo.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('day_type_staffing')
            ->whereIn('area_id', DB::table('areas')->where('scheduling_mode', '!=', 'variable')->select('id'))
            ->delete();
    }

    public function down(): void
    {
        // Los mínimos borrados no se recuperan.
    }
};
