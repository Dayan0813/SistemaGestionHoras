<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use App\Services\AttendanceSyncService;

class Sync extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sincroniza Marcaciones desde todos los dispositivos zkteco';

    /**
     * Execute the console command.
     */
    public function handle(AttendanceSyncService $syncService)
    {

        $this->info("Iniciando Sincronizacion de Marcaciones...");

        $results = $syncService->syncAllDevices();

        foreach ($results as $result) {
            $mensaje = "Dispositivo: {$result['device']} | Estado: {$result['status']} | Registros Nuevos: {$result['count']}";

            // Mostrar en consola
            $this->line($mensaje);

            // Guardar en log

            Log::info($mensaje);

            if (isset($result['message'])) {
                $this->warn("Mensaje: {$result['message']}");
            }
        }

        $this->info('Sincronizacion Completada.');
        Log::info('Sincronizacion Completada.');


        return 0;
    }
}
