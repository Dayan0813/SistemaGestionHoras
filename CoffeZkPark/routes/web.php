<?php

use App\Http\Controllers\AreaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CalendarsController;
use App\Models\area;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\EmployeeCatalogsController;
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
    ->middleware(['guest', 'throttle:6,1']);

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

    if ($user->hasRole('aux_admin_th')) {
        return redirect()->route('programaciones');
    }

    if ($user->hasRole('admin_nomina')) {
        return redirect()->route('empleados');
    }

    if ($user->hasRole('aux_th')) {
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

// Inicio: solo el admin ve el dashboard general; el resto de roles autenticados
// se redirige a su página correspondiente (misma lógica que /dashboard) en vez
// de recibir un 403 al entrar a la URL base del sitio.
Route::middleware('auth')->get('/', function () {
    if (!auth()->user()->hasRole('admin')) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Inicio', [
        'currentRouteName' => 'inicio',
    ]);
})->name('inicio');

Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('/holidays/range', [HolidayController::class, 'byRange']);

    // Servicios: menú de accesos rápidos para el admin (Dispositivos,
    // Consolidados, Crear Usuario). Varias páginas ya enlazaban aquí con una
    // URL fija ("/Servicios") pero nunca existió la ruta.
    Route::get('/Servicios', function () {
        return Inertia::render('Servicios', ['currentRouteName' => 'servicios']);
    })->name('servicios');
});

Route::middleware(['auth', 'permission:usuarios.gestionar'])->group(function () {
    // Registro de usuarios (Solo un admin puede hacerlo)

    Route::get('/users/create', [AuthController::class, 'createUser'])->name('users.create');

    Route::post('/users', [AuthController::class, 'storeUser'])->name('users.store');
});

Route::middleware(['auth', 'permission:areas.gestionar'])->group(function () {
    // Áreas (crear / editar)

    Route::post('/areas', [AreaController::class, 'store'])->name('areas.store');
    Route::put('/areas/{area}', [AreaController::class, 'update'])->name('areas.update');
});

// Antes no llevaban 'auth' en absoluto: cualquiera, sin sesión, podía golpear
// estas URLs y disparar la creación/actualización de empleados y marcaciones
// (y la conexión en vivo al dispositivo). Se reutiliza el permiso
// "marcaciones.sincronizar" que ya existía para esta misma acción.
Route::middleware(['auth', 'permission:marcaciones.sincronizar'])->group(function () {
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
});

/**
 * ================================================
 * 
 *  RUTAS PARA EL COORDINADOR:
 *  Aqui se almacenaran las rutas, en las cuales solo
 *  el coordinador puede ingresar a ellas.
 * 
 * ==================================================
 */

Route::middleware(['auth', 'permission:programaciones.ver'])->group(function () {

    // Programaciones vista principal
    Route::get('/programaciones', function () {
        $props = ['currentRouteName' => 'programaciones'];

        // aux_admin_th y aux_th además pueden consultar (solo lectura) lo que
        // subieron los coordinadores de cualquier área, mediante un filtro de
        // área. aux_th no tiene permiso para crear/editar, así que en el
        // frontend eso es lo ÚNICO que ve en esta página.
        $user = auth()->user();
        if ($user->hasRole('aux_admin_th') || $user->hasRole('aux_th')) {
            $props['allAreas'] = area::orderBy('nombre')->get(['id', 'nombre']);
        }

        return Inertia::render('Programaciones', $props);
    })->name('programaciones');

    //Programaciones por area (Solo la asignada)
    Route::get(
        '/programations/areas/{area}',
        [ProgramationsController::class, 'showByArea']
    )->name('programations.details');

    Route::get('programations/employeesArea', [ProgramationsController::class, 'getEmployeesAreaFiltered']);
    Route::get('/programations/employees', [ProgramationsController::class, 'getEmployeesFiltered'])
        ->name('programations.employees');

    // Cards de Programations
    Route::get('/programations/getCard', [ProgramationsController::class, 'getCard']);

    // Vista detalle programacion dinamico
    Route::get(
        '/Programations/area/{area}/month',
        [ProgramationsController::class, 'DinamicDetails']
    )->name('programations.dinamicDetails');

    // Exportar a Excel la programación de un área/mes
    Route::get(
        '/Programations/area/{area}/month/export',
        [ProgramationsController::class, 'exportMonth']
    )->name('programations.exportMonth');

    // Exportar a Excel la programación de TODAS las áreas (una hoja por área)
    Route::get(
        '/Programations/export-all',
        [ProgramationsController::class, 'exportAllAreas']
    )->name('programations.exportAllAreas');
});

Route::middleware(['auth', 'permission:calendarios.gestionar'])->group(function () {
    // Endpoint para obtener calendarios por area
    Route::get('/calendars/area/{areaId}', [CalendarsController::class, 'byArea'])->name('calendars.byArea');

    Route::post('/calendars', [CalendarsController::class, 'store'])->name('calendars.store');
    Route::put('/calendars/{calendar}', [CalendarsController::class, 'update'])->name('calendars.update');
    Route::delete('/calendars/{calendar}', [CalendarsController::class, 'destroy'])->name('calendars.destroy');
});

Route::middleware(['auth', 'permission:areas.ver'])->group(function () {
    // Endpoint para el componente de Areas
    Route::get('/areas', [AreaController::class, 'index'])->name('areas');
    Route::get('/areas/{area}', [AreaController::class, 'show'])->name('areas.show');
});

Route::middleware(['auth', 'permission:work_positions.ver'])->group(function () {
    // WorkPosition

    Route::get('/workPositions/area/{areaId}/puestos', [WorkPositionController::class, 'getPositionByArea'])
        ->name('workPositions.byArea');
});

Route::middleware(['auth', 'permission:work_positions.gestionar'])->group(function () {
    Route::post('/workPositions', [WorkPositionController::class, 'store'])->name('workPositions.store');
    Route::put('/workPositions/{workPosition}', [WorkPositionController::class, 'update'])->name('workPositions.update');
    Route::delete('/workPositions/{workPosition}', [WorkPositionController::class, 'destroy'])->name('workPositions.destroy');
});

Route::middleware(['auth', 'permission:programaciones.crear'])->group(function () {
    Route::post('/programations', [ProgramationsController::class, 'store'])->name('programationsStore');
});

Route::middleware(['auth', 'permission:programaciones.editar'])->group(function () {
    Route::put('/programations/{programation}', [ProgramationsController::class, 'update'])->name('programations.update');
    Route::post('/programations/bulk-override', [ProgramationsController::class, 'bulkOverride'])->name('programations.bulkOverride');
});

Route::middleware(['auth', 'permission:empleados.ver'])->group(function () {
    Route::get('/empleados', [EmployeeController::class, 'index'])->name('empleados');
});

Route::middleware(['auth', 'permission:empleados.crear'])->group(function () {
    Route::post('/empleados', [EmployeeController::class, 'store'])->name('empleados.store');

    // Catálogos de Cargo/Contrato: se crean "al vuelo" desde el formulario de
    // empleado, porque antes no había ninguna forma de agregarlos.
    Route::post('/cargos', [EmployeeCatalogsController::class, 'storeCargo'])->name('cargos.store');
    Route::delete('/cargos/{cargo}', [EmployeeCatalogsController::class, 'destroyCargo'])->name('cargos.destroy');
    Route::post('/contratos', [EmployeeCatalogsController::class, 'storeContrato'])->name('contratos.store');
    Route::delete('/contratos/{contrato}', [EmployeeCatalogsController::class, 'destroyContrato'])->name('contratos.destroy');
});

Route::middleware(['auth', 'permission:empleados.editar'])->group(function () {
    Route::put('/empleados/{employee}', [EmployeeController::class, 'update'])->name('empleados.update');
});

Route::middleware(['auth', 'permission:empleados.eliminar'])->group(function () {
    Route::delete('/empleado/{id}', [EmployeeController::class, 'destroy'])->name('empleados.destroy');
});

Route::middleware(['auth', 'permission:consolidados.ver'])->group(function () {
    Route::prefix('WorkConsolidation')->group(function () {
        Route::get('/consolidations', [WorkConsolidationController::class, 'indexPage'])->name('consolidations.index');
        Route::get('/{uid}/semanal', [WorkConsolidationController::class, 'weekly'])->name('consolidations.weekly');
        Route::get('/{uid}/mensual', [WorkConsolidationController::class, 'monthly'])->name('consolidations.monthly');
        Route::get('/{uid}/rango', [WorkConsolidationController::class, 'range'])->name('consolidations.range');
        Route::get('/generator', [WorkConsolidationController::class, 'generator'])->name('consolidations.generator');
    });
});

Route::middleware(['auth', 'permission:consolidados.generar'])->group(function () {
    Route::post('/WorkConsolidation/generate-bulk', [WorkConsolidationController::class, 'generateBulk'])->name('consolidations.generate');
});

Route::middleware(['auth', 'permission:marcaciones.ver'])->group(function () {
    Route::get('/Markings', function () {
        return Inertia::render('MarkingsLogs', [
            'currentRouteName' => 'markinglogs',
            'devices' => Device::select('id', 'name')->orderBy('name')->get(),
        ]);
    })->name('markinglogs');

    Route::get('/calendario-marcaciones', function () {
        return Inertia::render('CalendarioVsMarcaciones', ['currentRouteName' => 'calendario-marcaciones']);
    })->name('calendario.marcaciones');

    Route::get('/alertas', function () {
        return Inertia::render('Alertas', ['currentRouteName' => 'alertas']);
    })->name('alertas');
});

Route::middleware(['auth', 'permission:dispositivos.gestionar'])->group(function () {
    Route::get('/devices', [DeviceController::class, 'index'])->name('devices.index');
    Route::get('/devices/create', [DeviceController::class, 'create'])->name('devices.create');
    Route::post('/devices', [DeviceController::class, 'store'])->name('devices.store');
    Route::put('/devices/{device}', [DeviceController::class, 'update'])->name('devices.update');
    Route::delete('/devices/{device}', [DeviceController::class, 'destroy'])->name('devices.destroy');
});
