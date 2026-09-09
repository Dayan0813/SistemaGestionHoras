import { useForm } from '@inertiajs/react';
import { XCircle } from 'lucide-react';
import React, { useEffect } from 'react';

interface AreaData {
    id: number;
    nombre: string;
    centro_costo: string;
    descripcion: string | null;
    scheduling_mode: 'fijo' | 'variable';
}

interface Props {
    show: boolean;
    area: AreaData;
    onClose: () => void;
}

export default function EditAreaModal({ show, area, onClose }: Props) {
    const { data, setData, put, processing, errors, reset } = useForm({
        nombre: area.nombre,
        centro_costo: area.centro_costo,
        descripcion: area.descripcion ?? '',
        scheduling_mode: area.scheduling_mode,
    });

    // El modal nunca se desmonta (show solo controla un return temprano), así
    // que sin esto reabrirlo no reflejaría un `area` que haya cambiado desde
    // la primera vez que se montó.
    useEffect(() => {
        if (show) {
            setData({
                nombre: area.nombre,
                centro_costo: area.centro_costo,
                descripcion: area.descripcion ?? '',
                scheduling_mode: area.scheduling_mode,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, area]);

    if (!show) return null;

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('areas.update', area.id), {
            onSuccess: () => onClose(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-800">Editar Área</h2>
                    <button type="button" onClick={handleClose} className="text-gray-500 hover:text-gray-800">
                        <XCircle />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input
                            type="text"
                            value={data.nombre}
                            onChange={(e) => setData('nombre', e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                            autoFocus
                        />
                        {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Centro de costo</label>
                        <input
                            type="text"
                            value={data.centro_costo}
                            onChange={(e) => setData('centro_costo', e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        />
                        {errors.centro_costo && <p className="mt-1 text-xs text-red-600">{errors.centro_costo}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descripción (opcional)</label>
                        <textarea
                            value={data.descripcion}
                            onChange={(e) => setData('descripcion', e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        />
                        {errors.descripcion && <p className="mt-1 text-xs text-red-600">{errors.descripcion}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Modo de programación</label>
                        <select
                            value={data.scheduling_mode}
                            onChange={(e) => setData('scheduling_mode', e.target.value as 'fijo' | 'variable')}
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        >
                            <option value="fijo">Horario fijo (Lunes a Viernes)</option>
                            <option value="variable">Horario variable (según demanda)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">
                            Define cómo el coordinador de esta área va a programar turnos: con un patrón semanal fijo, o eligiendo días sueltos según
                            la afluencia.
                        </p>
                        {errors.scheduling_mode && <p className="mt-1 text-xs text-red-600">{errors.scheduling_mode}</p>}
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded border border-[#95c020] bg-[#95c020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7da81a] disabled:opacity-50"
                        >
                            {processing ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
