<?php

/*
|
|--------------------------------------------------------------------------
| Configuracion Lanboral Colombia
|--------------------------------------------------------------------------
|
|   Aqui se definen todas las reglas laborales segun la ley colombiana.
|   todos los valores son configurables via .env para adaptarse a las reformas.
|
|--------------------------------------------------------------------------
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Jornada Laboral Ordinaria
    |--------------------------------------------------------------------------
    */
    'jornada' => [
        'diaria_horas' => env('JORNADA_DIARIA_HORAS', 8),
        'semanal_horas' => env('JORNADA_SEMANAL_HORAS', 40),
    ],

    /*
    |--------------------------------------------------------------------------
    | Horarios Diurnos y Nocturnos
    |--------------------------------------------------------------------------
    */
    'horarios' => [
        'inicio_diurno' => env('HORA_INICIO_DIURNO', '08:00'),
        'fin_diurno' => env('HORA_FIN_DIURNO', '17:00'),
        'inicio_nocturno' => env('HORA_INICIO_NOCTURNO', '21:00'),
        'fin_nocturno' => env('HORA_FIN_NOCTURNO', '06:00'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Recargos Legales (% sobre hora ordinaria)
    |--------------------------------------------------------------------------
    */
    'recargos' => [
        'nocturno' => env('RECARGO_NOCTURNO_PORCENTAJE', 35),
        'festivo' => env('RECARGO_FESTIVO_PORCENTAJE', 75),
        'extra_diurna' => env('RECARGO_EXTRA_DIURNA_PORCENTAJE', 25),
        'extra_nocturna' => env('RECARGO_EXTRA_NOCTURNA_PORCENTAJE', 75),
    ],

    /*
    |--------------------------------------------------------------------------
    | Límites de Horas Extras
    |--------------------------------------------------------------------------
    */
    'limites' => [
        'extras_diarias' => env('MAX_EXTRAS_DIARIAS', 2),
        'extras_semanales' => env('MAX_EXTRAS_SEMANALES', 12),
    ],

    /*
    |--------------------------------------------------------------------------
    | Tolerancias (opcional: para llegadas tardías, salidas temprano)
    |--------------------------------------------------------------------------
    */
    'tolerancias' => [
        'tarde_minutos' => env('TOLERANCIA_TARDE_MINUTOS', 15),
        'salida_anticipada_minutos' => env('TOLERANCIA_SALIDA_ANTICIPADA_MINUTOS', 15),
    ],

];