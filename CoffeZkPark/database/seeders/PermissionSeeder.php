<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\RolePermission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'programaciones.ver' => 'Consultar programaciones',
            'programaciones.crear' => 'Crear programaciones',
            'programaciones.editar' => 'Editar programaciones',
            'empleados.ver' => 'Consultar empleados',
            'empleados.crear' => 'Crear empleados',
            'empleados.editar' => 'Editar empleados',
            'empleados.eliminar' => 'Eliminar empleados',
            'consolidados.ver' => 'Consultar consolidados',
            'consolidados.generar' => 'Generar consolidados',
            'marcaciones.ver' => 'Consultar marcaciones',
            'marcaciones.sincronizar' => 'Sincronizar marcaciones',
            'areas.ver' => 'Consultar áreas',
            'areas.gestionar' => 'Gestionar áreas',
            'calendarios.gestionar' => 'Gestionar calendarios',
            'usuarios.gestionar' => 'Gestionar usuarios',
            'dispositivos.gestionar' => 'Gestionar dispositivos',
            'work_positions.ver' => 'Consultar puestos de trabajo',
            'work_positions.gestionar' => 'Gestionar puestos de trabajo',
        ];

        foreach ($permissions as $name => $description) {
            Permission::updateOrCreate(['name' => $name], ['description' => $description]);
        }

        $all = array_keys($permissions);
        $rolePermissions = [
            'admin' => $all,
            'coordinator' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver', 'work_positions.gestionar',
                'empleados.ver', 'empleados.crear', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'aux_admin_th' => [
                'programaciones.ver', 'programaciones.crear', 'programaciones.editar',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver', 'work_positions.gestionar',
                'empleados.ver', 'empleados.crear', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
            ],
            'admin_nomina' => [
                'empleados.ver', 'empleados.crear', 'empleados.editar', 'empleados.eliminar',
              
                'consolidados.ver', 'consolidados.generar',
            ],
            'aux_th' => [
                'programaciones.ver',
                'areas.ver', 'calendarios.gestionar', 'work_positions.ver',
                'empleados.ver', 'empleados.crear', 'empleados.editar', 'empleados.eliminar',
                'consolidados.ver', 'consolidados.generar',
                'marcaciones.ver',
                'marcaciones.sincronizar',
            ],
        ];

        foreach ($rolePermissions as $role => $names) {
            foreach ($names as $name) {
                RolePermission::firstOrCreate([
                    'role' => $role,
                    'permission_id' => Permission::where('name', $name)->value('id'),
                ]);
            }
        }
    }
}