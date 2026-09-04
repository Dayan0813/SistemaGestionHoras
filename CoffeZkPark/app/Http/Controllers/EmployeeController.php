<?php

namespace App\Http\Controllers;

use App\Models\area as Area;
use App\Models\cargo as Cargo;
use App\Models\contrato as Contrato;
use App\Models\Employee;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user()->loadMissing('employee');
        $query = Employee::query();

        if ($user->hasRole('coordinator')) {
            $areaId = $user->employee?->area_id;

            if (!$areaId) {
                abort(403, 'Usuario sin área asignada');
            }

            $query->where('area_id', $areaId);
        }

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

        $totalEmployees = (clone $query)->count();
        $totalActiveEmployees = (clone $query)->where('estado', 'Activo')->count();
        $totalInactiveEmployees = (clone $query)->where('estado', 'Inactivo')->count();

        $byContrato = (clone $query)->with('contrato')
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
            'areas' => $user->hasRole('coordinator')
                ? Area::where('id', $user->employee->area_id)->select('nombre', 'id', 'centro_costo')->get()
                : Area::select('nombre', 'id', 'centro_costo')->get(),
            'cargo' => Cargo::pluck('name', 'id'),
            'contrato' => Contrato::pluck('name', 'id'),
            'currentRouteName' => 'empleados',
        ]);
    }

    // =======================
    // STORE
    // =======================

    public function store(Request $request)
    {
        $user = auth()->user()->loadMissing('employee');

        $validated = $request->validate([
            'userid' => 'nullable|string|unique:employees,userid',
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

        // Coordinador: solo puede crear empleados en su propia área.
        if ($user->hasRole('coordinator')) {
            if (!$user->employee?->area_id) {
                abort(403, 'Usuario sin área asignada');
            }
            $validated['area_id'] = $user->employee->area_id;
        }

        // Mismo criterio área/cargo/contrato que update()
        if (!empty($validated['area_id'])) {
            $area = Area::find($validated['area_id']);
            $validated['centrocosto'] = $area?->centro_costo;
        } elseif (!empty($validated['centrocosto'])) {
            $area = Area::where('centro_costo', $validated['centrocosto'])->first();
            if ($area) {
                $validated['area_id'] = $area->id;
            }
        }

        if (!empty($validated['cargo_id'])) {
            $validated['cargo'] = $validated['cargo_id'];
        }

        if (!empty($validated['contrato_id'])) {
            $contrato = Contrato::find($validated['contrato_id']);
            $validated['tipo_contrato'] = $contrato?->name;
            $validated['empresa'] = $contrato?->id;
        }

        // El uid es la identidad interna del empleado: la referencian
        // programaciones, marcaciones y la cuenta de usuario. No se pide en
        // el formulario, se genera aquí. Si esta persona se enrola más
        // adelante en el huellero con el mismo "userid", la sincronización
        // encuentra este mismo registro por userid y lo reutiliza en vez de
        // crear uno duplicado (el uid del huellero nunca sobreescribe este).
        do {
            $uid = 'M' . random_int(100000, 999999);
        } while (Employee::where('uid', $uid)->exists());

        Employee::create([
            ...$validated,
            'uid' => $uid,
        ]);

        return redirect()
            ->route('empleados')
            ->with('success', 'Empleado creado correctamente');
    }

    // =======================
    // UPDATE
    // =======================

    public function update(Request $request, Employee $employee)
    {
        $this->ensureCoordinatorArea($employee);

        // uid es intencionalmente NO editable: programaciones, marcaciones y el
        // usuario de acceso lo referencian como llave foránea; cambiarlo dejaría
        // huérfanos esos registros.
        $validated = $request->validate([
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
        $employee = Employee::findOrFail($id);
        $this->ensureCoordinatorArea($employee);

        // Borrar un empleado elimina en cascada (a nivel de base de datos) su
        // cuenta de usuario, sus programaciones y sus marcaciones. Si tiene
        // algo de eso, se bloquea el borrado: para dejar de contar a alguien
        // que ya no trabaja aquí, se usa el estado "Inactivo", que conserva
        // el historial en vez de destruirlo.
        if ($employee->user()->exists()) {
            return back()->withErrors([
                'delete' => 'Este empleado tiene una cuenta de acceso al sistema. Elimina o reasigna esa cuenta antes de poder eliminarlo.',
            ]);
        }

        if ($employee->programations()->exists() || $employee->markingLogs()->exists()) {
            return back()->withErrors([
                'delete' => 'Este empleado tiene programaciones o marcaciones registradas. Márcalo como "Inactivo" para conservar su historial en vez de eliminarlo.',
            ]);
        }

        $employee->delete();

        return redirect()
            ->route('empleados')
            ->with('success', 'Empleado eliminado correctamente');
    }

    private function ensureCoordinatorArea(Employee $employee): void
    {
        $user = auth()->user()->loadMissing('employee');

        if (!$user->hasRole('coordinator')) {
            return;
        }

        if (!$user->employee?->area_id || (int) $user->employee->area_id !== (int) $employee->area_id) {
            abort(403, 'No puedes gestionar empleados de otra área');
        }
    }
}
