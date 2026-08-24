<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function newPermissions(): array
    {
        return [
            'areas.ver' => 'Consultar áreas',
            'work_positions.ver' => 'Consultar puestos de trabajo',
        ];
    }

    private function finalRolePermissions(): array
    {
        return [
            'coordinator' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver',
                'empleados.ver', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'aux_admin_th' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver',
                'empleados.ver', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'admin_nomina' => [
                'empleados.ver', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'aux_th' => [
                'programaciones.ver',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver',
                'empleados.ver', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
                'marcaciones.ver',
                'marcaciones.sincronizar',
            ],
        ];
    }

    private function previousRolePermissions(): array
    {
        return [
            'coordinator' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'areas.gestionar', 'calendarios.gestionar',
            ],
            'aux_admin_th' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'empleados.ver',
            ],
            'admin_nomina' => [
                'empleados.ver', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'aux_th' => [
                'programaciones.ver',
                'empleados.ver',
                'marcaciones.ver',
                'marcaciones.sincronizar',
            ],
        ];
    }

    /**
     * Reescribe role_permissions desde cero: admin recibe todos los permisos
     * existentes, y el resto de roles reciben exactamente lo indicado en el mapa.
     */
    private function applyMatrix(array $roleNamesToPermissionNames): void
    {
        DB::table('role_permissions')->delete();

        $permissionIds = DB::table('permissions')->pluck('id', 'name');

        // admin: todos los permisos existentes
        $rows = [];
        foreach ($permissionIds as $permissionId) {
            $rows[] = [
                'role' => 'admin',
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        foreach ($roleNamesToPermissionNames as $role => $permissionNames) {
            foreach ($permissionNames as $name) {
                if (!isset($permissionIds[$name])) {
                    continue;
                }

                $rows[] = [
                    'role' => $role,
                    'permission_id' => $permissionIds[$name],
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('role_permissions')->insert($chunk);
        }
    }

    public function up(): void
    {
        foreach ($this->newPermissions() as $name => $description) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name],
                ['description' => $description, 'created_at' => now(), 'updated_at' => now()]
            );
        }

        $this->applyMatrix($this->finalRolePermissions());
    }

    public function down(): void
    {
        $this->applyMatrix($this->previousRolePermissions());

        $newPermissionNames = array_keys($this->newPermissions());
        $ids = DB::table('permissions')->whereIn('name', $newPermissionNames)->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('name', $newPermissionNames)->delete();
    }
};
