<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\area;
use App\Models\calendars;
use App\Models\Employee;
use App\Models\User;
use App\Models\UserRole;
use App\Services\ScheduleResolver;
use Carbon\Carbon;
use Hash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class AreaController extends Controller
{
    use EnsuresAreaAccess;

    /**
     * ===============================
     * 
     *  Render
     * 
     * ===============================
     */

    public function index()
    {
        $user = auth()->user()->loadMissing('employee');

        // =========================
        // COORDINATOR → REDIRECT
        // =========================
        if ($user->hasRole('coordinator')) {
            $areaId = $user->employee?->area_id;

            if (!$areaId) {
                abort(403, 'No tienes un área asignada');
            }

            return redirect()->route('areas.show', $areaId);
        }

        // =========================
        // ADMIN → LISTADO NORMAL
        // =========================
        $areas = Area::query()
            ->withCount([
                'employees as total',
                'employees as activos' => fn($q) => $q->where('estado', 'Activo'),
                'employees as inactivos' => fn($q) => $q->where('estado', 'Inactivo'),
            ])
            ->orderBy('nombre')
            ->get();

        return Inertia::render('Areas', [
            'areas' => $areas,
            'eligibleEmployees' => Employee::whereDoesntHave('user')->orderBy('name')->get(['uid', 'name']),
            'currentRouteName' => 'areas',
        ]);
    }

    /**
     * ===============================
     *
     *  Creacion de una nueva area
     *
     * ===============================
     */

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255|unique:areas,nombre',
            'centro_costo' => 'required|string|max:255|unique:areas,centro_costo',
            'descripcion' => 'nullable|string|max:1000',
            'scheduling_mode' => 'required|in:fijo,variable',
            'coordinator_employee_uid' => 'required|exists:employees,uid|unique:users,employee_uid',
            'coordinator_email' => 'required|email|unique:users,email',
            'coordinator_password' => ['required', Password::min(8)->mixedCase()->numbers()],
        ]);

        DB::transaction(function () use ($validated) {
            $area = Area::create([
                'nombre' => $validated['nombre'],
                'centro_costo' => $validated['centro_costo'],
                'descripcion' => $validated['descripcion'] ?? null,
                'scheduling_mode' => $validated['scheduling_mode'],
            ]);

            $user = User::create([
                'email' => $validated['coordinator_email'],
                'password' => Hash::make($validated['coordinator_password']),
                'employee_uid' => $validated['coordinator_employee_uid'],
            ]);

            UserRole::create([
                'user_id' => $user->id,
                'role' => 'coordinator',
            ]);

            Employee::where('uid', $validated['coordinator_employee_uid'])->update(['area_id' => $area->id]);
        });

        return redirect()
            ->route('areas')
            ->with('success', '✅ Área creada correctamente, con su coordinador asignado');
    }

    /**
     * ===============================
     *
     *  Edicion de un area existente
     *
     * ===============================
     */

    public function update(Request $request, area $area)
    {
        // Defensivo: hoy solo "admin" tiene areas.gestionar (que siempre pasa
        // este chequeo), pero si ese permiso se le llega a dar a otro rol,
        // esto evita que edite áreas ajenas a la suya.
        $this->ensureAreaAcces($area->id);

        $validated = $request->validate([
            'nombre' => ['required', 'string', 'max:255', Rule::unique('areas', 'nombre')->ignore($area->id)],
            'centro_costo' => ['required', 'string', 'max:255', Rule::unique('areas', 'centro_costo')->ignore($area->id)],
            'descripcion' => 'nullable|string|max:1000',
            'scheduling_mode' => 'required|in:fijo,variable',
        ]);

        $area->update($validated);

        return redirect()
            ->route('areas.show', $area->id)
            ->with('success', '✅ Área actualizada correctamente');
    }

    /**
     * ===============================
     *
     *  Detalle del render
     *
     * ===============================
     */

    public function show(Area $area)
    {
        $user = auth()->user()->loadMissing('employee');

        // =========================
        // COORDINADOR → SOLO SU ÁREA
        // =========================
        if ($user->hasRole('coordinator')) {
            $areaId = $user->employee?->area_id;

            if ($area->id !== $areaId) {
                abort(403, 'No puedes acceder a esta área');
            }
        }

        $employees = $area->employees()
            ->with(['cargo', 'contrato'])
            ->orderBy('name')
            ->get();

        // Turno de HOY por empleado, para mostrarlo junto al cargo en la tarjeta.
        // Misma resolución (programación + override del día) que ya usa el resto
        // del sistema — no se reinventa la lógica de "qué turno le toca hoy".
        $areaCalendars = calendars::where('area_id', $area->id)
            ->where('is_custom', false)
            ->orderBy('hora_entrada')
            ->get(['id', 'hora_entrada', 'hora_salida']);

        $resolver = new ScheduleResolver();
        $today = Carbon::today();

        $employees->each(function (Employee $employee) use ($resolver, $today, $areaCalendars, $area) {
            $schedule = $resolver->getDailySchedule($employee->uid, $today);

            if (!$schedule) {
                $employee->today_calendar = null;
                return;
            }

            $calendar = $schedule['calendar'];
            $index = $areaCalendars->search(fn($c) => $c->id === $calendar->id);
            // "Apertura"/"Cierre" solo tiene sentido con exactamente 2 turnos; con 3+ colapsarían
            // en "Cierre" para ambos, así que en ese caso se usan letras igual que modo variable.
            $label = $index === false
                ? ($schedule['shift_type'] === 'D' ? 'Turno diurno' : 'Turno nocturno')
                : ($area->scheduling_mode === 'fijo' && $areaCalendars->count() <= 2
                    ? ($index === 0 ? 'Apertura' : 'Cierre')
                    : 'Calendario ' . chr(65 + $index));

            $employee->today_calendar = [
                'label' => $label,
                'hora_entrada' => $calendar->hora_entrada,
                'hora_salida' => $calendar->hora_salida,
                'shift_type' => $schedule['shift_type'],
            ];
        });

        $coordinator = User::whereHas('roles', fn($q) => $q->where('role', 'coordinator'))
            ->whereHas('employee', fn($q) => $q->where('area_id', $area->id))
            ->with('employee')
            ->first();

        return Inertia::render('Areas/Show', [
            'currentRouteName' => 'areas',
            'area' => $area,
            'coordinator_name' => $coordinator?->employee?->name,
            'stats' => [
                'total' => $employees->count(),
                'activos' => $employees->where('estado', 'Activo')->count(),
                'inactivos' => $employees->where('estado', 'Inactivo')->count(),
            ],
            'activos' => $employees->where('estado', 'Activo')->values(),
            'inactivos' => $employees->where('estado', 'Inactivo')->values(),
        ]);
    }
}
