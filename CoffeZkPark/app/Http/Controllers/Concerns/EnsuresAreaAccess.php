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

    /**
     * Acceso de SOLO LECTURA a un área: aux_admin_th y aux_th pueden consultar CUALQUIER área
     * (programación, ausencias que se muestran en ella); el resto de roles conserva la
     * restricción a su propia área de ensureAreaAcces().
     */
    public function ensureAreaViewAccess(int $areaId): void
    {
        $user = auth()->user();

        if ($user->hasRole('aux_admin_th') || $user->hasRole('aux_th')) {
            return;
        }

        $this->ensureAreaAcces($areaId);
    }
}
