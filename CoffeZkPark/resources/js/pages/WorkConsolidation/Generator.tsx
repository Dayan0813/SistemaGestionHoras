import { router } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';
import Autocomplete from './EmployeeAutocomplete';

export default function Generator({ employees, areas }: any) {
    // =========================
    // ESTADOS
    // =========================
    const [mode, setMode] = useState<'persona' | 'area' | 'universal'>('persona');

    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [selectedArea, setSelectedArea] = useState<any>(null);

    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // =========================
    // SUBMIT
    // =========================
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const payload = {
                mode,
                employee_uid: selectedEmployee?.uid || null,
                area_id: selectedArea?.id || null,
                from,
                to,
            };

            console.log('ENVIANDO PAYLOAD:', payload);

            await axios.post(route('consolidations.generate'), payload);

            setMessage('Consolidado generado correctamente.');
            router.visit(route('consolidations.index'));
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Error al generar.');
        }

        setLoading(false);
    };

    // =========================
    // RENDER
    // =========================
    return (
        <div className="rounded-xl border border-gray-200/60 bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* MODO */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Modo</label>
                    <select
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={mode}
                        onChange={(e) => {
                            setMode(e.target.value as any);
                            setSelectedEmployee(null);
                            setSelectedArea(null);
                        }}
                    >
                        <option value="persona">Por persona</option>
                        <option value="area">Por área</option>
                        <option value="universal">Universal</option>
                    </select>
                </div>

                {/* PERSONA */}
                {mode === 'persona' && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Empleado</label>

                        <Autocomplete
                            items={employees}
                            value={selectedEmployee}
                            placeholder="Buscar empleado..."
                            getLabel={(e) => `${e.name} (${e.uid})`}
                            getSubLabel={(e) => e.uid}
                            onSelect={setSelectedEmployee}
                        />
                    </div>
                )}

                {/* ÁREA */}
                {mode === 'area' && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Área</label>

                        <Autocomplete
                            items={areas}
                            value={selectedArea}
                            placeholder="Buscar área..."
                            getLabel={(a) => a.nombre}
                            getSubLabel={(a) => `ID: ${a.id}`}
                            onSelect={setSelectedArea}
                        />
                    </div>
                )}

                {/* FECHAS */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Desde</label>
                        <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Hasta</label>
                        <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                </div>

                {/* BOTÓN */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-[#a81c24] py-2.5 text-sm font-semibold text-white hover:bg-[#de242f] disabled:opacity-50"
                >
                    {loading ? 'Generando…' : 'Generar consolidado'}
                </button>

                {/* MENSAJE */}
                {message && <p className="text-sm font-medium text-green-600">{message}</p>}
            </form>
        </div>
    );
}
