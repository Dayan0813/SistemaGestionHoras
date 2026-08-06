<?php

namespace App\Http\Controllers;


use App\Models\Device;
use App\Models\MarkingLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Jmrashed\Zkteco\Lib\ZKTeco;

class MarkingLogController extends Controller
{

    /**
     * =========================================
     * 
     *  Steams Globales para la descarga de marcaciones
     * 
     * =========================================
     * 
     */

    public function streamGlobal()
    {

        if (!auth()->check() || !auth()->user()->hasRole('admin')) {
            abort(403);
        }

        return response()->stream(function () {

            $this->sendEvent('log', [
                'type' => 'info',
                'message' => 'Iniciando sincronización...'
            ]);

            $devices = Device::where('state', true)->get();

            foreach ($devices as $device) {

                // INFO
                $this->sendEvent('log', [
                    'type' => 'info',
                    'message' => "Conectando a {$device->name}"
                ]);

                try {
                    $zk = new ZKTeco($device->ip, $device->puerto ?? 4370);

                    if (!$zk->connect()) {
                        throw new \Exception('No se pudo conectar al dispositivo');
                    }

                    $attendances = $zk->getAttendance();

                    foreach ($attendances as $row) {
                        try {
                            $uid = $row['id'] ?? null;
                            $ts  = $row['timestamp'] ?? null;

                            if (!$uid || !$ts) {
                                throw new \Exception('Datos incompletos');
                            }

                            $dt = \Carbon\Carbon::parse($ts);

                            if (!MarkingLog::where('empleado_uid', $uid)
                                ->where('timestamp', $dt)->exists()) {

                                MarkingLog::create([
                                    'empleado_uid' => $uid,
                                    'device_id' => $device->id,
                                    'timestamp' => $dt,
                                    'fecha' => $dt->toDateString(),
                                    'hora' => $dt->toTimeString(),
                                    'raw' => $row,
                                ]);
                            }

                            // SUCCESS
                            $this->sendEvent('log', [
                                'type' => 'success',
                                'message' => "Empleado UID {$uid} descargado desde {$device->name}"
                            ]);
                        } catch (\Exception $e) {
                            // ERROR
                            $this->sendEvent('log', [
                                'type' => 'error',
                                'message' => "Error UID {$uid}: {$e->getMessage()}"
                            ]);
                        }
                    }

                    $zk->disconnect();
                } catch (\Exception $e) {
                    // WARNING
                    $this->sendEvent('log', [
                        'type' => 'warning',
                        'message' => "{$device->name}: {$e->getMessage()}"
                    ]);
                }
            }

            // FIN
            $this->sendEvent('end', ['done' => true]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
        ]);
    }

    /**
     * Helper SSE
     */
    private function sendEvent(string $event, array $data)
    {
        echo "event: {$event}\n";
        echo "data: " . json_encode($data) . "\n\n";
        ob_flush();
        flush();
    }


    /**
     * =========================================
     * 
     *  Steams unitario para la descarga de marcaciones
     * 
     * =========================================
     * 
     */

    public function streamOnly(Device $device)
    {
        return response()->stream(function () use ($device) {
            $this->sendEvent('log', [
                'type' => 'info',
                'message' => "Conectando a {$device->name}"
            ]);

                       

            try {
                      
                $zk = new ZKTeco($device->ip, $device->puerto ?? 4370);

                if (!$zk->connect()) {

                    throw new \Exception('No se pudo conectar al dispositivo');
                }

                foreach ($zk->getAttendance() as $row) {
                    try {
                        $uid = $row['id'];

        
            $this->sendEvent('log', [
                'type' => 'info',
                'message' => "{$row['id']}"
            ]);





                        $dt = \Carbon\Carbon::parse($row['timestamp']);
                        MarkingLog::firstOrCreate([
                            'empleado_uid' => $uid,
                            'timestamp' => $dt,
                        ], [
                            'device_id' => $device->id,
                            'fecha' => $dt->toDateString(),
                            'hora' => $dt->toTimeString(),
                            'raw' => $row,
                        ]);

                        $this->sendEvent('log', [
                            'type' => 'success',
                            'message' => "Empleado UID {$uid} descargado desde {$device->name}"
                        ]);
                    } catch (\Exception $e) {
                        $this->sendEvent('log', [
                            'type' => 'error',
                            'message' => "Error UID {$uid}: {$e->getMessage()}"
                        ]);
                    }
                }

                $zk->disconnect();
            } catch (\Exception $e) {
                $this->sendEvent('log', [
                    'type' => 'warning',
                    'message' => "{$device->name}: {$e->getMessage()}"
                ]);
            }

            $this->sendEvent('end', ['done' => true]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
        ]);
    }
}
