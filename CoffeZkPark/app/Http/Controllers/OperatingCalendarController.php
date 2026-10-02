<?php

namespace App\Http\Controllers;

use App\Models\area;
use App\Models\DayType;
use App\Models\DayTypeStaffing;
use App\Models\OperatingDay;
use App\Services\OperatingCalendar;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Calendario operativo del parque (solo administrador): tipos de día, el tipo de cada fecha
 * y el personal mínimo por área según el tipo. También define la temporada alta: los tipos
 * marcados con is_high_season (ver OperatingCalendar::highSeasonRanges()). Las pantallas de
 * programación lo leen con days() y WeeklyStaffingValidator bloquea lo que quede por debajo
 * del mínimo.
 */
class OperatingCalendarController extends Controller
{
    public function index()
    {
        return Inertia::render('OperatingCalendar', [
            'currentRouteName' => 'servicios',
            'dayTypes' => DayType::orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'color', 'sort_order', 'is_high_season']),
            // El personal mínimo por tipo de día solo aplica a áreas variables (Operaciones).
            'areas' => area::where('scheduling_mode', 'variable')->orderBy('nombre')->get(['id', 'nombre']),
            'staffing' => DayTypeStaffing::get(['area_id', 'day_type_id', 'min_staff']),
            'closedDayExitTimes' => OperatingCalendar::closedDayExitTimes(),
        ]);
    }

    /**
     * Tipos de día de un rango (lo usan también las pantallas de programación). Con area_id,
     * cada fecha trae además 'min_staff': cuántas personas pide esa área ese día (null si el
     * administrador no definió mínimo para ese tipo).
     */
    public function days(Request $request)
    {
        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'area_id' => ['nullable', 'integer', Rule::exists('areas', 'id')],
        ]);

        $days = OperatingCalendar::daysInRange(
            Carbon::parse($validated['from'])->toDateString(),
            Carbon::parse($validated['to'])->toDateString(),
        );

        if (!empty($validated['area_id'])) {
            $minStaff = OperatingCalendar::minStaffForArea((int) $validated['area_id']);
            foreach ($days as &$day) {
                $day['min_staff'] = $minStaff[$day['id']] ?? null;
            }
            unset($day);
        }

        return response()->json($days);
    }

    public function storeType(Request $request)
    {
        DayType::create($this->validateType($request));
        OperatingCalendar::forgetHighSeasonCache();

        return back();
    }

    public function updateType(Request $request, DayType $dayType)
    {
        $dayType->update($this->validateType($request, $dayType));
        OperatingCalendar::forgetHighSeasonCache();

        return back();
    }

    /** Borra el tipo junto con los días que lo tenían y su personal mínimo (cascade). */
    public function destroyType(DayType $dayType)
    {
        $dayType->delete();
        OperatingCalendar::forgetHighSeasonCache();

        return back();
    }

    /**
     * Guarda los tipos de día de un mes completo: las fechas que llegan con tipo se asignan,
     * las que llegan en null quedan sin tipo.
     */
    public function saveMonth(Request $request)
    {
        $validated = $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
            'days' => 'present|array',
            'days.*' => ['nullable', 'integer', Rule::exists('day_types', 'id')],
        ]);

        $start = Carbon::create($validated['year'], $validated['month'], 1);
        $end = $start->copy()->endOfMonth();

        DB::transaction(function () use ($validated, $start, $end) {
            foreach ($validated['days'] as $date => $dayTypeId) {
                $date = Carbon::parse($date);
                if ($date->lt($start) || $date->gt($end)) {
                    continue; // solo fechas del mes que se está guardando.
                }
                if ($dayTypeId === null) {
                    OperatingDay::where('date', $date->toDateString())->delete();
                } else {
                    OperatingDay::updateOrCreate(['date' => $date->toDateString()], ['day_type_id' => $dayTypeId]);
                }
            }
        });
        OperatingCalendar::forgetHighSeasonCache();

        return back();
    }

    /**
     * Hora de salida de las áreas de jornada fija los días de parque cerrado (lunes y martes
     * fuera de temporada alta), ver OperatingCalendar::isParkClosed().
     */
    public function saveClosedDayExitTimes(Request $request)
    {
        $validated = $request->validate([
            'monday' => ['required', 'date_format:H:i'],
            'tuesday' => ['required', 'date_format:H:i'],
        ]);

        OperatingCalendar::saveClosedDayExitTimes([1 => $validated['monday'], 2 => $validated['tuesday']]);

        return back();
    }

    /**
     * Guarda la tabla de personal mínimo: 0 o vacío quita el mínimo de esa combinación. Solo
     * áreas variables: las de turno fijo no tienen personal mínimo por tipo de día.
     */
    public function saveStaffing(Request $request)
    {
        $validated = $request->validate([
            'staffing' => 'present|array',
            'staffing.*.area_id' => ['required', 'integer', Rule::exists('areas', 'id')->where('scheduling_mode', 'variable')],
            'staffing.*.day_type_id' => ['required', 'integer', Rule::exists('day_types', 'id')],
            'staffing.*.min_staff' => 'nullable|integer|min:0|max:999',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['staffing'] as $row) {
                $keys = ['area_id' => $row['area_id'], 'day_type_id' => $row['day_type_id']];
                if (empty($row['min_staff'])) {
                    DayTypeStaffing::where($keys)->delete();
                } else {
                    DayTypeStaffing::updateOrCreate($keys, ['min_staff' => $row['min_staff']]);
                }
            }
        });

        return back();
    }

    private function validateType(Request $request, ?DayType $dayType = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:30', Rule::unique('day_types', 'name')->ignore($dayType?->id)],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'sort_order' => 'nullable|integer|min:0|max:999',
            'is_high_season' => 'sometimes|boolean',
        ]);
        $data['sort_order'] = $data['sort_order'] ?? 0;
        $data['is_high_season'] = (bool) ($data['is_high_season'] ?? false);

        return $data;
    }
}
