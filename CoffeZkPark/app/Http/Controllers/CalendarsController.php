<?php

namespace App\Http\Controllers;

use App\Models\calendars;
use Illuminate\Http\Request;

class CalendarsController extends Controller
{
    public function byArea($areaId)
    {
        $this->ensureAreaAcces($areaId);

        $calendars = calendars::where('area_id', $areaId)
            ->get([
                'id',
                'area_id',
                'hora_entrada',
                'hora_salida',
                'shift_type',
            ]);

        return response()->json($calendars);
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
