<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Cargo;
use App\Models\Contrato;
use App\Models\Employee;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $query = Employee::query();

        // =======================
        // FILTROS
        // =======================

        if ($request->filled('estado') && $request->estado !== 'Todos') {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('area') && $request->area !== 'Todos') {
            $query->where('area_id', $request->area);
        }

        if ($request->filled('contrato_id') && $request->contrato_id !== 'Todos') {
            $query->where('contrato_id', $request->contrato_id);
        }

        // =======================
        // BÚSQUEDA
        // =======================

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('uid', 'LIKE', "{$search}%")
                    ->orWhere('name', 'LIKE', "%{$search}%")
                    ->orWhere('empresa', 'LIKE', "%{$search}%")
                    ->orWhereHas('cargo', function ($c) use ($search) {
                        $c->where('name', 'LIKE', "%{$search}%");
                    })
                    ->orWhereHas('contrato', function ($c) use ($search) {
                        $c->where('name', 'LIKE', "%{$search}%");
                    });
            });
        }

        // =======================
        // LISTADO
        // =======================

        $employees = $query
            ->with(['area', 'cargo', 'contrato'])
            ->orderBy('name')
            ->paginate(50)
            ->withQueryString();

        // =======================
        // ESTADÍSTICAS
        // =======================

        $totalEmployees = Employee::count();
        $totalActiveEmployees = Employee::where('estado', 'Activo')->count();
        $totalInactiveEmployees = Employee::where('estado', 'Inactivo')->count();

        $byContrato = Employee::with('contrato')
            ->get()
            ->groupBy(fn($e) => $e->contrato?->name ?? 'Sin contrato')
            ->map(fn($group) => $group->count())
            ->toArray();

        // =======================
        // DATA PARA FILTROS
        // =======================

        return Inertia::render('Empleados', [
            'employees' => $employees,
            'stats' => [
                'total' => $totalEmployees,
                'Activos' => $totalActiveEmployees,
                'Inactivos' => $totalInactiveEmployees,
                'Contratos' => $byContrato,
            ],
            'filters' => $request->only([
                'estado',
                'area',
                'contrato_id',
                'search'
            ]),
            'areas' => Area::select('nombre', 'id', 'centro_costo')->get(),
            'cargo' => Cargo::pluck('name', 'id'),
            'contrato' => Contrato::pluck('name', 'id'),
            'currentRouteName' => 'empleados',
        ]);
    }

    // =======================
    // EDIT
    // =======================

    public function edit($id)
    {
        $employee = Employee::with(['area', 'cargo', 'contrato'])->findOrFail($id);

        return Inertia::render('Empleados/Edit', [
            'employee' => $employee,
            'areas' => Area::select('nombre', 'id', 'centro_costo')->get(),
            'cargo' => Cargo::pluck('name', 'id'),
            'contrato' => Contrato::pluck('name', 'id'),
        ]);
    }

    // =======================
    // UPDATE
    // =======================

    public function update(Request $request, Employee $employee)
    {
        $validated = $request->validate([
            'uid' => 'required|string|max:255',
            'userid' => 'nullable|string',
            'name' => 'required|string|max:255',
            'cardno' => 'nullable|string',
            'estado' => 'required|string',
            'documentos' => 'nullable|string',
            'dispositivo' => 'nullable|string',
            'horario' => 'nullable|string',
            'empresa' => 'nullable|string',
            'cargo_id' => 'nullable|exists:cargo,id',
            'contrato_id' => 'nullable|exists:contrato,id',
            'dependencia' => 'nullable|string',
            'area_id' => 'nullable|exists:areas,id',
            'centrocosto' => 'nullable|string',
        ]);

        // ===============================
        // ÁREA → CENTRO DE COSTO
        // ===============================
        if (!empty($validated['area_id'])) {
            $area = Area::find($validated['area_id']);
            $validated['centrocosto'] = $area?->centro_costo;
        }

        // ===============================
        // CENTRO DE COSTO → ÁREA (RESPALDO)
        // ===============================
        if (empty($validated['area_id']) && !empty($validated['centrocosto'])) {
            $area = Area::where('centro_costo', $validated['centrocosto'])->first();
            if ($area) {
                $validated['area_id'] = $area->id;
            }
        }

        // ===============================
        // CARGO
        // ===============================
        if (!empty($validated['cargo_id'])) {
            $validated['cargo'] = $validated['cargo_id'];
        }

        // ===============================
        // CONTRATO → EMPRESA
        // ===============================
        if (!empty($validated['contrato_id'])) {
            $contrato = Contrato::find($validated['contrato_id']);
            $validated['tipo_contrato'] = $contrato?->name;
            $validated['empresa'] = $contrato?->id;
        }

        $employee->update($validated);

        return redirect()
            ->route('empleados')
            ->with('success', 'Empleado actualizado correctamente');
    }


    // =======================
    // DELETE
    // =======================

    public function destroy($id)
    {
        Employee::findOrFail($id)->delete();

        return redirect()
            ->route('empleados')
            ->with('success', 'Empleado eliminado correctamente');
    }
}
