<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Employee;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class SyncEmployeeStatus extends Command
{
    protected $signature = 'employees:sync-status {file}';
    protected $description = 'Sincroniza el estado de empleados desde Excel usando UID';

    public function handle()
    {
        $filePath = $this->argument('file');

        if (!file_exists($filePath)) {
            $this->error('❌ El archivo no existe');
            return Command::FAILURE;
        }

        $this->info('📥 Leyendo Excel...');

        $rows = Excel::toCollection(new class implements WithHeadingRow {}, $filePath)->first();

        $actualizados = 0;
        $uidsProcesados = [];

        foreach ($rows as $row) {

            // 🔥 CLAVE: forzar a string limpio
            $uidExcel = trim((string) $row['codempleado']);
            $activoExcel = (int) $row['activo'];

            if ($uidExcel === '') {
                continue;
            }

            $estado = $activoExcel === 1 ? 'Activo' : 'Inactivo';

            $employee = Employee::where('uid', $uidExcel)->first();

            if ($employee) {
                $employee->estado = $estado;
                $employee->save();

                $actualizados++;
                $uidsProcesados[] = $uidExcel;
            }
        }

        // 🛑 Protección crítica
        if ($actualizados === 0) {
            $this->error('❌ No hubo coincidencias de UID. Sync cancelado por seguridad.');
            return Command::FAILURE;
        }

        $inactivos = Employee::whereNotIn('uid', $uidsProcesados)
            ->update(['estado' => 'Inactivo']);

<<<<<<< HEAD
        $this->info("✅ Empleados actualizados: {$actualizados}");
=======
>>>>>>> origin/feature/hernandez
        $this->info("🚫 Empleados marcados como Inactivos: {$inactivos}");

        return Command::SUCCESS;
    }
}

//php artisan employees:sync-status storage/app/CodEmpleadoActive.xlsx

