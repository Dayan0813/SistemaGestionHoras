<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Jmrashed\Zkteco\Lib\ZKTeco;

class ZKTecoController extends Controller
{
    /**
     * Intenta conectar y obtener las marcaciones de múltiples dispositivos ZKTeco.
     */
    public function index()
    {
        // Lista de IPs de tus dispositivos y el puerto (por defecto es 4370)
        $ips_dispositivos = [
            '192.168.0.204',
            '192.168.0.254',
            '192.168.0.206',
            '192.168.0.202'
        ];
        $puerto = 4370; // Puerto estándar de ZKTeco

        $output = [];

        // Iterar sobre cada IP para intentar la conexión individual
        foreach ($ips_dispositivos as $ip) {

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
