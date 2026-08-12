<?php

namespace App\Services;

use App\Models\Device;
use App\Models\Employee;
use App\Models\MarkingLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Jmrashed\Zkteco\Lib\ZKTeco;

class ZktecoAttendanceService
{
    public function sync(Device $device): int
    {
        $zk = new ZKTeco($device->ip, $device->port);

        try {

            if (!$zk->connect()) {
                throw new \Exception(
                    "No se pudo conectar al huellero {$device->ip}:{$device->port}"
                );
            }

            $attendance = $zk->getAttendance();

            $saved = 0;

            foreach ($attendance as $mark) {

                if (empty($mark['id']) || empty($mark['timestamp'])) {
                    continue;
                }

                // ID del empleado que entrega el huellero
                $userid = (string) $mark['id'];

                // Buscar únicamente empleados existentes
                $employee = Employee::where('userid', $userid)->first();

                // Si el empleado NO existe, ignorar la marcación
                if (!$employee) {
                    Log::info(
                        "Marcación ignorada. Empleado no registrado: {$userid}"
                    );

                    continue;
                }

                $timestamp = Carbon::parse($mark['timestamp']);

                // Guardar usando el UID REAL de employees
                $log = MarkingLog::firstOrCreate(
                    [
                        'empleado_uid' => $employee->uid,
                        'device_id' => $device->id,
                        'timestamp' => $timestamp,
                    ],
                    [
                        'fecha' => $timestamp->toDateString(),
                        'hora' => $timestamp->toTimeString(),
                        'raw' => json_encode($mark),
                    ]
                );

                // Solo contar registros nuevos
                if ($log->wasRecentlyCreated) {
                    $saved++;
                }
            }

            $zk->disconnect();

            return $saved;

        } catch (\Throwable $e) {

            try {
                $zk->disconnect();
            } catch (\Throwable $disconnectError) {
                // Ignorar error de desconexión
            }

            Log::error('Error sincronizando huellero', [
                'device_id' => $device->id,
                'ip' => $device->ip,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}