<?php 
namespace Database\Seeders;

use App\Models\area;
use App\Models\calendars;
use Illuminate\Database\Seeder;

class CalendarSeeder extends Seeder{
    public function run(): void
    {
        $sistema = area::where('nombre','sistema')->first();
        $operaciones = area::where('nombre','operaciones')->first();
        $talentoHumano = area::where('nombre','talentohumano')->first();

        if($sistema){
            calendars::firstOrCreate(
                    ['area_id'=> $sistema->id, 'hora_entrada'=> '07:00:00','hora_salida'=>'18:00:00'],
                    ['shift_type'=>'D', 'is_custom' => false],
                );
            calendars::firstOrCreate( 
                ['area_id'=> $sistema->id, 'hora_entrada'=>'08:00:00', 'hora_salida' => '19:00:00'],
                ['shift_type'=>'D', 'is_custom' => false],
            );
            calendars::firstOrCreate(
                ['area_id' => $sistema->id, 'hora_entrada' =>'09:00:00', 'hora_salida' => '19:00:00'],
                ['shift_type' => 'D', 'is_custom' => false],
            );
       }
    

     if($operaciones){
         calendars::firstOrCreate(
            ['area_id' => $operaciones->id, 'hora_entrada'=>'08:00:00', 'hora_salida'=>'18:00:00'],
            ['shift_type' => 'D', 'is_custom' => false],

         );
         calendars::firstOrCreate(
            ['area_id' => $operaciones->id, 'hora_entrada'=>'09:00:00', 'hora_salida'=>'19:00:00'],
            ['shift_type' => 'D', 'is_custom' => false],
         );
         calendars::firstOrCreate(
            ['area_id' => $operaciones->id, 'hora_entrada'=>'10:00:00','hora_salida'=>'19:00:00'],
            ['shift_type' => 'D', 'is_custom' => false],

         );
        }
     if($talentoHumano){
        calendars::firstOrCreate(
            ['area_id' => $talentoHumano->id,'hora_entrada'=> '08:00:00','hora_salida'=>'18:00:00'],
            ['shift_type' => 'D', 'is_custom'=>false],
        );
        calendars::firstOrCreate(
            ['area_id'=> $talentoHumano->id, 'hora_entrada'=>'09:00:00', 'hora_salida'=>'18:00:00'],
            ['shift_type' => 'D', 'is_custom'=>false],
        );
        calendars::firstOrCreate(
            ['area_id'=> $talentoHumano->id, 'hora_entrada'=>'08:00:00', 'hora_salida'=>'18:00:00'],
            ['shift_type' => 'D', 'is_custom'=>false],
        );

      }
   }  
}