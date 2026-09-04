<?php

namespace App\Http\Controllers;

use App\Models\cargo as Cargo;
use App\Models\contrato as Contrato;
use Illuminate\Http\Request;

class EmployeeCatalogsController extends Controller
{
    /**
     * ===========================
     *
     *  CARGOS
     *
     * ===========================
     */

    public function storeCargo(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:cargo,name',
        ]);

        return response()->json(Cargo::create($validated));
    }

    public function destroyCargo(Cargo $cargo)
    {
        if ($cargo->employees()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar: hay empleados con este cargo.',
            ], 422);
        }

        $cargo->delete();

        return response()->json(['success' => true]);
    }

    /**
     * ===========================
     *
     *  CONTRATOS
     *
     * ===========================
     */

    public function storeContrato(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:contrato,name',
        ]);

        return response()->json(Contrato::create($validated));
    }

    public function destroyContrato(Contrato $contrato)
    {
        if ($contrato->employees()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar: hay empleados con este contrato.',
            ], 422);
        }

        $contrato->delete();

        return response()->json(['success' => true]);
    }
}
