<?php

namespace App\Http\Controllers\Concerns;

trait EnsuresAreaAccess
{
    public function ensureAreaAcces(int $areaId): void
    {
        $user = auth()->user();

        if ($user->hasRole('admin')) {
            return;
        }

        if (!$user->employee) {
            abort(403, 'Usuario sin empleado asociado');
        }

        // Coordinador: puede tener varias áreas en coordinator_areas; si no tiene
        // ninguna registrada allí, cae al área única del employee como fallback.
        if ($user->hasRole('coordinator')) {
            $assigned = $user->coordinatorAreaIds();
            if (!empty($assigned)) {
                if (!in_array($areaId, $assigned, true)) {
                    abort(403);
                }
                return;
            }
            // Fallback: área única del employee
            if ((int) $user->employee->area_id !== $areaId) {
                abort(403);
            }
            return;
        }

        // Resto de roles: solo su área
        if ((int) $user->employee->area_id !== $areaId) {
            abort(403);
        }
    }

    /**
     * Acceso de SOLO LECTURA: aux_admin_th y aux_th pueden consultar cualquier área.
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
