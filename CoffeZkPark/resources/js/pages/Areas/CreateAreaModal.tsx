import { useForm } from '@inertiajs/react';
import { XCircle } from 'lucide-react';
import React from 'react';

interface Props {
    show: boolean;
    onClose: () => void;
}

export default function CreateAreaModal({ show, onClose }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        nombre: '',
        centro_costo: '',
        descripcion: '',
    });

    if (!show) return null;

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('areas.store'), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold text-gray-800">Nueva Área</h2>
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

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button type="button" onClick={handleClose} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded border border-[#95c020] bg-[#95c020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7da81a] disabled:opacity-50"
                        >
                            {processing ? 'Creando…' : 'Crear área'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
