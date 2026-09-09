import { Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CreateAreaModal from './CreateAreaModal';

interface HighSeasonRange {
    start: string;
    end: string;
}

/* =========================
   TIPOS LOCALES
========================= */

interface Area {
    id: number;
    nombre: string;
    descripcion: string | null;
    centro_costo: string;
    total: number;
    activos: number;
    inactivos: number;
}

interface EligibleEmployee {
    uid: string;
    name: string;
}

interface Props {
    areas: Area[];
    eligibleEmployees: EligibleEmployee[];
    highSeasonRanges: HighSeasonRange[];
    vacationReminderMonths: number;
}

const formatRangeLabel = (range: HighSeasonRange) => {
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(range.start)} – ${fmt(range.end)}`;
};

/* =========================
   COMPONENTE
========================= */

export default function Index({
    areas,
    eligibleEmployees,
    highSeasonRanges: initialHighSeasonRanges,
    vacationReminderMonths: initialVacationReminderMonths,
}: Props) {
    const [showCreate, setShowCreate] = useState(false);
    const { flash, auth } = usePage().props as unknown as { flash?: { success?: string }; auth?: { user?: { permissions?: string[] } } };
    const canManageAreas = auth?.user?.permissions?.includes('areas.gestionar') ?? false;

    // Rangos de fechas de temporada alta, GLOBAL para toda la empresa: dentro de esos rangos no
    // aplica el recorte de horario corto de lunes/martes en áreas de jornada fija. Se configura
    // una sola vez aquí (no área por área) y aplica a todas. Rangos exactos (no meses completos)
    // porque la temporada alta puede empezar/terminar a mitad de mes.
    const [highSeasonRanges, setHighSeasonRanges] = useState<HighSeasonRange[]>(initialHighSeasonRanges);
    const [savingHighSeason, setSavingHighSeason] = useState(false);
    const [newRangeStart, setNewRangeStart] = useState('');
    const [newRangeEnd, setNewRangeEnd] = useState('');
    const [rangeError, setRangeError] = useState<string | null>(null);

    const saveRanges = (next: HighSeasonRange[]) => {
        const previous = highSeasonRanges;
        setHighSeasonRanges(next);
        setSavingHighSeason(true);
        axios
            .put(route('areas.updateHighSeasonRanges'), { high_season_ranges: next })
            .catch(() => setHighSeasonRanges(previous))
            .finally(() => setSavingHighSeason(false));
    };

    const addRange = () => {
        setRangeError(null);
        if (!newRangeStart || !newRangeEnd) {
            setRangeError('Elige fecha de inicio y de fin.');
            return;
        }
        if (newRangeEnd < newRangeStart) {
            setRangeError('La fecha de fin no puede ser antes que la de inicio.');
            return;
        }
        saveRanges([...highSeasonRanges, { start: newRangeStart, end: newRangeEnd }].sort((a, b) => a.start.localeCompare(b.start)));
        setNewRangeStart('');
        setNewRangeEnd('');
    };

    const removeRange = (index: number) => {
        saveRanges(highSeasonRanges.filter((_, i) => i !== index));
    };

    // Meses de anticipación con que se avisa a un coordinador que una reserva de mes de
    // vacaciones (sin fechas todavía) ya necesita fechas exactas — ver PlanVacaciones.tsx.
    const [vacationReminderMonths, setVacationReminderMonths] = useState(initialVacationReminderMonths);
    const [savingReminderMonths, setSavingReminderMonths] = useState(false);

    const saveReminderMonths = (value: number) => {
        const previous = vacationReminderMonths;
        setVacationReminderMonths(value);
        setSavingReminderMonths(true);
        axios
            .put(route('areas.updateVacationReminderMonths'), { vacation_reminder_months: value })
            .catch(() => setVacationReminderMonths(previous))
            .finally(() => setSavingReminderMonths(false));
    };

    return (
        <div className="m-12">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Áreas</h1>
                {canManageAreas && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center rounded-lg border border-[#95c020] px-4 py-2 font-bold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <Plus className="mr-2" size={18} /> Nueva Área
                    </button>
                )}
            </div>

            {flash?.success && <div className="mb-6 rounded bg-green-100 p-3 text-green-700">{flash.success}</div>}

            {canManageAreas && (
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Temporada alta (global)</p>
                    <p className="mt-1 mb-3 text-xs text-gray-500">
                        Aplica a todas las áreas de jornada fija: dentro de estos rangos de fechas NO rige el horario corto de lunes (hasta medio día)
                        y martes (hasta las 4:00pm) — esa política solo aplica en temporada baja. Agrega rangos exactos (pueden empezar o terminar a
                        mitad de mes).
                    </p>

                    {highSeasonRanges.length > 0 && (
                        <ul className="mb-3 space-y-1.5">
                            {highSeasonRanges.map((range, index) => (
                                <li
                                    key={`${range.start}-${range.end}`}
                                    className="flex items-center justify-between rounded-lg bg-[#eaf3d3] px-3 py-2 text-xs font-semibold text-[#5e7a15]"
                                >
                                    {formatRangeLabel(range)}
                                    <button
                                        type="button"
                                        disabled={savingHighSeason}
                                        onClick={() => removeRange(index)}
                                        className="text-[#5e7a15] hover:text-[#a81c24] disabled:cursor-not-allowed disabled:opacity-60"
                                        title="Quitar rango"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs font-semibold text-gray-500">
                            Desde
                            <input
                                type="date"
                                value={newRangeStart}
                                onChange={(e) => setNewRangeStart(e.target.value)}
                                className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                            />
                        </label>
                        <label className="text-xs font-semibold text-gray-500">
                            Hasta
                            <input
                                type="date"
                                value={newRangeEnd}
                                onChange={(e) => setNewRangeEnd(e.target.value)}
                                className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={savingHighSeason}
                            onClick={addRange}
                            className="rounded-md bg-[#a81c24] px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Agregar rango
                        </button>
                    </div>
                    {rangeError && <p className="mt-2 text-xs text-red-600">{rangeError}</p>}
                </div>
            )}

            {canManageAreas && (
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Aviso de vacaciones sin fecha definir</p>
                    <p className="mt-1 mb-3 text-xs text-gray-500">
                        Un coordinador puede reservar solo el MES de una tanda de vacaciones (sin fechas exactas todavía). Cuántos meses antes de ese
                        mes se le avisa que ya debe definir las fechas.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        Meses de anticipación
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={vacationReminderMonths}
                            disabled={savingReminderMonths}
                            onChange={(e) => saveReminderMonths(Number(e.target.value))}
                            className="mt-1 block w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                        />
                    </label>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {areas.map((area) => (
                    <Link
                        key={area.id}
                        href={route('areas.show', area.id)}
                        className="rounded-xl border border-[#a81c24] bg-white p-6 shadow transition hover:shadow-md"
                    >
                        <h3 className="text-lg font-bold">{area.nombre}</h3>

                        <p className="mt-1 text-sm text-gray-500">{area.descripcion || 'Sin descripción'}</p>

                        <div className="mt-6 grid grid-cols-3 text-center">
                            <div>
                                <p className="text-xl font-bold">{area.total}</p>
                                <span className="text-xs text-gray-500">Total</span>
                            </div>

                            <div className="text-green-600">
                                <p className="text-xl font-bold">{area.activos}</p>
                                <span className="text-xs">Activos</span>
                            </div>

                            <div className="text-red-600">
                                <p className="text-xl font-bold">{area.inactivos}</p>
                                <span className="text-xs">Inactivos</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <CreateAreaModal show={showCreate} eligibleEmployees={eligibleEmployees} onClose={() => setShowCreate(false)} />
        </div>
    );
}
