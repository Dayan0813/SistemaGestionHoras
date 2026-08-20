<?php

namespace App\Http\Controllers;

use App\Models\WorkPosition;
use Illuminate\Http\Request;

class WorkPositionController extends Controller
{
    // Funcion para ubicar puestos de trabajo por area

    public function getPositionByArea($areaId)
    {
        $this->ensureAreaAcces($areaId);

        //Buscamos los puestos que pertencen al area y que esten activos
        $positions = WorkPosition::where('area_id', $areaId)
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json($positions);
    }

    /**
     * ==========================================
     * 
     *  HELPER PARA VALIDACIONES (MISMA LÓGICA)
     * 
     * ==========================================
     */
    protected function ensureAreaAcces(int $areaId): void
    {
        $user = auth()->user();

        // Admin puede ver todo
        if ($user->hasRole('admin')) {
            return;
        }

        // Coordinator sin empleado → prohibido
        if (!$user->employee) {
            abort(403, 'Usuario sin empleado asociado');
        }

        // Coordinator SOLO su área
        if ((int) $user->employee->area_id !== (int) $areaId) {
            abort(403);
        }
    }
}
