import { useForm } from '@inertiajs/react';
import { XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface EligibleEmployee {
    uid: string;
    name: string;
}

interface Props {
    show: boolean;
    eligibleEmployees: EligibleEmployee[];
    onClose: () => void;
}

export default function CreateAreaModal({ show, eligibleEmployees, onClose }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm({
        nombre: '',
        centro_costo: '',
        descripcion: '',
        scheduling_mode: 'fijo',
        coordinator_employee_uid: '',
        coordinator_email: '',
        coordinator_password: '',
    });

    const [search, setSearch] = useState('');
    const [showList, setShowList] = useState(false);

    if (!show) return null;

    const filteredEmployees = eligibleEmployees.filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()));

    const handleClose = () => {
        reset();
        setSearch('');
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('areas.store'), {
            onSuccess: () => {
                reset();
                setSearch('');
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Modo de programación</label>
                        <select
                            value={data.scheduling_mode}
                            onChange={(e) => setData('scheduling_mode', e.target.value)}
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        >
                            <option value="fijo">Horario fijo (Lunes a Viernes)</option>
                            <option value="variable">Horario variable (según demanda)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">
                            Define cómo el coordinador de esta área va a programar turnos: con un patrón semanal fijo, o eligiendo
                            días sueltos según la afluencia.
                        </p>
                        {errors.scheduling_mode && <p className="mt-1 text-xs text-red-600">{errors.scheduling_mode}</p>}
                    </div>

                    <div className="border-t pt-4">
                        <p className="mb-3 text-sm font-bold text-gray-800">Coordinador del área</p>

                        {eligibleEmployees.length === 0 ? (
                            <p className="rounded bg-amber-50 p-3 text-xs text-amber-700">
                                No hay empleados disponibles para asignar como coordinador — primero debe existir el empleado (sin cuenta de
                                usuario todavía) antes de poder crear el área.
                            </p>
                        ) : (
                            <>
                                <div className="relative mb-3">
                                    <label className="block text-sm font-medium text-gray-700">Empleado</label>
                                    <input
                                        type="text"
                                        placeholder="Buscar empleado..."
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setShowList(true);
                                        }}
                                        onFocus={() => setShowList(true)}
                                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                                    />
                                    {showList && filteredEmployees.length > 0 && (
                                        <ul className="absolute z-20 max-h-48 w-full overflow-y-auto rounded border bg-white shadow">
                                            {filteredEmployees.slice(0, 50).map((emp) => (
                                                <li
                                                    key={emp.uid}
                                                    className="cursor-pointer px-3 py-2 text-sm hover:bg-[#95c020] hover:text-white"
                                                    onClick={() => {
                                                        setData('coordinator_employee_uid', emp.uid);
                                                        setSearch(emp.name);
                                                        setShowList(false);
                                                    }}
                                                >
                                                    {emp.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {data.coordinator_employee_uid && <p className="mt-1 text-xs text-green-700">Empleado seleccionado ✔</p>}
                                    {errors.coordinator_employee_uid && (
                                        <p className="mt-1 text-xs text-red-600">{errors.coordinator_employee_uid}</p>
                                    )}
                                </div>

                                <div className="mb-3">
                                    <label className="block text-sm font-medium text-gray-700">Correo del coordinador</label>
                                    <input
                                        type="email"
                                        value={data.coordinator_email}
                                        onChange={(e) => setData('coordinator_email', e.target.value)}
                                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                                    />
                                    {errors.coordinator_email && <p className="mt-1 text-xs text-red-600">{errors.coordinator_email}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contraseña del coordinador</label>
                                    <input
                                        type="password"
                                        value={data.coordinator_password}
                                        onChange={(e) => setData('coordinator_password', e.target.value)}
                                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                                    />
                                    {errors.coordinator_password && (
                                        <p className="mt-1 text-xs text-red-600">{errors.coordinator_password}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button type="button" onClick={handleClose} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={processing || eligibleEmployees.length === 0}
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
