<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Request;
use Jmrashed\Zkteco\Lib\ZKTeco;

class ZKTecoController extends Controller
{
    /**
     * Intenta conectar y obtener las marcaciones de múltiples dispositivos ZKTeco.
     */
    public function index()
    {
        // Dispositivos activos registrados en la tabla `devices` (antes era una
        // lista de IPs fija en el código: agregar/quitar un dispositivo exigía
        // un despliegue).
        $devices = Device::where('state', true)->get();

        $output = [];

        // Iterar sobre cada dispositivo para intentar la conexión individual
        foreach ($devices as $device) {
            $ip = $device->ip;
            $puerto = $device->port ?? 4370;

            // 1. Crear una nueva instancia de ZKTeco para el dispositivo actual
            $zk = new ZKTeco($ip, $puerto);

            // 2. Intentar conectar
            if ($zk->connect()) {

                try {
                    // Conexión exitosa, obtener las marcaciones
                    $attendances = $zk->getAttendance();

                    $output[$ip] = [
                        'status' => 'Conectado exitosamente',
                        'data_count' => is_array($attendances) ? count($attendances) : 0,
                        'attendance' => $attendances
                    ];
                } catch (\Exception $e) {
                    // Capturar errores durante la obtención de datos
                    $output[$ip] = [
                        'status' => 'Conectado, pero error al obtener datos',
                        'error_message' => $e->getMessage(),
                        'attendance' => []
                    ];
                }

                // 3. Desconectar siempre que la conexión fue exitosa
                $zk->disconnect();
            } else {
                // Error de conexión
                $output[$ip] = [
                    'status' => 'Error de conexión',
                    'message' => "No se pudo conectar al dispositivo en la IP: {$ip}",
                    'attendance' => []
                ];
            }
        }

        // Devolver los resultados combinados de todos los dispositivos
        return response()->json($output);
    }
}
