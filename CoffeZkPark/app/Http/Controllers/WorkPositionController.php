<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\WorkPosition;
use Illuminate\Http\Request;

class WorkPositionController extends Controller
{
    use EnsuresAreaAccess;

    // Funcion para ubicar puestos de trabajo por area

    public function getPositionByArea($areaId)
    {
        $this->ensureAreaAcces($areaId);

        // Trae también los inactivos: el frontend los necesita para poder
        // gestionarlos (editar, reactivar), igual que calendars.byArea.
        $positions = WorkPosition::where('area_id', $areaId)
            ->orderBy('attraction')
            ->orderBy('name')
            ->get(['id', 'area_id', 'attraction', 'name', 'active']);

        return response()->json($positions);
    }

    /**
     * ==========================================
     *
     *  Crear un puesto de trabajo (atracción + nombre) para un área
     *
     * ==========================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|integer|exists:areas,id',
            'attraction' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'active' => 'sometimes|boolean',
        ]);

        $this->ensureAreaAcces($validated['area_id']);

        $duplicado = WorkPosition::where('area_id', $validated['area_id'])
            ->where('attraction', $validated['attraction'])
            ->where('name', $validated['name'])
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un puesto igual registrado para esta atracción.',
            ], 422);
        }

        $position = WorkPosition::create($validated);

        return response()->json($position, 201);
    }

    /**
     * ==========================================
     *
     *  Editar un puesto de trabajo existente
     *
     * ==========================================
     */
    public function update(Request $request, WorkPosition $workPosition)
    {
        $this->ensureAreaAcces($workPosition->area_id);

        $validated = $request->validate([
            'attraction' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'active' => 'sometimes|boolean',
        ]);

        $duplicado = WorkPosition::where('area_id', $workPosition->area_id)
            ->where('id', '!=', $workPosition->id)
            ->where('attraction', $validated['attraction'])
            ->where('name', $validated['name'])
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un puesto igual registrado para esta atracción.',
            ], 422);
        }

        $workPosition->update($validated);

        return response()->json($workPosition);
    }

    /**
     * ==========================================
     *
     *  Eliminar un puesto de trabajo
     *
     * ==========================================
     */
    public function destroy(WorkPosition $workPosition)
    {
        $this->ensureAreaAcces($workPosition->area_id);

        if ($workPosition->programations()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar: este puesto está siendo usado en programaciones existentes. Cancélalas o reasígnalas primero.',
            ], 422);
        }

        $workPosition->delete();

        return response()->json(['success' => true]);
    }

    /**
     * ==========================================
     *
     *  HELPER PARA VALIDACIONES (MISMA LÓGICA)
     *
     * ==========================================
     */
}
