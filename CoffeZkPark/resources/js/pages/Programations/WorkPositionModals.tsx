import ConfirmModal from '@/Components/confirmModal';
import { Plus, X } from 'lucide-react';
import type { WorkPosition } from './programaciones.types';

interface Props {
    workPositionsList: WorkPosition[];
    attractions: string[];
    selectedAttraction: string | null;
    editingId: number | null;
    onCloseEdit: () => void;
    onSubmitEdit: (event: React.FormEvent<HTMLFormElement>) => void;
    creating: boolean;
    onCloseCreate: () => void;
    onSubmitCreate: (event: React.FormEvent<HTMLFormElement>) => void;
    newPositionNames: string[];
    setNewPositionNames: React.Dispatch<React.SetStateAction<string[]>>;
    deletingId: number | null;
    onConfirmDelete: () => void;
    onCloseDelete: () => void;
}

// Los 3 modales de gestión de puestos de trabajo (Paso 03, modo variable) del asistente de
// Programaciones: editar puesto, crear atracción/puesto nuevo, y la confirmación de borrado.
// Extraído de Programaciones.tsx por la misma razón que CalendarModals.tsx.
export default function WorkPositionModals({
    workPositionsList,
    attractions,
    selectedAttraction,
    editingId,
    onCloseEdit,
    onSubmitEdit,
    creating,
    onCloseCreate,
    onSubmitCreate,
    newPositionNames,
    setNewPositionNames,
    deletingId,
    onConfirmDelete,
    onCloseDelete,
}: Props) {
    const editingPosition = editingId !== null ? (workPositionsList.find((p) => p.id === editingId) ?? null) : null;
    const positionPendingDeletion = deletingId !== null ? (workPositionsList.find((p) => p.id === deletingId) ?? null) : null;

    return (
        <>
            {editingPosition && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                    <form className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" onSubmit={onSubmitEdit}>
                        <button type="button" className="absolute top-5 right-5 text-gray-400 hover:text-gray-600" onClick={onCloseEdit}>
                            <X size={18} />
                        </button>
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del puesto</p>
                        <h2 className="text-xl font-semibold text-gray-900">Editar {editingPosition.name}</h2>
                        <div className="mt-6 space-y-3">
                            <label className="block text-xs font-bold text-gray-600">
                                Atracción
                                <input
                                    name="attraction"
                                    list="attractions-list"
                                    defaultValue={editingPosition.attraction}
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="block text-xs font-bold text-gray-600">
                                Puesto
                                <input
                                    name="name"
                                    defaultValue={editingPosition.name}
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                <input name="active" type="checkbox" defaultChecked={editingPosition.active} className="h-4 w-4" />
                                Activo
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
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del puesto</p>
                        <h2 className="text-xl font-semibold text-gray-900">Nueva atracción / puesto</h2>
                        <p className="mt-1 mb-6 text-sm text-gray-500">
                            Si la atracción ya existe, escribe el mismo nombre para agrupar el puesto ahí.
                        </p>
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-600">
                                Atracción
                                <input
                                    name="attraction"
                                    list="attractions-list"
                                    defaultValue={selectedAttraction ?? ''}
                                    required
                                    placeholder="Ej. Zona A"
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                                <datalist id="attractions-list">
                                    {attractions.map((a) => (
                                        <option key={a} value={a} />
                                    ))}
                                </datalist>
                            </label>
                            <div>
                                <p className="mb-1.5 text-xs font-bold text-gray-600">Puesto{newPositionNames.length > 1 ? 's' : ''}</p>
                                <div className="space-y-2">
                                    {newPositionNames.map((value, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                value={value}
                                                onChange={(e) =>
                                                    setNewPositionNames((names) => names.map((n, i) => (i === index ? e.target.value : n)))
                                                }
                                                autoFocus={index === 0}
                                                placeholder={`Ej. Aux${index + 1}`}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                            />
                                            {newPositionNames.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPositionNames((names) => names.filter((_, i) => i !== index))}
                                                    title="Quitar este puesto"
                                                    className="flex-none text-gray-400 hover:text-red-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNewPositionNames((names) => [...names, ''])}
                                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#a81c24] hover:underline"
                                >
                                    <Plus size={12} /> Agregar otro puesto
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onCloseCreate}
                                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">
                                {newPositionNames.filter((n) => n.trim()).length > 1 ? 'Crear puestos' : 'Crear puesto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmModal
                show={deletingId !== null}
                title="Eliminar puesto"
                message={`¿Eliminar "${positionPendingDeletion ? positionPendingDeletion.name : 'este puesto'}"? Esta acción no se puede deshacer. Si el puesto ya tiene programaciones asociadas, no se podrá eliminar.`}
                onConfirm={onConfirmDelete}
                onClose={onCloseDelete}
            />
        </>
    );
}
