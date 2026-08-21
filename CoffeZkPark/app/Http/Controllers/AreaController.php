<?php

namespace App\Http\Controllers;

use App\Models\area;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AreaController extends Controller
{
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
        ]);

        Area::create($validated);

        return redirect()
            ->route('areas')
            ->with('success', '✅ Área creada correctamente');
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

        return Inertia::render('Areas/Show', [
            'area' => $area,
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
