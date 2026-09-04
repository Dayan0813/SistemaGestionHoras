<?php

namespace App\Http\Controllers\Concerns;

trait EnsuresAreaAccess
{
    /**
     * ==========================================================
     *
     *  HELPER PARA VALIDACIONES
     *
     * ===========================================================
     */
    public function ensureAreaAcces(int $areaId): void
    {
        $user = auth()->user();

        // Admin puede ver todo
        if ($user->hasRole('admin')) {
            return;
        }

        // Usuario sin empleado asociado -> error
        if (!$user->employee) {
            abort(403, 'Usuario sin empleado asociado');
        }

        // Resto de roles: SOLO su área
        if ((int) $user->employee->area_id !== (int) $areaId) {
            abort(403);
        }
    }
}
