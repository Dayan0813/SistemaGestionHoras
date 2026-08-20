<?php

namespace Tests\Feature;

use Tests\TestCase;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

use App\Models\calendars;
use App\Models\Programations;
use App\Models\MarkingLog;
use App\Services\ConsolidationEngine;
use App\Services\ScheduleResolver;
use App\Services\MarkingResolver;

class ConsolidationEngineTest extends TestCase
{
    use RefreshDatabase;

    protected ConsolidationEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();

        // --------------------------------------------------------------------
        // AJUSTE DE DEPENDENCIAS
        // --------------------------------------------------------------------

        // 1. Crear el registro de Área (Necesario para 'area_id' = 1)
        DB::table('areas')->insert([
            'id'          => 1, 
            'nombre'      => 'Area de Test', 
            'descripcion' => 'Area para pruebas unitarias.',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
        
        // 2. Crear los registros de Empleados
        $employeeUids = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'];
        foreach ($employeeUids as $uid) {
            DB::table('employees')->insert([
                'uid'       => $uid,
                'area_id'   => 1, 
                'name'      => 'Test Employee ' . $uid,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 3. Crear los calendarios
        calendars::create([
            'id'           => 1,
            'hora_entrada' => '08:00:00',
            'hora_salida'  => '18:00:00',
            'shift_type'   => 'D'
        ]);

        calendars::create([
            'id'           => 2,
            'hora_entrada' => '18:00:00',
            'hora_salida'  => '06:00:00',
            'shift_type'   => 'N'
        ]);
        
        $this->engine = new ConsolidationEngine(
            new ScheduleResolver(),
            new MarkingResolver()
        );
    }

    /* ============================================================
     * Helpers
     * ============================================================ */

    private function createProgramation(
        string $uid,
        Carbon $start,
        Carbon $end,
        int $calendarId,
        array $days
    ) {
        return Programations::create([
            'employee_uid'   => $uid,
            'area_id'        => 1,
            'status'         => 'Programado',
            'frequency'      => 'monthly',
            'group_code'     => 'TEST',
            'start_date'     => $start,
            'end_date'       => $end,
            'calendar_id'    => $calendarId,
            'work_days'      => $days,
            'excluded_dates' => [],
        ]);
    }

    private function createMark(string $uid, string $timestamp)
    {
        return MarkingLog::create([
            'empleado_uid' => $uid,
            'timestamp'    => $timestamp,
            'fecha'        => substr($timestamp, 0, 10),
            'hora'         => substr($timestamp, 11, 8),
        ]);
    }

    /* ============================================================
     * TESTS UNITARIOS DEL MOTOR
     * ============================================================ */

    public function test_diurnal_simple_shift()
    {
        $uid = "E1";
        $this->createProgramation($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-07"), 1, ['lun']);
        $this->createMark($uid, "2025-12-01 08:00:00");
        $this->createMark($uid, "2025-12-01 17:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-01"));
        $this->assertEquals(9, round($data['totals']['ordinary_day'], 2));
    }

    public function test_diurnal_late_exit_extras()
    {
        $uid = "E2";
        $this->createProgramation($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-07"), 1, ['lun']);
        $this->createMark($uid, "2025-12-01 08:00:00");
        $this->createMark($uid, "2025-12-01 20:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-01"));
        $this->assertTrue($data['totals']['extra_day'] > 0 || $data['totals']['extra_night'] > 0);
    }

    /**
     * @test
     * CASO CRÍTICO: Turno extra que empieza fuera de horario y cruza al domingo (festivo).
     * Horas trabajadas: 18:00 Sáb a 02:00 Dom (8 horas extra/festivas).
     */
    public function test_diurnal_cross_to_sunday()
    {
        $uid = "E3";
        // Programado Sábado (Día 1)
        $this->createProgramation($uid, Carbon::parse("2025-12-06"), Carbon::parse("2025-12-06"), 1, ['sab']);
        // Marcas de 18:00 Sáb a 02:00 Dom
        $this->createMark($uid, "2025-12-06 18:00:00");
        $this->createMark($uid, "2025-12-07 02:00:00");
        
        // Consolidación en el rango Sábado a Domingo
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-06"), Carbon::parse("2025-12-07"));

        dd($data); // DEBUG: Ver estructura completa de $data

        // Definimos las categorías donde deberían caer las 8 horas (Extra Diurna, Nocturna, Festiva)
        $categories_to_check = [
            'extra_day', 
            'extra_night', 
            'extra_festive_night', 
            'extra_festive_day',
        ];
        
        $total_relevant_hours = 0;
        
        foreach ($categories_to_check as $category) {
            if (array_key_exists($category, $data['totals'])) {
                $total_relevant_hours += $data['totals'][$category];
            }
        }
        
        // 🛑 ASERCIÓN FINAL: Esperamos que el motor clasifique exactamente 8 horas.
        // Usamos assertGreaterThan/assertLessThan para evitar problemas de precisión de coma flotante.
        $this->assertGreaterThan(7.99, $total_relevant_hours, 'El motor no está contabilizando las 8 horas extras/festivas (Total < 8.0).');
        $this->assertLessThan(8.01, $total_relevant_hours, 'El motor está contando más de las 8 horas trabajadas (Total > 8.0).');
    }

    public function test_nocturnal_regular_shift()
    {
        $uid = "E4";
        $this->createProgramation($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-07"), 2, ['lun']);
        $this->createMark($uid, "2025-12-01 18:00:00");
        $this->createMark($uid, "2025-12-02 06:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-02"));
        // El turno nocturno es de 12 horas, pero la hora de almuerzo suele descontarse, 
        // por lo que 11 horas es un resultado común.
        $this->assertEquals(11, round($data['totals']['ordinary_night'], 0)); 
    }

    public function test_nocturnal_early_entry()
    {
        $uid = "E5";
        $this->createProgramation($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-07"), 2, ['lun']);
        // Entrada 16:00 (2 horas antes del inicio programado 18:00)
        $this->createMark($uid, "2025-12-01 16:00:00");
        $this->createMark($uid, "2025-12-02 06:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-02"));
        // Esperamos que las 2 horas de 16:00 a 18:00 sean extra_day
        $this->assertTrue($data['totals']['extra_day'] > 0);
    }

    public function test_nocturnal_cross_to_sunday()
    {
        $uid = "E6";
        $this->createProgramation($uid, Carbon::parse("2025-12-06"), Carbon::parse("2025-12-06"), 2, ['sab']);
        // 18:00 Sáb a 06:00 Dom
        $this->createMark($uid, "2025-12-06 18:00:00");
        $this->createMark($uid, "2025-12-07 06:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-06"), Carbon::parse("2025-12-07"));
        // Esperamos que las horas del Domingo (00:00 a 06:00) se clasifiquen como festivas.
        $this->assertTrue($data['totals']['ordinary_festive_night'] > 0);
    }

    public function test_unplanned_day()
    {
        $uid = "E7";
        // Día no programado
        $this->createMark($uid, "2025-12-01 08:00:00");
        $this->createMark($uid, "2025-12-01 12:00:00");
        $data = $this->engine->consolidate($uid, Carbon::parse("2025-12-01"), Carbon::parse("2025-12-01"));
        // Esperamos 4 horas como no planificadas.
        $this->assertEquals(4, round(abs($data['totals']['unplanned']), 0));
    }
}