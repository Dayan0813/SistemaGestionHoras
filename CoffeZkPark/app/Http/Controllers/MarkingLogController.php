<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\Employee;
use App\Models\MarkingLog;
use Illuminate\Support\Carbon;
use Jmrashed\Zkteco\Lib\ZKTeco;

class MarkingLogController extends Controller
{
    
    public function streamGlobal()
    {
        if (!auth()->check() || !auth()->user()->hasPermission('marcaciones.sincronizar')) {
            abort(403);
        }

        return response()->stream(function () {

            $totalEmpleadosNuevos = 0;
            $totalEmpleadosActualizados = 0;

            $totalNuevas = 0;
            $totalDuplicadas = 0;
            $totalIgnoradas = 0;
            $totalErrores = 0;

            $this->sendEvent('log', [
                'type' => 'info',
                'message' => 'Iniciando sincronización GLOBAL...'
            ]);

            $devices = Device::where('state', true)->get();

            if ($devices->isEmpty()) {

                $this->sendEvent('log', [
                    'type' => 'warning',
                    'message' => 'No hay dispositivos activos.'
                ]);

                $this->sendEvent('end', [
                    'done' => true,
                    'global' => true
                ]);

                return;
            }

            foreach ($devices as $device) {

                $zk = null;

                try {

                    // =================================================
                    // CONECTAR AL HUELLERO
                    // =================================================

                    $port = $device->port ?? 4370;

                    $zk = new ZKTeco(
                        $device->ip,
                        $port
                    );

                    if (!$zk->connect()) {

                        throw new \Exception(
                            "No se pudo conectar al dispositivo."
                        );
                    }

                    $this->sendEvent('log', [
                        'type' => 'success',
                        'message' =>
                            "Conectado correctamente a {$device->name}"
                    ]);


                    // =================================================
                    // SINCRONIZAR EMPLEADOS
                    // =================================================

                    $users = $zk->getUser();

                    foreach ($users as $user) {

                        try {

                            /*
                             * UID REAL DEL HUELLERO
                             *
                             * Ejemplo:
                             *
                             * uid = 417
                             * userid = 1768
                             */

                            $deviceUid = $user['uid'] ?? null;

                            $userid = isset($user['userid'])
                                ? trim((string) $user['userid'])
                                : '';

                            $name = isset($user['name'])
                                ? trim((string) $user['name'])
                                : '';

                            $cardno = isset($user['cardno'])
                                ? trim((string) $user['cardno'])
                                : null;


                            // =============================================
                            // VALIDAR
                            // =============================================

                            if (
                                $deviceUid === null ||
                                $userid === ''
                            ) {
                                continue;
                            }

                            if ($name === '') {
                                $name = 'Empleado ' . $userid;
                            }


                            // =============================================
                            // BUSCAR POR USERID
                            // =============================================

                            $employee = Employee::where(
                                'userid',
                                $userid
                            )->first();


                            // =============================================
                            // EMPLEADO NO EXISTE
                            // =============================================

                            if (!$employee) {

                                /*
                                 * Primero comprobamos que el UID del
                                 * huellero tampoco esté registrado.
                                 */

                                $employeeByUid = Employee::where(
                                    'uid',
                                    $deviceUid
                                )->first();


                                // =============================================
                                // YA EXISTE POR UID
                                // =============================================

                                if ($employeeByUid) {

                                    $employee = $employeeByUid;

                                    $employee->update([
                                        'userid' => $userid,
                                        'name' => $name,
                                        'cardno' => $cardno,
                                        'dispositivo' => $device->id,
                                    ]);

                                    $totalEmpleadosActualizados++;

                                    $this->sendEvent('log', [
                                        'type' => 'info',
                                        'message' =>
                                            "Empleado actualizado por UID: " .
                                            "{$name} " .
                                            "(UID: {$deviceUid}, " .
                                            "USERID: {$userid})"
                                    ]);

                                }

                                // =============================================
                                // CREAR EMPLEADO
                                // =============================================

                                else {

                                    $employee = Employee::create([

                                        /*
                                         * MUY IMPORTANTE:
                                         *
                                         * El UID viene del huellero.
                                         */
                                        'uid' => $deviceUid,

                                        /*
                                         * ID/USERID del huellero.
                                         */
                                        'userid' => $userid,

                                        'name' => $name,

                                        'cardno' => $cardno,

                                        'estado' => 'Activo',

                                        'dispositivo' => $device->id,

                                        /*
                                         * Información que el huellero
                                         * no proporciona.
                                         */
                                        'documentos' => null,
                                        'horario' => null,
                                        'empresa' => null,
                                        'cargo_id' => null,
                                        'dependencia' => null,
                                        'centrocosto' => null,
                                        'area_id' => null,
                                        'contrato_id' => null,
                                    ]);

                                    $totalEmpleadosNuevos++;

                                    $this->sendEvent('log', [
                                        'type' => 'success',
                                        'message' =>
                                            "Empleado creado: {$name} " .
                                            "(UID: {$deviceUid}, " .
                                            "USERID: {$userid})"
                                    ]);
                                }
                            }

                            // =============================================
                            // EMPLEADO EXISTENTE
                            // =============================================

                            else {

                                $data = [];

                                if (
                                    $name !== '' &&
                                    $employee->name !== $name
                                ) {
                                    $data['name'] = $name;
                                }

                                if (
                                    $cardno !== null &&
                                    $cardno !== '' &&
                                    $employee->cardno !== $cardno
                                ) {
                                    $data['cardno'] = $cardno;
                                }

                                if (
                                    empty($employee->dispositivo)
                                ) {
                                    $data['dispositivo'] = $device->id;
                                }

                                if (!empty($data)) {

                                    $employee->update($data);

                                    $totalEmpleadosActualizados++;
                                }
                            }

                        } catch (\Throwable $e) {

                            $totalErrores++;

                            $this->sendEvent('log', [
                                'type' => 'error',
                                'message' =>
                                    "Error sincronizando empleado: " .
                                    $e->getMessage()
                            ]);
                        }
                    }


                    // =================================================
                    // OBTENER MARCACIONES
                    // =================================================

                    $attendances = $zk->getAttendance();

                    $this->sendEvent('log', [
                        'type' => 'info',
                        'message' =>
                            "Marcaciones encontradas: " .
                            count($attendances)
                    ]);


                    // =================================================
                    // PROCESAR MARCACIONES
                    // =================================================

                    foreach ($attendances as $row) {

                        $userid = $row['id'] ?? null;
                        $timestamp = $row['timestamp'] ?? null;

                        try {

                            // =============================================
                            // VALIDAR MARCACIÓN
                            // =============================================

                            if (
                                empty($userid) ||
                                empty($timestamp)
                            ) {
                                continue;
                            }

                            $userid = trim(
                                (string) $userid
                            );


                            // =============================================
                            // BUSCAR EMPLEADO
                            // =============================================

                            $employee = Employee::where(
                                'userid',
                                $userid
                            )->first();


                            // =============================================
                            // SI NO EXISTE
                            // =============================================

                            if (!$employee) {

                                $totalIgnoradas++;

                                $this->sendEvent('log', [
                                    'type' => 'warning',
                                    'message' =>
                                        "Marcación ignorada: " .
                                        "empleado {$userid} " .
                                        "no existe en employees."
                                ]);

                                continue;
                            }


                            // =============================================
                            // FECHA
                            // =============================================

                            $dt = Carbon::parse(
                                $timestamp
                            );


                            // =============================================
                            // BUSCAR DUPLICADO
                            // =============================================

                            $existing = MarkingLog::where(
                                'empleado_uid',
                                $employee->uid
                            )
                                ->where(
                                    'device_id',
                                    $device->id
                                )
                                ->where(
                                    'timestamp',
                                    $dt
                                )
                                ->exists();


                            if ($existing) {

                                $totalDuplicadas++;

                                continue;
                            }


                            // =============================================
                            // GUARDAR MARCACIÓN
                            // =============================================

                            MarkingLog::create([

                                /*
                                 * ==================================================
                                 * IMPORTANTE
                                 * ==================================================
                                 *
                                 * Aquí NO guardamos:
                                 *
                                 * $userid
                                 *
                                 * Aquí guardamos:
                                 *
                                 * employees.uid
                                 *
                                 */

                                'empleado_uid' => $employee->uid,

                                'device_id' => $device->id,

                                'timestamp' => $dt,

                                'fecha' =>
                                    $dt->toDateString(),

                                'hora' =>
                                    $dt->toTimeString(),

                                'raw' => json_encode(
                                    $row,
                                    JSON_UNESCAPED_UNICODE
                                ),
                            ]);


                            $totalNuevas++;

                            $this->sendEvent('log', [
                                'type' => 'success',
                                'message' =>
                                    "Marcación guardada: " .
                                    "{$employee->name} " .
                                    "(USERID: {$userid}, " .
                                    "UID BD: {$employee->uid}, " .
                                    "Fecha: {$dt})"
                            ]);


                        } catch (\Throwable $e) {

                            $totalErrores++;

                            $this->sendEvent('log', [
                                'type' => 'error',
                                'message' =>
                                    "Error procesando UID {$userid}: " .
                                    $e->getMessage()
                            ]);
                        }
                    }


                    // =================================================
                    // DESCONECTAR
                    // =================================================

                    try {
                        $zk->disconnect();
                    } catch (\Throwable $e) {
                        // No hacer nada
                    }


                    $this->sendEvent('log', [
                        'type' => 'success',
                        'message' =>
                            "Sincronización terminada: " .
                            "{$device->name}"
                    ]);


                } catch (\Throwable $e) {

                    $totalErrores++;

                    if ($zk) {

                        try {
                            $zk->disconnect();
                        } catch (\Throwable $disconnectError) {
                            // Ignorar
                        }
                    }

                    $this->sendEvent('log', [
                        'type' => 'error',
                        'message' =>
                            "{$device->name}: " .
                            $e->getMessage()
                    ]);
                }
            }


            // =========================================================
            // RESUMEN
            // =========================================================

            $this->sendEvent('log', [
                'type' => 'success',
                'message' =>
                    'Sincronización GLOBAL finalizada.'
            ]);

            $this->sendEvent('log', [
                'type' => 'info',
                'message' =>
                    "Empleados nuevos: " .
                    $totalEmpleadosNuevos
            ]);

            $this->sendEvent('log', [
                'type' => 'info',
                'message' =>
                    "Marcaciones nuevas: " .
                    $totalNuevas
            ]);

            $this->sendEvent('log', [
                'type' => 'error',
                'message' =>
                    "Errores: " .
                    $totalErrores
            ]);


            // =========================================================
            // EVENTO FINAL
            // =========================================================

            $this->sendEvent('end', [
                'done' => true,
                'global' => true,

                'empleados_nuevos' =>
                    $totalEmpleadosNuevos,

                'empleados_actualizados' =>
                    $totalEmpleadosActualizados,

                'nuevas' =>
                    $totalNuevas,

                'duplicadas' =>
                    $totalDuplicadas,

                'ignoradas' =>
                    $totalIgnoradas,

                'errores' =>
                    $totalErrores,
            ]);

        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }


    /**
     * ============================================================
     * SINCRONIZACIÓN DE UN SOLO DISPOSITIVO
     * ============================================================
     */
    public function streamOnly(Device $device)
    {
        if (!auth()->check() || !auth()->user()->hasPermission('marcaciones.sincronizar')) {
            abort(403);
        }

        return response()->stream(function () use ($device) {

            $totalEmpleadosNuevos = 0;
            $totalEmpleadosActualizados = 0;

            $totalNuevas = 0;
            $totalDuplicadas = 0;
            $totalIgnoradas = 0;
            $totalErrores = 0;

            $zk = null;

            $this->sendEvent('log', [
                'type' => 'info',
                'message' =>
                    "Conectando a {$device->name}..."
            ]);

            try {

                // =================================================
                // CONEXIÓN
                // =================================================

                $port = $device->port ?? 4370;

                $zk = new ZKTeco(
                    $device->ip,
                    $port
                );

                if (!$zk->connect()) {

                    throw new \Exception(
                        "No se pudo conectar al dispositivo."
                    );
                }

                $this->sendEvent('log', [
                    'type' => 'success',
                    'message' =>
                        "Conectado correctamente."
                ]);


                // =================================================
                // EMPLEADOS
                // =================================================

                $users = $zk->getUser();


                foreach ($users as $user) {

                    try {

                        $deviceUid =
                            $user['uid'] ?? null;

                        $userid = isset($user['userid'])
                            ? trim(
                                (string) $user['userid']
                            )
                            : '';

                        $name = isset($user['name'])
                            ? trim(
                                (string) $user['name']
                            )
                            : '';

                        $cardno = isset($user['cardno'])
                            ? trim(
                                (string) $user['cardno']
                            )
                            : null;


                        if (
                            $deviceUid === null ||
                            $userid === ''
                        ) {
                            continue;
                        }

                        if ($name === '') {
                            $name =
                                'Empleado ' . $userid;
                        }


                        // =============================================
                        // BUSCAR POR USERID
                        // =============================================

                        $employee = Employee::where(
                            'userid',
                            $userid
                        )->first();


                        // =============================================
                        // CREAR
                        // =============================================

                        if (!$employee) {

                            $employeeByUid =
                                Employee::where(
                                    'uid',
                                    $deviceUid
                                )->first();


                            if ($employeeByUid) {

                                $employee =
                                    $employeeByUid;

                                $employee->update([
                                    'userid' => $userid,
                                    'name' => $name,
                                    'cardno' => $cardno,
                                    'dispositivo' =>
                                        $device->id,
                                ]);

                                $totalEmpleadosActualizados++;

                            } else {

                                $employee =
                                    Employee::create([

                                        'uid' =>
                                            $deviceUid,

                                        'userid' =>
                                            $userid,

                                        'name' =>
                                            $name,

                                        'cardno' =>
                                            $cardno,

                                        'estado' => 'Activo',

                                        'dispositivo' =>
                                            $device->id,

                                        'documentos' =>
                                            null,

                                        'horario' =>
                                            null,

                                        'empresa' =>
                                            null,

                                        'cargo_id' =>
                                            null,

                                        'dependencia' =>
                                            null,

                                        'centrocosto' =>
                                            null,

                                        'area_id' =>
                                            null,

                                        'contrato_id' =>
                                            null,
                                    ]);

                                $totalEmpleadosNuevos++;

                                $this->sendEvent('log', [
                                    'type' => 'success',
                                    'message' =>
                                        "Empleado creado: " .
                                        "{$name} " .
                                        "(UID: {$deviceUid}, " .
                                        "USERID: {$userid})"
                                ]);
                            }
                        }

                        // =============================================
                        // ACTUALIZAR
                        // =============================================

                        else {

                            $employee->update([

                                'name' =>
                                    $name,

                                'cardno' =>
                                    $cardno
                                    ?: $employee->cardno,

                                'dispositivo' =>
                                    $device->id,
                            ]);
                        }

                    } catch (\Throwable $e) {

                        $totalErrores++;

                        $this->sendEvent('log', [
                            'type' => 'error',
                            'message' =>
                                "Error sincronizando empleado: " .
                                $e->getMessage()
                        ]);
                    }
                }


                // =================================================
                // MARCACIONES
                // =================================================

                $attendances =
                    $zk->getAttendance();


                $this->sendEvent('log', [
                    'type' => 'info',
                    'message' =>
                        'Marcaciones encontradas: ' .
                        count($attendances)
                ]);


                foreach ($attendances as $row) {

                    $userid =
                        $row['id'] ?? null;

                    $timestamp =
                        $row['timestamp'] ?? null;

                    try {

                        if (
                            empty($userid) ||
                            empty($timestamp)
                        ) {
                            continue;
                        }

                        $userid =
                            trim(
                                (string) $userid
                            );


                        // =============================================
                        // BUSCAR EMPLEADO
                        // =============================================

                        $employee =
                            Employee::where(
                                'userid',
                                $userid
                            )->first();


                        // =============================================
                        // NO EXISTE
                        // =============================================

                        if (!$employee) {

                            $totalIgnoradas++;

                            $this->sendEvent('log', [
                                'type' => 'warning',
                                'message' =>
                                    "Marcación ignorada: " .
                                    "empleado {$userid} " .
                                    "no existe."
                            ]);

                            continue;
                        }


                        // =============================================
                        // FECHA
                        // =============================================

                        $dt =
                            Carbon::parse(
                                $timestamp
                            );


                        // =============================================
                        // DUPLICADO
                        // =============================================

                        $existing =
                            MarkingLog::where(
                                'empleado_uid',
                                $employee->uid
                            )
                            ->where(
                                'device_id',
                                $device->id
                            )
                            ->where(
                                'timestamp',
                                $dt
                            )
                            ->exists();


                        if ($existing) {

                            $totalDuplicadas++;

                            continue;
                        }


                        // =============================================
                        // GUARDAR
                        // =============================================

                        MarkingLog::create([

                            'empleado_uid' =>
                                $employee->uid,

                            'device_id' =>
                                $device->id,

                            'timestamp' =>
                                $dt,

                            'fecha' =>
                                $dt->toDateString(),

                            'hora' =>
                                $dt->toTimeString(),

                            'raw' =>
                                json_encode(
                                    $row,
                                    JSON_UNESCAPED_UNICODE
                                ),
                        ]);


                        $totalNuevas++;

                        $this->sendEvent('log', [
                            'type' => 'success',
                            'message' =>
                                "Marcación guardada: " .
                                "{$employee->name} " .
                                "(USERID: {$userid}, " .
                                "UID: {$employee->uid})"
                        ]);


                    } catch (\Throwable $e) {

                        $totalErrores++;

                        $this->sendEvent('log', [
                            'type' => 'error',
                            'message' =>
                                "Error procesando UID {$userid}: " .
                                $e->getMessage()
                        ]);
                    }
                }


                // =================================================
                // DESCONECTAR
                // =================================================

                try {
                    $zk->disconnect();
                } catch (\Throwable $e) {
                    // Ignorar
                }


            } catch (\Throwable $e) {

                $totalErrores++;

                if ($zk) {

                    try {
                        $zk->disconnect();
                    } catch (\Throwable $disconnectError) {
                        // Ignorar
                    }
                }

                $this->sendEvent('log', [
                    'type' => 'error',
                    'message' =>
                        $e->getMessage()
                ]);
            }


            // =================================================
            // RESUMEN
            // =================================================

            $this->sendEvent('log', [
                'type' => 'success',
                'message' =>
                    "Sincronización de {$device->name} finalizada."
            ]);

            $this->sendEvent('log', [
                'type' => 'info',
                'message' =>
                    "Empleados nuevos: " .
                    $totalEmpleadosNuevos
            ]);

            $this->sendEvent('log', [
                'type' => 'info',
                'message' =>
                    "Marcaciones nuevas: " .
                    $totalNuevas
            ]);

            $this->sendEvent('log', [
                'type' => 'error',
                'message' =>
                    "Errores: " .
                    $totalErrores
            ]);


            $this->sendEvent('end', [
                'done' => true,
                'global' => false,
                'device_id' => $device->id,

                'empleados_nuevos' =>
                    $totalEmpleadosNuevos,

                'empleados_actualizados' =>
                    $totalEmpleadosActualizados,

                'nuevas' =>
                    $totalNuevas,

                'duplicadas' =>
                    $totalDuplicadas,

                'ignoradas' =>
                    $totalIgnoradas,

                'errores' =>
                    $totalErrores,
            ]);

        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }


    /**
     * ============================================================
     * ENVIAR EVENTOS SSE
     * ============================================================
     */
    private function sendEvent(
        string $event,
        array $data
    ): void {

        echo "event: {$event}\n";

        echo "data: " .
            json_encode(
                $data,
                JSON_UNESCAPED_UNICODE
            ) .
            "\n\n";

        if (ob_get_level() > 0) {
            ob_flush();
        }

        flush();
    }
}