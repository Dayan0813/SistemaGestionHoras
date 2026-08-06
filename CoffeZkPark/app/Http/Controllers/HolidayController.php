<?php

namespace App\Http\Controllers;

use App\Models\Holidays;
use Carbon\Carbon;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    // Funcion para le manejo de rangos

    public function byRange(Request $request)
    {
        $validated = $request->validate([
            'from' => 'required|date',
            'to'   => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($validated['from'])->startOfDay();
        $to   = Carbon::parse($validated['to'])->endOfDay();

        $holidays = Holidays::whereBetween('date', [$from, $to])
            ->orderBy('date')
            ->get()
            ->map(fn($h) => [
                'date' => $h->date->toDateString(),
                'name' => $h->name,
            ]);

        return response()->json([
            'from'     => $from->toDateString(),
            'to'       => $to->toDateString(),
            'holidays' => $holidays,
        ]);
    }
}
