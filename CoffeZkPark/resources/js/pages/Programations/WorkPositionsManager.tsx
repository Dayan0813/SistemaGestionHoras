import { Briefcase, Edit3, Plus, Power, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkPosition } from './programaciones.types';

interface Props {
    positions: WorkPosition[];
    onCreate: () => void;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
    onToggleActive: (position: WorkPosition) => void;
    onClose: () => void;
}

// Lista completa de atracciones y puestos del área, con crear / editar / activar-desactivar /
// eliminar a la vista (antes editar y eliminar solo aparecían dentro de la ventana de un día).
// Usa z-10 a propósito: las ventanas de crear/editar/eliminar (z-20 y z-30) se abren encima.
export default function WorkPositionsManager({ positions, onCreate, onEdit, onDelete, onToggleActive, onClose }: Props) {
    const [search, setSearch] = useState('');

    const byAttraction = useMemo(() => {
        const term = search.trim().toLowerCase();
        const groups = new Map<string, WorkPosition[]>();
        positions
            .filter((p) => !term || p.name.toLowerCase().includes(term) || p.attraction.toLowerCase().includes(term))
            .sort((a, b) => a.attraction.localeCompare(b.attraction) || a.name.localeCompare(b.name))
            .forEach((p) => groups.set(p.attraction, [...(groups.get(p.attraction) ?? []), p]));
        return [...groups.entries()];
    }, [positions, search]);

    const activeCount = positions.filter((p) => p.active).length;

    return (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 border-b border-gray-100 px-7 py-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#a81c24]/10">
                        <Briefcase className="h-5 w-5 text-[#a81c24]" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-gray-900">Puestos de trabajo</h2>
                        <p className="text-xs text-gray-500">
                            {positions.length} puesto{positions.length === 1 ? '' : 's'} · {activeCount} activo{activeCount === 1 ? '' : 's'}. Los
                            inactivos no aparecen para programar ni en la plantilla de Excel.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3 px-7 py-4">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar atracción o puesto…"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800"
                    />
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#c9252d]"
                    >
                        <Plus size={14} /> Nuevo puesto
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-7 pb-7">
                    {byAttraction.length === 0 && (
                        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                            {positions.length === 0 ? 'Esta área todavía no tiene puestos.' : 'Ningún puesto coincide con la búsqueda.'}
                        </p>
                    )}
                    {byAttraction.map(([attraction, items]) => (
                        <section key={attraction}>
                            <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-400 uppercase">{attraction}</h3>
                            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                                {items.map((position) => (
                                    <li key={position.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${position.active ? 'bg-[#95c020]' : 'bg-gray-300'}`} />
                                        <span className={`flex-1 truncate text-sm font-medium ${position.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                                            {position.name}
                                        </span>
                                        {!position.active && (
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 uppercase">Inactivo</span>
                                        )}
                                        <button
                                            onClick={() => onToggleActive(position)}
                                            title={position.active ? 'Desactivar' : 'Activar'}
                                            className={`rounded p-1.5 hover:bg-gray-100 ${position.active ? 'text-gray-400 hover:text-gray-700' : 'text-[#5e7a15]'}`}
                                        >
                                            <Power size={14} />
                                        </button>
                                        <button onClick={() => onEdit(position.id)} title="Editar" className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(position.id)}
                                            title="Eliminar"
                                            className="rounded p-1.5 text-gray-400 hover:bg-[#fdf0f0] hover:text-[#a81c24]"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
