<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\calendars;
use Illuminate\Http\Request;

class CalendarsController extends Controller
{
    use EnsuresAreaAccess;

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

                'is_custom',
                'created_for_employee_uid',
            ]);

        return response()->json($calendars);
    }

    /**
     *
     *  Crear un turno/calendario para un area
     *
     * ==========================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|integer|exists:areas,id',
            'hora_entrada' => 'required|date_format:H:i',
            'hora_salida' => 'required|date_format:H:i|different:hora_entrada',
            'shift_type' => 'required|in:D,N',
            'is_custom' => 'sometimes|boolean',
            'created_for_employee_uid' => 'required_if:is_custom,true|nullable|string|exists:employees,uid',
        ]);

        $this->ensureAreaAcces($validated['area_id']);

        $employeeUid = $validated['created_for_employee_uid'] ?? null;

        $duplicado = calendars::where('area_id', $validated['area_id'])
            ->where('hora_entrada', $validated['hora_entrada'])
            ->where('hora_salida', $validated['hora_salida'])
            ->where('shift_type', $validated['shift_type'])
            ->where('created_for_employee_uid', $employeeUid)
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un turno igual registrado para esta área.',
            ], 422);
        }

        $calendar = calendars::create($validated);

        return response()->json($calendar, 201);
    }

    /**
     * ==========================================
     *
     *  Editar un turno/calendario existente
     *
     * ==========================================
     */
    public function update(Request $request, calendars $calendar)
    {
        $this->ensureAreaAcces($calendar->area_id);

        $validated = $request->validate([
            'hora_entrada' => 'required|date_format:H:i',
            'hora_salida' => 'required|date_format:H:i|different:hora_entrada',
            'shift_type' => 'required|in:D,N',
        ]);

        $duplicado = calendars::where('area_id', $calendar->area_id)
            ->where('id', '!=', $calendar->id)
            ->where('hora_entrada', $validated['hora_entrada'])
            ->where('hora_salida', $validated['hora_salida'])
            ->where('shift_type', $validated['shift_type'])
            ->exists();

        if ($duplicado) {
            return response()->json([
                'message' => 'Ya existe un turno igual registrado para esta área.',
            ], 422);
        }

        $calendar->update($validated);

        return response()->json($calendar);
    }

    /**
     * ==========================================
     *
     *  Eliminar un turno/calendario
     *
     * ==========================================
     */
    public function destroy(calendars $calendar)
    {
        $this->ensureAreaAcces($calendar->area_id);

        $enUso = $calendar->programations()->exists() || $calendar->overrides()->exists();

        if ($enUso) {
            return response()->json([
                'message' => 'No se puede eliminar: este turno está siendo usado en programaciones existentes. Cancélalas o reasígnalas primero.',
            ], 422);
        }

        $calendar->delete();

        return response()->json(['success' => true]);
    }

}
