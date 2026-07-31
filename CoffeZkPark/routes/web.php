<?php

use App\Http\Controllers\AreaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CalendarsController;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\HolidayController;
use App\Http\Controllers\MarkingLogController;
use App\Http\Controllers\ProgramationsController;
use App\Http\Controllers\WorkConsolidationController;
use App\Http\Controllers\WorkPositionController;
use App\Models\Device;
use Illuminate\Support\Facades\Auth;

/**
 * =====================================
 * 
 *  Rutas Publicas de Logueo
 * 
 * =====================================
 */

Route::get('/login', [AuthController::class, 'loginForm'])
    ->name('login')
    ->middleware('guest');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('guest');

// Cierra sesion y deshabilita credenciales
Route::post('logout', function () {
    Auth::logout();
    request()->session()->invalidate();
    request()->session()->regenerateToken();

    return redirect()->route('login');
})->name('logout');

/* Mostrar register SOLO si no hay usuarios */
Route::get('/register', [AuthController::class, 'showRegister'])
    ->name('register')
    ->middleware('guest');

/* Crear primer usuario */
Route::post('/register', [AuthController::class, 'register'])
    ->name('register.store')
    ->middleware('guest');

/**
 * =========================================
 * 
 *  Rutas para el Dashboard logico 
 * 
 * ==========================================
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

/**
 * ===================================================
 * 
 *  RUTAS PARA EL ADMIN:
 * 
 *  Estas rutas dan redirecccion a todas las vistas
 *  del proyecto al respecto dando dicha accesibilidad
 * 
 * ====================================================
 */

Route::middleware(['auth', 'role:admin'])->group(function () {

    // Registro de usuarios (Solo un admin puede hacerlo)

    Route::get('/users/create', [AuthController::class, 'createUser'])->name('users.create');

    Route::post('/users', [AuthController::class, 'storeUser'])->name('users.store');

    // Inicio
    Route::get('/', function () {
        return Inertia::render('Inicio', [
            'currentRouteName' => 'inicio',
        ]);
    })->name('inicio');

    // Empleados

    Route::get('/empleados', [EmployeeController::class, 'index'])->name('empleados');
    Route::put('/empleados/{employee}', [EmployeeController::class, 'update'])->name('empleados.update');
    Route::delete('/empleado/{id}', [EmployeeController::class, 'destroy'])->name('empleados.destroy');

    //Servicios
    Route::get('/Servicios', function () {
        return Inertia::render('Servicios', [
            'currentRouteName' => 'servicios',
        ]);
    })->name('servicios');

    //Devices
    Route::resource('devices', DeviceController::class);

    //Marcaciones
    Route::get('/Markings', function () {
        return Inertia::render('MarkingsLogs', [
            'currentRouteName' => 'markingslogs',
            'devices' => Device::select('id', 'name')->orderBy('name')->get(),
        ]);
    })->name('markinglogs');


    //Consolidado
    Route::prefix('WorkConsolidation')->group(function () {
        Route::get('/consolidations', [WorkConsolidationController::class, 'indexPage'])->name('consolidations.index');
        Route::get('/{uid}/semanal', [WorkConsolidationController::class, 'weekly']);
        Route::get('/{uid}/mensual', [WorkConsolidationController::class, 'monthly']);
        Route::get('/{uid}/rango', [WorkConsolidationController::class, 'range']);
        Route::get('/generator', [WorkConsolidationController::class, 'generator'])->name('consolidations.generator');
        Route::post('/generate-bulk', [WorkConsolidationController::class, 'generateBulk'])->name('consolidations.generate');
    });

    Route::get('/holidays/range', [HolidayController::class, 'byRange']);


    Route::post(
        '/work-consolidation/generate-bulk',
        [WorkConsolidationController::class, 'generateBulk']
    );
});

Route::get('/marking', [MarkingLogController::class, 'streamGlobal'])
    ->withoutMiddleware([
        \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        \Inertia\Middleware::class,
    ]);

Route::get('/marking/only/{device}', [MarkingLogController::class, 'streamOnly'])
    ->withoutMiddleware([
        \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        \Inertia\Middleware::class,
    ]);

/**
 * ================================================
 * 
 *  RUTAS PARA EL COORDINADOR:
 *  Aqui se almacenaran las rutas, en las cuales solo
 *  el coordinador puede ingresar a ellas.
 * 
 * ==================================================
 */

Route::middleware(['auth', 'role:admin,coordinator'])->group(function () {

    // Programaciones vista principal
    Route::get('/programaciones', function () {
        return Inertia::render('Programaciones', [
            'currentRouteName' => 'programaciones',
        ]);
    })->name('programaciones');

    //Nueva Programacion
    Route::get('/programations/new', [ProgramationsController::class, 'index'])->name('newprogramations');

    Route::post('/programations', [ProgramationsController::class, 'store'])->name('programationsStore');

    //Programaciones por area (Solo la asignada)
    Route::get(
        '/programations/areas/{area}',
        [ProgramationsController::class, 'showByArea']
    )->name('programations.details');

    Route::get('programations/employeesArea', [ProgramationsController::class, 'getEmployeesAreaFiltered']);
    Route::get('/programations/{programation}/dates', [ProgramationsController::class, 'generateDates'])->name('programations.dates');
    Route::get('/programations/employees', [ProgramationsController::class, 'getEmployeesFiltered'])
        ->name('programations.employees');

    // Cards de Programations
    Route::get('/programations/getCard', [ProgramationsController::class, 'getCard']);

    // Vista detalle programacion dinamico
    Route::get(
        '/Programations/area/{area}/month',
        [ProgramationsController::class, 'DinamicDetails']
    )->name('programations.dinamicDetails');

    // Vista de los overrides
    Route::patch(
        '/programations/{programation}/override',
        [ProgramationsController::class, 'saveOverride']
    )->name('programations.override.save');

    // Endpoint para obtener calendarios por area
    Route::get('/calendars/area/{areaId}', [CalendarsController::class, 'byArea'])->name('calendars.byArea');

    // Endpoint para el componente de Areas
    Route::get('/areas', [AreaController::class, 'index'])->name('areas');
    Route::get('/areas/{area}', [AreaController::class, 'show'])->name('areas.show');

    // WorkPosition

    Route::get('/workPositions/area/{areaId}/puestos', [WorkPositionController::class, 'getPositionByArea']);
});
