<?php

namespace Database\Seeders;

use App\Models\area;
use Illuminate\Database\Seeder;

class AreaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        area::firstOrCreate(
            ['nombre' => 'sistema'],
            ['centro_costo' => '1', 'descripcion' => 'areaSistema', 'scheduling_mode' => 'fijo'],
        );
        area::firstOrCreate(
            ['nombre' => 'Ventas'],
            ['centro_costo' => '1212', 'descripcion' => 'VentasOnline', 'scheduling_mode' => 'fijo'],
        );
        area::firstOrCreate(
            ['nombre' => 'Operaciones'],
            ['centro_costo' => '0202', 'descripcion' => 'Atracciones', 'scheduling_mode' => 'variable'],
        );
        area::firstOrCreate(
            ['nombre' => 'TalentoHumano'],
            ['centro_costo' => '2121', 'descripcion' => null, 'scheduling_mode' => 'fijo'],
        );
          }
}
