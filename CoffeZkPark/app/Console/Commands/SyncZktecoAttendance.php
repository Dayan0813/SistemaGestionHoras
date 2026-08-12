<?php

namespace App\Console\Commands;

use App\Models\Device;
use App\Services\ZktecoAttendanceService;
use Illuminate\Console\Command;

class SyncZktecoAttendance extends Command
{
    protected $signature = 'zkteco:sync';

    protected $description = 'Sincroniza las marcaciones de los huelleros ZKTeco';

    public function handle(ZktecoAttendanceService $service): int
    {
        $devices = Device::all();

        if ($devices->isEmpty()) {
            $this->error('No hay dispositivos registrados.');
            return self::FAILURE;
        }

        $total = 0;

        foreach ($devices as $device) {
            try {
                $saved = $service->sync($device);

                $this->info(
                    "Marcaciones nuevas: {$saved}"
                );

                $total += $saved;

            } catch (\Throwable $e) {

                $this->error(
                    "Error: {$e->getMessage()}"
                );
            }
        }

        $this->info(
            "Total de marcaciones nuevas: {$total}"
        );

        return self::SUCCESS;
    }
}
