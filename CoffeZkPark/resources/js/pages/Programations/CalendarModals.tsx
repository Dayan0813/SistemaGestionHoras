import ConfirmModal from '@/Components/confirmModal';
import { X } from 'lucide-react';
import type { Calendar } from './programaciones.types';

interface Props {
    calendars: Calendar[];
    areaName: string;
    shiftLabel: (calendar: Calendar) => string;
    editingId: number | null;
    onCloseEdit: () => void;
    onSubmitEdit: (event: React.FormEvent<HTMLFormElement>) => void;
    creating: boolean;
    onCloseCreate: () => void;
    onSubmitCreate: (event: React.FormEvent<HTMLFormElement>) => void;
    deletingId: number | null;
    onConfirmDelete: () => void;
    onCloseDelete: () => void;
}

// Los 3 modales de gestión de turnos (Paso 02) del asistente de Programaciones: editar
// horario, crear turno nuevo, y la confirmación de borrado. Extraído de Programaciones.tsx
// para que ese archivo no cargue con las ~150 líneas de formularios que esto ocupaba.
export default function CalendarModals({
    calendars,
    areaName,
    shiftLabel,
    editingId,
    onCloseEdit,
    onSubmitEdit,
    creating,
    onCloseCreate,
    onSubmitCreate,
    deletingId,
    onConfirmDelete,
    onCloseDelete,
}: Props) {
    const editingCalendar = editingId !== null ? (calendars.find((c) => c.id === editingId) ?? null) : null;
    const calendarPendingDeletion = deletingId !== null ? (calendars.find((c) => c.id === deletingId) ?? null) : null;

    return (
        <>
            {editingCalendar && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                    <form className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" onSubmit={onSubmitEdit}>
                        <button type="button" className="absolute top-5 right-5 text-gray-400 hover:text-gray-600" onClick={onCloseEdit}>
                            <X size={18} />
                        </button>
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del turno</p>
                        <h2 className="text-xl font-semibold text-gray-900">Editar {shiftLabel(editingCalendar)}</h2>
                        <p className="mt-1 mb-6 text-sm text-gray-500">Actualiza el horario y se reflejará en toda la programación.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-bold text-gray-600">
                                Hora de inicio
                                <input
                                    name="start"
                                    type="time"
                                    defaultValue={editingCalendar.hora_entrada?.slice(0, 5) ?? ''}
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="text-xs font-bold text-gray-600">
                                Hora de fin
                                <input
                                    name="end"
                                    type="time"
                                    defaultValue={editingCalendar.hora_salida?.slice(0, 5) ?? ''}
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCloseEdit}
                                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">Guardar cambios</button>
                        </div>
                    </form>
                </div>
            )}

            {creating && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                    <form className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" onSubmit={onSubmitCreate}>
                        <button type="button" className="absolute top-5 right-5 text-gray-400 hover:text-gray-600" onClick={onCloseCreate}>
                            <X size={18} />
                        </button>
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del turno</p>
                        <h2 className="text-xl font-semibold text-gray-900">Nuevo turno</h2>
                        <p className="mt-1 mb-6 text-sm text-gray-500">
                            Define el horario de este turno para {areaName}. Va a quedar disponible para toda el área.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-bold text-gray-600">
                                Hora de inicio
                                <input
                                    name="start"
                                    type="time"
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="text-xs font-bold text-gray-600">
                                Hora de fin
                                <input
                                    name="end"
                                    type="time"
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                        </div>
                        <label className="mt-3 block text-xs font-bold text-gray-600">
                            Tipo
                            <select
                                name="shift_type"
                                defaultValue="D"
                                required
                                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                            >
                                <option value="D">Diurno</option>
                                <option value="N">Nocturno</option>
                            </select>
                        </label>
                        <p className="mt-1 text-xs text-gray-400">
                            Diurno/Nocturno alimenta el cálculo de recargos en nómina; no cambia el nombre que ves en pantalla.
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCloseCreate}
                                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">Crear turno</button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmModal
                show={deletingId !== null}
                title="Eliminar turno"
                message={`¿Eliminar "${calendarPendingDeletion ? shiftLabel(calendarPendingDeletion) : 'este turno'}"? Esta acción no se puede deshacer. Si el turno ya tiene programaciones asociadas, no se podrá eliminar.`}
                onConfirm={onConfirmDelete}
                onClose={onCloseDelete}
            />
        </>
    );
}
