<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Employee;
use App\Models\Area;
use App\Models\Cargo;
use App\Models\Contrato;

class SyncEmployeesRelations extends Command
{
    protected $signature = 'employees:sync-relations';

    protected $description = 'Sincroniza áreas, cargos y contratos de empleados automáticamente';

    public function handle()
    {
        $this->info('🔄 Iniciando sincronización de empleados...');

        $updatedAreas = 0;
        $updatedCargos = 0;
        $updatedContratos = 0;

        Employee::chunk(200, function ($employees) use (
            &$updatedAreas,
            &$updatedCargos,
            &$updatedContratos
        ) {
            foreach ($employees as $employee) {

                /* ===========================
                   ÁREA ← CENTRO DE COSTO
                ============================ */
                if (empty($employee->area_id) && !empty($employee->centrocosto)) {
                    $area = Area::where('centro_costo', $employee->centrocosto)->first();

                    if ($area) {
                        $employee->area_id = $area->id;
                        $updatedAreas++;
                    }
                }

                /* ===========================
                   CARGO ← ID EXISTENTE
                ============================ */
                if (!empty($employee->cargo) && empty($employee->cargo_id)) {
                    $cargo = Cargo::where('id', $employee->cargo)->first();

                    if ($cargo) {
                        $employee->cargo_id = $cargo->id;
                        $updatedCargos++;
                    }
                }

                /* ===========================
                   CONTRATO
                ============================ */
                if (!empty($employee->tipo_contrato) && empty($employee->contrato_id)) {
                    $contrato = Contrato::where('name', $employee->tipo_contrato)->first();

                    if ($contrato) {
                        $employee->contrato_id = $contrato->id;
                        $employee->empresa = $contrato->id; // 👈 como pediste
                        $updatedContratos++;
                    }
                }

                $employee->save();
            }
        });

        $this->info('✅ Sincronización finalizada');
        $this->line('----------------------------------');
        $this->line("Áreas asignadas: {$updatedAreas}");
        $this->line("Cargos asignados: {$updatedCargos}");
        $this->line("Contratos asignados: {$updatedContratos}");
        $this->line('----------------------------------');

        return Command::SUCCESS;
    }

}

//php artisan employees:sync-relations
