<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Employee;
use App\Models\Contrato;

class SyncEmployeeContractsFromEmpresa extends Command
{
    protected $signature = 'employees:sync-contracts-from-empresa';
    protected $description = 'Sincroniza contrato_id y tipo_contrato usando empresa como fuente';

    public function handle()
    {
        $this->info('🔄 Sincronizando contratos desde empresa...');

        $updated = 0;
        $skipped = 0;

        Employee::chunk(200, function ($employees) use (&$updated, &$skipped) {
            foreach ($employees as $employee) {

                if (!$employee->empresa) {
                    $skipped++;
                    continue;
                }

                $contrato = Contrato::find($employee->empresa);

                if (!$contrato) {
                    $skipped++;
                    continue;
                }

                $employee->contrato_id = $contrato->id;
                $employee->tipo_contrato = $contrato->name;
                $employee->save();

                $updated++;
            }
        });

        $this->info('✅ Sincronización terminada');
        $this->line('----------------------------------');
        $this->line("Contratos asignados: {$updated}");
        $this->line("Registros ignorados: {$skipped}");
        $this->line('----------------------------------');
    }
}

// php artisan employees:sync-contracts-from-empresa