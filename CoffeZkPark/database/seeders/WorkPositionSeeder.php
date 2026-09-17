<?php

namespace Database\Seeders;

use App\Models\area;
use App\Models\WorkPosition;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class WorkPositionSeeder extends Seeder
{
    public function run(): void
    {
        $operaciones = area::where('nombre','operaciones')->first();
        if(!$operaciones){
            return;
        }
        $positions =[
            ['attraction' => 'Montaña Rusa','name' => 'Aux.MontañaRusa'],
            ['attraction' => 'Montaña Rusa', 'name' => 'Aux2'],
            ['attraction' => 'Montaña Rusa', 'name' => 'Aux3'],
            ['attraction' => 'Montaña Acuatica ', 'name' => 'Aux1'],
            ['attraction' => 'Avix', 'name' => 'Avix1'],
            ['attraction' => 'Avix', 'name' => 'Avix'],
            ['attraction' => 'Avix', 'name' => 'Avix3'],

        ];

        foreach($positions as $position){
            WorkPosition::firstOrCreate(
                ['area_id' => $operaciones->id, 'attraction' => $position['attraction'], 'name' => $position['name']],
                ['active' => true],
            );
        }
    }
}

