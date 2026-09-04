import { router } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';

interface EditDeviceModalProps {
    show: boolean;
    device: any | null;
    onClose: () => void;
}

export default function EditDeviceModal({ show, device, onClose }: EditDeviceModalProps) {
    const [name, setName] = useState('');
    const [ip, setIp] = useState('');
    const [port, setPort] = useState('');
    const [state, setState] = useState(true);

    useEffect(() => {
        if (device) {
            setName(device.name || '');
            setIp(device.ip || '');
            setPort(device.port || '');
            setState(device.state ?? true);
        }
    }, [device]);

    if (!show || !device) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.put(route('devices.update', device.id), { name, ip, port, state });
        onClose();
    };

    return (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-bold">Editar Dispositivo</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium">Nombre</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full rounded border p-2"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium">IP</label>
                        <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} className="mt-1 w-full rounded border p-2" required />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium">Puerto</label>
                        <input
                            type="number"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            className="mt-1 w-full rounded border p-2"
                            required
                        />
                    </div>

                    <div className="mb-4 flex items-center gap-2">
                        <input id="edit-device-state" type="checkbox" checked={state} onChange={(e) => setState(e.target.checked)} />
                        <label htmlFor="edit-device-state" className="text-sm font-medium">
                            Dispositivo activo
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400">
                            Cancelar
                        </button>
                        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
