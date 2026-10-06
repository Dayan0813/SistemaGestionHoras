<?php

namespace Database\Seeders;

use App\Models\area;
use App\Models\Employee;
use Illuminate\Database\Seeder;

class CentroCostoAreasSeeder extends Seeder
{
    public function run(): void
    {
        $areas = [
            ['centro_costo' => '1001', 'nombre' => 'Gerencia General'],
            ['centro_costo' => '1002', 'nombre' => 'Asistente de Gerencia'],
            ['centro_costo' => '1003', 'nombre' => 'Dirección Administrativa'],
            ['centro_costo' => '1004', 'nombre' => 'Secretaría'],
            ['centro_costo' => '1005', 'nombre' => 'Mensajería'],
            ['centro_costo' => '1006', 'nombre' => 'Contabilidad'],
            ['centro_costo' => '1007', 'nombre' => 'Tesorería'],
            ['centro_costo' => '1008', 'nombre' => 'Sistemas'],
            ['centro_costo' => '1009', 'nombre' => 'Gestión Humana'],
            ['centro_costo' => '1010', 'nombre' => 'Gestión Humana 2'],
            ['centro_costo' => '1011', 'nombre' => 'Publicidad'],
            ['centro_costo' => '1014', 'nombre' => 'Compras'],
            ['centro_costo' => '1015', 'nombre' => 'Control Interno'],
            ['centro_costo' => '1016', 'nombre' => 'Aprendices SENA'],
            ['centro_costo' => '1017', 'nombre' => 'Primeros Auxilios'],
            ['centro_costo' => '1022', 'nombre' => 'Taquillas'],
            ['centro_costo' => '1028', 'nombre' => 'Informadores'],
            ['centro_costo' => '1031', 'nombre' => 'Oficina Armenia'],
            ['centro_costo' => '1033', 'nombre' => 'Guadual Plaza'],
            ['centro_costo' => '1036', 'nombre' => 'Heladería Yippe'],
            ['centro_costo' => '1037', 'nombre' => 'Parrilla Orquídeas'],
            ['centro_costo' => '1038', 'nombre' => 'Pandebonos del Parque'],
            ['centro_costo' => '1039', 'nombre' => 'Parrilla Plaza'],
            ['centro_costo' => '1040', 'nombre' => 'Heladería Bomberos'],
            ['centro_costo' => '1042', 'nombre' => 'Subway'],
            ['centro_costo' => '1043', 'nombre' => 'Heladería Krater'],
            ['centro_costo' => '1046', 'nombre' => 'Guadual Orquídeas'],
            ['centro_costo' => '1047', 'nombre' => 'Parrilla Caballerizas'],
            ['centro_costo' => '2000', 'nombre' => 'Mantenimiento General'],
            ['centro_costo' => '2006', 'nombre' => 'Obras Civiles'],
            ['centro_costo' => '2007', 'nombre' => 'Servicios Generales'],
            ['centro_costo' => '2008', 'nombre' => 'Seguridad'],
            ['centro_costo' => '2017', 'nombre' => 'Fontanería'],
            ['centro_costo' => '2018', 'nombre' => 'Pintura'],
            ['centro_costo' => '2100', 'nombre' => 'Locomotora Porter'],
            ['centro_costo' => '2101', 'nombre' => 'Locomotora a Vapor'],
            ['centro_costo' => '2104', 'nombre' => 'Tren'],
            ['centro_costo' => '2105', 'nombre' => 'Teleférico'],
            ['centro_costo' => '2106', 'nombre' => 'Montaña Rusa'],
            ['centro_costo' => '2107', 'nombre' => 'Show de las Orquídeas'],
            ['centro_costo' => '2108', 'nombre' => 'Montaña Acuática'],
            ['centro_costo' => '2109', 'nombre' => 'Botes Chocones'],
            ['centro_costo' => '2110', 'nombre' => 'Rin Rin'],
            ['centro_costo' => '2111', 'nombre' => 'Ciclón'],
            ['centro_costo' => '2112', 'nombre' => 'Barón Rojo'],
            ['centro_costo' => '2113', 'nombre' => 'Karts'],
            ['centro_costo' => '2114', 'nombre' => 'Carros Chocones'],
            ['centro_costo' => '2115', 'nombre' => 'Pulpo'],
            ['centro_costo' => '2116', 'nombre' => 'Carrusel'],
            ['centro_costo' => '2117', 'nombre' => 'Panorámica'],
            ['centro_costo' => '2118', 'nombre' => 'Show del Café'],
            ['centro_costo' => '2119', 'nombre' => 'Telesillas'],
            ['centro_costo' => '2120', 'nombre' => 'Cafeteritos'],
            ['centro_costo' => '2121', 'nombre' => 'Barca del Café'],
            ['centro_costo' => '2122', 'nombre' => 'Karts Doble'],
            ['centro_costo' => '2123', 'nombre' => 'Cumbre'],
            ['centro_costo' => '2124', 'nombre' => 'Camino del Arriero'],
            ['centro_costo' => '2125', 'nombre' => 'Minishows del Café'],
            ['centro_costo' => '2126', 'nombre' => 'Sendero del Café'],
            ['centro_costo' => '2127', 'nombre' => 'Tren Marianita'],
            ['centro_costo' => '2128', 'nombre' => 'Museos'],
            ['centro_costo' => '2130', 'nombre' => 'Rápidos'],
            ['centro_costo' => '2136', 'nombre' => 'Teleférico Bambusario'],
            ['centro_costo' => '2137', 'nombre' => 'Yippe Montaña Rusa'],
            ['centro_costo' => '2200', 'nombre' => 'P. Cafeteritos'],
        ];

        foreach ($areas as $data) {
            area::firstOrCreate(
                ['centro_costo' => $data['centro_costo']],
                ['nombre' => $data['nombre'], 'descripcion' => null, 'scheduling_mode' => 'fijo'],
            );
        }

        // El AreaSeeder original creó "sistema" con centro_costo='1' — se migran sus empleados
        // a la entrada correcta (1008) y luego se elimina el registro huérfano.
        $oldSistema = area::where('centro_costo', '1')->where('nombre', 'sistema')->first();
        $newSistema = area::where('centro_costo', '1008')->first();
        if ($oldSistema && $newSistema && $oldSistema->id !== $newSistema->id) {
            Employee::where('area_id', $oldSistema->id)->update(['area_id' => $newSistema->id]);
            $oldSistema->delete();
        } elseif ($oldSistema && !$newSistema) {
            $oldSistema->update(['nombre' => 'Sistemas', 'centro_costo' => '1008']);
        }

        // Asignar area_id a los empleados según su centrocosto
        $allAreas = area::pluck('id', 'centro_costo');

        Employee::whereNotNull('centrocosto')
            ->each(function (Employee $emp) use ($allAreas) {
                $areaId = $allAreas[$emp->centrocosto] ?? null;
                if ($areaId) {
                    $emp->update(['area_id' => $areaId]);
                }
            });
    }
}
