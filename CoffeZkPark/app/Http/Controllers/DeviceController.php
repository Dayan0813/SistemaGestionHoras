<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeviceController extends Controller
{
    public function index()
    {
        $devices = Device::all();
        return Inertia::render('Devices/index', [
            'devices' => $devices
        ]);
    }

    public function create()
    {
        return Inertia::render('Devices/Create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'ip' => 'required|ip',
            'port' => 'required|numeric',
        ]);

        Device::create($request->only('name', 'ip', 'port'));

        return redirect()->route('devices.index')->with('success', 'Dispositivo agregado correctamente.');
    }

    public function edit(Device $device)
    {
        return Inertia::render('Devices/Edit', [
            'device' => $device
        ]);
    }

    public function update(Request $request, Device $device)
    {
        $request->validate([
            'name' => 'required|string',
            'ip' => 'required|ip',
            'port' => 'required|numeric',
        ]);

        $device->update($request->only('name', 'ip', 'port'));

        return redirect()->route('devices.index')->with('success', 'Dispositivo actualizado correctamente.');
    }

    public function destroy(Device $device)
    {
        $device->delete();

        return redirect()->route('devices.index')->with('success', 'Dispositivo eliminado.');
    }
}
