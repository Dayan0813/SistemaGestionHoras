<?php

use App\Http\Controllers\AlertasController;
use App\Http\Controllers\AreaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CalendarsController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\HolidayController;
use App\Http\Controllers\MarkingLogController;
use App\Http\Controllers\ProgramationsController;
use App\Http\Controllers\CalendarioVsMarcacionesController;
use App\Http\Controllers\WorkPositionController;
use App\Models\Device;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;


/*
|--------------------------------------------------------------------------
| RUTAS PÚBLICAS
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

Route::get('/login', [AuthController::class, 'loginForm'])
    ->name('login')
    ->middleware('guest');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('guest');


/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

Route::post('/logout', function () {

    Auth::logout();

    request()->session()->invalidate();
    request()->session()->regenerateToken();

    return redirect()->route('login');

})->name('logout');


/*
|--------------------------------------------------------------------------
| REGISTRO
|--------------------------------------------------------------------------
*/

Route::get('/register', [AuthController::class, 'showRegister'])
    ->name('register')
    ->middleware('guest');

Route::post('/register', [AuthController::class, 'register'])
    ->name('register.store')
    ->middleware('guest');


/*
|--------------------------------------------------------------------------
| DASHBOARD
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->get('/dashboard', function () {

    $user = auth()->user();

    if ($user->hasRole('admin')) {
        return redirect()->route('inicio');
    }

    if ($user->hasRole('coordinator')) {
        return redirect()->route('programaciones');
    }

    abort(403);

})->name('dashboard');


/*
|--------------------------------------------------------------------------
| INICIO
|--------------------------------------------------------------------------
|
| Solo administrador.
|
*/

Route::middleware(['auth', 'role:admin'])->group(function () {

    Route::get('/', function () {

        return Inertia::render('Inicio', [
            'currentRouteName' => 'inicio',
        ]);

    })->name('inicio');

});


/*
|--------------------------------------------------------------------------
| USUARIOS
|--------------------------------------------------------------------------
|
| Solo administrador.
|
*/

Route::middleware(['auth', 'role:admin'])->group(function () {

    Route::get(
        '/users/create',
        [AuthController::class, 'createUser']
    )->name('users.create');

    Route::post(
        '/users',
        [AuthController::class, 'storeUser']
    )->name('users.store');

});


/*
|--------------------------------------------------------------------------
| EMPLEADOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:empleados.ver'
])->group(function () {

    Route::get(
        '/empleados',
        [EmployeeController::class, 'index']
    )->name('empleados');

});


/*
|--------------------------------------------------------------------------
| EDITAR EMPLEADOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:empleados.editar'
])->group(function () {

    Route::put(
        '/empleados/{employee}',
        [EmployeeController::class, 'update']
    )->name('empleados.update');

});


/*
|--------------------------------------------------------------------------
| ELIMINAR EMPLEADOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:empleados.eliminar'
])->group(function () {

    Route::delete(
        '/empleado/{id}',
        [EmployeeController::class, 'destroy']
    )->name('empleados.destroy');

});


/*
|--------------------------------------------------------------------------
| ÁREAS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:areas.ver'
])->group(function () {

    Route::get(
        '/areas',
        [AreaController::class, 'index']
    )->name('areas');

    Route::get(
        '/areas/{area}',
        [AreaController::class, 'show']
    )->name('areas.show');

});


/*
|--------------------------------------------------------------------------
| CREAR ÁREAS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:areas.gestionar'
])->group(function () {

    Route::post(
        '/areas',
        [AreaController::class, 'store']
    )->name('areas.store');

});


/*
|--------------------------------------------------------------------------
| PUESTOS DE TRABAJO
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:work_positions.ver'
])->group(function () {

    Route::get(
        '/workPositions/area/{areaId}/puestos',
        [WorkPositionController::class, 'getPositionByArea']
    );

});


/*
|--------------------------------------------------------------------------
| PROGRAMACIONES
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:programaciones.ver'
])->group(function () {

    /*
    | Vista principal
    */
    Route::get('/programaciones', function () {

        return Inertia::render('Programaciones', [
            'currentRouteName' => 'programaciones',
        ]);

    })->name('programaciones');


    /*
    | Nueva programación
    */
    Route::get(
        '/programations/new',
        [ProgramationsController::class, 'index']
    )->name('newprogramations');


    /*
    | Programaciones por área
    */
    Route::get(
        '/programations/areas/{area}',
        [ProgramationsController::class, 'showByArea']
    )->name('programations.details');


    /*
    | Empleados filtrados por área
    */
    Route::get(
        '/programations/employeesArea',
        [ProgramationsController::class, 'getEmployeesAreaFiltered']
    );


    /*
    | Empleados para programación
    */
    Route::get(
        '/programations/employees',
        [ProgramationsController::class, 'getEmployeesFiltered']
    )->name('programations.employees');


    /*
    | Cards de programación
    */
    Route::get(
        '/programations/getCard',
        [ProgramationsController::class, 'getCard']
    );


    /*
    | Detalle dinámico
    */
    Route::get(
        '/Programations/area/{area}/month',
        [ProgramationsController::class, 'DinamicDetails']
    )->name('programations.dinamicDetails');

});


/*
|--------------------------------------------------------------------------
| CREAR PROGRAMACIONES
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:programaciones.crear'
])->group(function () {

    Route::post(
        '/programations',
        [ProgramationsController::class, 'store']
    )->name('programationsStore');

});


/*
|--------------------------------------------------------------------------
| EDITAR PROGRAMACIONES
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:programaciones.editar'
])->group(function () {

    Route::put(
        '/programations/{programation}',
        [ProgramationsController::class, 'update']
    )->name('programations.update');


    Route::post(
        '/programations/bulk-override',
        [ProgramationsController::class, 'bulkOverride']
    )->name('programations.bulkOverride');

});


/*
|--------------------------------------------------------------------------
| CANCELAR PROGRAMACIÓN
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:programaciones.editar'
])->group(function () {

    Route::patch(
        '/programations/{programation}/cancel',
        [ProgramationsController::class, 'cancel']
    )->name('programations.cancel');

});


/*
|--------------------------------------------------------------------------
| CALENDARIOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:calendarios.gestionar'
])->group(function () {

    /*
    | Obtener calendarios por área
    */
    Route::get(
        '/calendars/area/{areaId}',
        [CalendarsController::class, 'byArea']
    )->name('calendars.byArea');


    /*
    | Crear calendario
    */
    Route::post(
        '/calendars',
        [CalendarsController::class, 'store']
    )->name('calendars.store');


    /*
    | Actualizar calendario
    */
    Route::put(
        '/calendars/{calendar}',
        [CalendarsController::class, 'update']
    )->name('calendars.update');


    /*
    | Eliminar calendario
    */
    Route::delete(
        '/calendars/{calendar}',
        [CalendarsController::class, 'destroy']
    )->name('calendars.destroy');

});


/*
|--------------------------------------------------------------------------
| DISPOSITIVOS
|--------------------------------------------------------------------------
|
| Solo administrador.
|
*/

Route::middleware([
    'auth',
    'role:admin'
])->group(function () {

    Route::resource(
        'devices',
        DeviceController::class
    );

});


/*
|--------------------------------------------------------------------------
| SERVICIOS
|--------------------------------------------------------------------------
|
| Solo administrador.
|
*/

Route::middleware([
    'auth',
    'role:admin'
])->group(function () {

    Route::get('/Servicios', function () {

        return Inertia::render('Servicios', [
            'currentRouteName' => 'servicios',
        ]);

    })->name('servicios');

});


/*
|--------------------------------------------------------------------------
| MARCACIONES - VISTA
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:marcaciones.ver'
])->group(function () {

    Route::get('/Markings', function () {

        return Inertia::render('MarkingsLogs', [

            'currentRouteName' => 'markinglogs',

            'devices' => Device::select(
                'id',
                'name'
            )
                ->orderBy('name')
                ->get(),

        ]);

    })->name('markinglogs');


    /*
    | Calendario vs Marcaciones
    */
    Route::get(
    '/calendario-marcaciones',
    function () {
        return Inertia::render(
            'CalendarioVsMarcaciones',
            [
                'currentRouteName' => 'calendario-marcaciones',
            ]
        );
    }
)->name('calendario.marcaciones');

Route::get(
    '/api/calendario-marcaciones',
    [CalendarioVsMarcacionesController::class, 'index']
)->name('calendario.marcaciones.data');


    /*
    | Alertas
    */
    Route::get(
        '/alertas',
        function () {

            return Inertia::render(
                'Alertas',
                [
                    'currentRouteName' => 'alertas',
                ]
            );

        }
    )->name('alertas');


    /*
    | API de alertas
    */
    Route::get(
        '/api/alertas',
        [AlertasController::class, 'index']
    )->name('alertas.data');

});


/*
|--------------------------------------------------------------------------
| SINCRONIZACIÓN DEL HUELLERO
|--------------------------------------------------------------------------
|
| Estos endpoints son utilizados por EventSource
| desde la pantalla de Marcaciones/Alertas.
|
*/

Route::middleware([
    'auth',
    'permission:marcaciones.sincronizar'
])->group(function () {

    /*
    | Sincronizar todos los dispositivos
    */
    Route::get(
        '/marking',
        [MarkingLogController::class, 'streamGlobal']
    )
        ->withoutMiddleware([
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \Inertia\Middleware::class,
        ]);


    /*
    | Sincronizar un dispositivo específico
    */
    Route::get(
        '/marking/only/{device}',
        [MarkingLogController::class, 'streamOnly']
    )
        ->withoutMiddleware([
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \Inertia\Middleware::class,
        ]);

});


/*
|--------------------------------------------------------------------------
| CONSOLIDADOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:consolidados.ver'
])->group(function () {

    Route::prefix('WorkConsolidation')->group(function () {

        /*
        | Vista principal
        */
        Route::get(
            '/consolidations',
            [WorkConsolidationController::class, 'indexPage']
        )->name('consolidations.index');


        /*
        | Consolidado semanal
        */
        Route::get(
            '/{uid}/semanal',
            [WorkConsolidationController::class, 'weekly']
        );


        /*
        | Consolidado mensual
        */
        Route::get(
            '/{uid}/mensual',
            [WorkConsolidationController::class, 'monthly']
        );


        /*
        | Consolidado por rango
        */
        Route::get(
            '/{uid}/rango',
            [WorkConsolidationController::class, 'range']
        );


        /*
        | Generador
        */
        Route::get(
            '/generator',
            [WorkConsolidationController::class, 'generator']
        )->name('consolidations.generator');

    });

});


/*
|--------------------------------------------------------------------------
| GENERAR CONSOLIDADOS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth',
    'permission:consolidados.generar'
])->group(function () {

    Route::post(
        '/WorkConsolidation/generate-bulk',
        [WorkConsolidationController::class, 'generateBulk']
    )->name('consolidations.generate');

});


/*
|--------------------------------------------------------------------------
| FESTIVOS
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->group(function () {

    Route::get(
        '/holidays/range',
        [HolidayController::class, 'byRange']
    );

});