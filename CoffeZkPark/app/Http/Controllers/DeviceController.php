<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceController extends Controller
{
    public function index()
    {
        $devices = Device::orderBy('name')->get();
        return Inertia::render('Devices/index', [
            'devices' => $devices,
            'currentRouteName' => 'devices',
        ]);
    }

    public function create()
    {
        return Inertia::render('Devices/Create', [
            'currentRouteName' => 'devices',
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'ip' => 'required|ip',
            'port' => 'required|numeric',
            'state' => 'nullable|boolean',
        ]);

        Device::create([
            'name' => $validated['name'],
            'ip' => $validated['ip'],
            'port' => $validated['port'],
            'state' => $validated['state'] ?? true,
        ]);

        return redirect()->route('devices.index')->with('success', 'Dispositivo agregado correctamente.');
    }

    // La edición se hace con un modal en Devices/index.tsx, no con una página aparte.

    public function update(Request $request, Device $device)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'ip' => 'required|ip',
            'port' => 'required|numeric',
            'state' => 'nullable|boolean',
        ]);

        $device->update([
            'name' => $validated['name'],
            'ip' => $validated['ip'],
            'port' => $validated['port'],
            'state' => $validated['state'] ?? $device->state,
        ]);

        return redirect()->route('devices.index')->with('success', 'Dispositivo actualizado correctamente.');
    }

    public function destroy(Device $device)
    {
        $device->delete();

        return redirect()->route('devices.index')->with('success', 'Dispositivo eliminado.');
    }
}
 

