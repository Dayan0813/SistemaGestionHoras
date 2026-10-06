import ConfirmModal from '@/Components/confirmModal';
import MainLayout from '@/Layouts/MainLayout';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { CalendarDays, ChevronLeft, ChevronRight, DoorClosed, Eraser, Flame, Pencil, Plus, Save, Trash2, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { colombianHolidayName } from './Programations/colombianHolidays';

interface DayType {
    id: number;
    name: string;
    color: string;
    sort_order: number;
    // Los días con este tipo cuentan como temporada alta: el parque abre aunque sea lunes o
    // martes (horario normal) y se avisa en vacaciones — reemplaza los rangos de "Por Áreas".
    is_high_season: boolean;
}

interface Props {
    dayTypes: DayType[];
    areas: { id: number; nombre: string }[];
    staffing: { area_id: number; day_type_id: number; min_staff: number }[];
    // Hora de salida de las áreas fijas los días de parque cerrado (isoWeekday => 'HH:MM').
    closedDayExitTimes: Record<number, string>;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const staffingKey = (areaId: number, dayTypeId: number) => `${areaId}-${dayTypeId}`;

// Calendario operativo del parque (solo administrador): tipos de día, el tipo de cada fecha del
// mes y el personal mínimo por área según el tipo. Lo que se guarda aquí lo exige
// WeeklyStaffingValidator al subir cualquier programación.
export default function OperatingCalendar({ dayTypes, areas, staffing, closedDayExitTimes }: Props) {
    // ---------------------------------------------------------------- Tipos de día
    const [typeForm, setTypeForm] = useState<{ id: number | null; name: string; color: string; sort_order: number; is_high_season: boolean } | null>(
        null,
    );
    const [deletingType, setDeletingType] = useState<DayType | null>(null);
    const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});

    const submitType = (event: React.FormEvent) => {
        event.preventDefault();
        if (!typeForm) return;
        const data = { name: typeForm.name, color: typeForm.color, sort_order: typeForm.sort_order, is_high_season: typeForm.is_high_season };
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setTypeForm(null);
                setTypeErrors({});
            },
            onError: (errors: Record<string, string>) => setTypeErrors(errors),
        };
        if (typeForm.id) router.put(route('operatingCalendar.updateType', typeForm.id), data, options);
        else router.post(route('operatingCalendar.storeType'), data, options);
    };

    // ---------------------------------------------------------------- Calendario del mes
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    // Fecha => id del tipo (null = sin tipo). savedDays es lo que hay en el servidor.
    const [days, setDays] = useState<Record<string, number | null>>({});
    const [savedDays, setSavedDays] = useState<Record<string, number | null>>({});
    const [brush, setBrush] = useState<number | null>(dayTypes[0]?.id ?? null);
    const [painting, setPainting] = useState(false);
    const [savingMonth, setSavingMonth] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7; // lunes = 0
    const typeById = useMemo(() => new Map(dayTypes.map((t) => [t.id, t])), [dayTypes]);
    const isDirty = useMemo(
        () => Object.keys({ ...days, ...savedDays }).some((date) => (days[date] ?? null) !== (savedDays[date] ?? null)),
        [days, savedDays],
    );

    const loadMonth = useCallback(async () => {
        const res = await axios.get(route('operatingCalendar.days'), {
            params: { from: isoOf(year, month, 1), to: isoOf(year, month, new Date(year, month, 0).getDate()) },
        });
        const loaded: Record<string, number | null> = {};
        Object.entries(res.data as Record<string, { id: number }>).forEach(([date, type]) => (loaded[date] = type.id));
        setDays(loaded);
        setSavedDays(loaded);
    }, [year, month]);

    useEffect(() => {
        loadMonth();
    }, [loadMonth]);

    useEffect(() => {
        const stop = () => setPainting(false);
        window.addEventListener('mouseup', stop);
        return () => window.removeEventListener('mouseup', stop);
    }, []);

    const paint = (date: string) => setDays((current) => ({ ...current, [date]: brush }));

    const changeMonth = (delta: number) => {
        if (isDirty && !window.confirm('Hay cambios sin guardar en este mes. ¿Salir sin guardarlos?')) return;
        const next = new Date(year, month - 1 + delta, 1);
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
    };

    const fillEmptyDays = () =>
        setDays((current) => {
            const next = { ...current };
            for (let d = 1; d <= daysInMonth; d++) {
                const date = isoOf(year, month, d);
                if (next[date] == null) next[date] = brush;
            }
            return next;
        });

    const saveMonth = () => {
        const payload: Record<string, number | null> = {};
        for (let d = 1; d <= daysInMonth; d++) {
            const date = isoOf(year, month, d);
            payload[date] = days[date] ?? null;
        }
        setSavingMonth(true);
        router.put(
            route('operatingCalendar.saveMonth'),
            { year, month, days: payload },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setSavedDays(days);
                    setNotice('Calendario del mes guardado.');
                },
                onFinish: () => setSavingMonth(false),
            },
        );
    };

    const monthCounts = useMemo(() => {
        const counts = new Map<number, number>();
        for (let d = 1; d <= daysInMonth; d++) {
            const typeId = days[isoOf(year, month, d)];
            if (typeId != null) counts.set(typeId, (counts.get(typeId) ?? 0) + 1);
        }
        return counts;
    }, [days, year, month, daysInMonth]);

    // ---------------------------------------------------------------- Parque cerrado
    const [exitMonday, setExitMonday] = useState(closedDayExitTimes[1] ?? '13:00');
    const [exitTuesday, setExitTuesday] = useState(closedDayExitTimes[2] ?? '16:00');
    const [savingExitTimes, setSavingExitTimes] = useState(false);

    const saveExitTimes = () => {
        setSavingExitTimes(true);
        router.put(
            route('operatingCalendar.saveClosedDayExitTimes'),
            { monday: exitMonday, tuesday: exitTuesday },
            {
                preserveScroll: true,
                onSuccess: () => setNotice('Horas de salida guardadas.'),
                onFinish: () => setSavingExitTimes(false),
            },
        );
    };

    // ---------------------------------------------------------------- Personal mínimo
    const initialStaffing = useMemo(() => {
        const map: Record<string, string> = {};
        staffing.forEach((s) => (map[staffingKey(s.area_id, s.day_type_id)] = String(s.min_staff)));
        return map;
    }, [staffing]);
    const [staffingValues, setStaffingValues] = useState<Record<string, string>>(initialStaffing);
    useEffect(() => setStaffingValues(initialStaffing), [initialStaffing]);
    const [savingStaffing, setSavingStaffing] = useState(false);

    const saveStaffing = () => {
        const rows = areas.flatMap((area) =>
            dayTypes.map((type) => {
                const raw = staffingValues[staffingKey(area.id, type.id)] ?? '';
                return { area_id: area.id, day_type_id: type.id, min_staff: raw === '' ? null : Number(raw) };
            }),
        );
        setSavingStaffing(true);
        router.put(
            route('operatingCalendar.saveStaffing'),
            { staffing: rows },
            {
                preserveScroll: true,
                onSuccess: () => setNotice('Personal mínimo guardado.'),
                onFinish: () => setSavingStaffing(false),
            },
        );
    };

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 3000);
        return () => clearTimeout(timer);
    }, [notice]);

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
            <header>
                <h1 className="text-2xl font-semibold text-[#a81c24]">Calendario operativo</h1>
                <p className="mt-1 max-w-3xl text-sm text-gray-600">
                    Define qué tipo de día es cada fecha (por ejemplo A, B, C) y cuántas personas necesita cada área en cada tipo. Al subir una
                    programación, los días que queden por debajo del mínimo se bloquean. Los tipos marcados como{' '}
                    <span className="font-semibold text-orange-700">temporada alta</span> definen la temporada alta de toda la empresa.
                </p>
            </header>

            {notice && (
                <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-[#95c020] px-4 py-2.5 text-sm font-semibold text-white shadow-lg">{notice}</div>
            )}

            {/* ---------------------------------------------------- Tipos de día */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">Tipos de día</h2>
                    <button
                        onClick={() => {
                            setTypeErrors({});
                            setTypeForm({ id: null, name: '', color: '#95c020', sort_order: dayTypes.length + 1, is_high_season: false });
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-[#95c020] px-3 py-1.5 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <Plus size={14} /> Nuevo tipo
                    </button>
                </div>

                {dayTypes.length === 0 && !typeForm && (
                    <p className="text-sm text-gray-500">Todavía no hay tipos de día. Crea el primero (por ejemplo "A" para los días de menos público).</p>
                )}

                <div className="flex flex-wrap gap-2">
                    {dayTypes.map((type) => (
                        <div key={type.id} className="flex items-center gap-2 rounded-xl border border-gray-200 py-1.5 pr-1.5 pl-2">
                            <span className="rounded-md px-2 py-0.5 text-sm font-bold text-white" style={{ backgroundColor: type.color }}>
                                {type.name}
                            </span>
                            {type.is_high_season && (
                                <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                    <Flame size={11} /> Temporada alta
                                </span>
                            )}
                            <button
                                title="Editar"
                                onClick={() => {
                                    setTypeErrors({});
                                    setTypeForm({
                                        id: type.id,
                                        name: type.name,
                                        color: type.color,
                                        sort_order: type.sort_order,
                                        is_high_season: type.is_high_season,
                                    });
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                title="Eliminar"
                                onClick={() => setDeletingType(type)}
                                className="rounded p-1 text-gray-400 hover:bg-[#fdf0f0] hover:text-[#a81c24]"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {typeForm && (
                    <form onSubmit={submitType} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-4">
                        <label className="text-xs font-semibold text-gray-500">
                            Nombre
                            <input
                                autoFocus
                                value={typeForm.name}
                                maxLength={30}
                                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                                placeholder="Ej. B"
                                className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                            />
                        </label>
                        <label className="text-xs font-semibold text-gray-500">
                            Color
                            <input
                                type="color"
                                value={typeForm.color}
                                onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                                className="mt-1 block h-[34px] w-16 cursor-pointer rounded-md border border-gray-300 bg-white"
                            />
                        </label>
                        <label className="text-xs font-semibold text-gray-500">
                            Orden
                            <input
                                type="number"
                                min={0}
                                value={typeForm.sort_order}
                                onChange={(e) => setTypeForm({ ...typeForm, sort_order: Number(e.target.value) })}
                                className="mt-1 block w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                            />
                        </label>
                        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-gray-600" title="Lunes y martes cuentan horas completas en áreas fijas">
                            <input
                                type="checkbox"
                                checked={typeForm.is_high_season}
                                onChange={(e) => setTypeForm({ ...typeForm, is_high_season: e.target.checked })}
                            />
                            <Flame size={13} className="text-orange-600" /> Temporada alta
                        </label>
                        <button type="submit" className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#c9252d]">
                            {typeForm.id ? 'Guardar cambios' : 'Crear tipo'}
                        </button>
                        <button type="button" onClick={() => setTypeForm(null)} className="px-2 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800">
                            Cancelar
                        </button>
                        {Object.values(typeErrors).length > 0 && <p className="w-full text-xs text-[#a81c24]">{Object.values(typeErrors).join(' ')}</p>}
                    </form>
                )}
            </section>

            {/* ---------------------------------------------------- Parque cerrado */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <DoorClosed size={18} className="text-[#a81c24]" /> Parque cerrado
                </h2>
                <p className="mt-1 mb-4 max-w-3xl text-xs text-gray-500">
                    El parque cierra los <strong>lunes y martes</strong>, salvo en temporada alta (los días cuyo tipo está marcado con{' '}
                    <Flame size={11} className="inline text-orange-600" /> temporada alta). Esos días las áreas de jornada fija salen a la hora
                    indicada abajo y las áreas variables (Operaciones) descansan: no se les puede programar turno.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                    <label className="text-xs font-semibold text-gray-500">
                        Salida los lunes
                        <input
                            type="time"
                            value={exitMonday}
                            onChange={(e) => setExitMonday(e.target.value)}
                            className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                        />
                    </label>
                    <label className="text-xs font-semibold text-gray-500">
                        Salida los martes
                        <input
                            type="time"
                            value={exitTuesday}
                            onChange={(e) => setExitTuesday(e.target.value)}
                            className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
                        />
                    </label>
                    <button
                        onClick={saveExitTimes}
                        disabled={savingExitTimes || !exitMonday || !exitTuesday}
                        className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                    >
                        <Save size={14} /> {savingExitTimes ? 'Guardando…' : 'Guardar horas'}
                    </button>
                </div>
            </section>

            {/* ---------------------------------------------------- Calendario del mes */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <CalendarDays size={18} className="text-[#a81c24]" /> Tipo de cada día
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => changeMonth(-1)} className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50" title="Mes anterior">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="w-40 text-center text-sm font-semibold text-gray-800 capitalize">{monthLabel}</span>
                        <button onClick={() => changeMonth(1)} className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50" title="Mes siguiente">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {dayTypes.length === 0 ? (
                    <p className="text-sm text-gray-500">Crea al menos un tipo de día para poder pintar el calendario.</p>
                ) : (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Pintar con:</span>
                            {dayTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setBrush(type.id)}
                                    className={`rounded-md px-3 py-1 text-sm font-bold text-white transition ${
                                        brush === type.id ? 'ring-2 ring-gray-800 ring-offset-2' : 'opacity-70 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: type.color }}
                                >
                                    {type.name}
                                    {monthCounts.get(type.id) ? <span className="ml-1.5 text-[11px] font-medium opacity-90">({monthCounts.get(type.id)})</span> : null}
                                </button>
                            ))}
                            <button
                                onClick={() => setBrush(null)}
                                className={`flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-600 ${
                                    brush === null ? 'ring-2 ring-gray-800 ring-offset-2' : 'hover:bg-gray-50'
                                }`}
                            >
                                <Eraser size={14} /> Quitar
                            </button>
                            <button onClick={fillEmptyDays} className="ml-auto text-xs font-semibold text-[#5e7a15] hover:underline">
                                Rellenar días vacíos con el seleccionado
                            </button>
                        </div>

                        <p className="mb-3 text-xs text-gray-500">Haz clic en un día o arrastra sobre varios para asignarles el tipo seleccionado.</p>

                        <div className="grid grid-cols-7 gap-1.5 select-none" onMouseLeave={() => setPainting(false)}>
                            {WEEKDAYS.map((weekday) => (
                                <div key={weekday} className="pb-1 text-center text-[11px] font-bold tracking-wide text-gray-400 uppercase">
                                    {weekday}
                                </div>
                            ))}
                            {Array.from({ length: leadingBlanks }, (_, i) => (
                                <div key={`blank-${i}`} />
                            ))}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const day = i + 1;
                                const date = isoOf(year, month, day);
                                const type = days[date] != null ? typeById.get(days[date] as number) : undefined;
                                const holiday = colombianHolidayName(date);
                                const changed = (days[date] ?? null) !== (savedDays[date] ?? null);
                                return (
                                    <div
                                        key={date}
                                        onMouseDown={() => {
                                            setPainting(true);
                                            paint(date);
                                        }}
                                        onMouseEnter={() => painting && paint(date)}
                                        title={holiday ?? undefined}
                                        className={`relative flex h-20 cursor-pointer flex-col justify-between rounded-lg border p-2 transition ${
                                            type ? 'border-transparent text-white' : 'border-dashed border-gray-300 text-gray-500 hover:bg-gray-50'
                                        }`}
                                        style={type ? { backgroundColor: type.color } : undefined}
                                    >
                                        <div className="flex items-start justify-between">
                                            <span className="flex items-center gap-1 text-sm font-semibold">
                                                {day}
                                                {type?.is_high_season && <Flame size={12} aria-label="Temporada alta" />}
                                            </span>
                                            {changed && <span className="h-2 w-2 rounded-full bg-white ring-2 ring-[#a81c24]" title="Sin guardar" />}
                                        </div>
                                        <div className="flex items-end justify-between gap-1">
                                            <span className="text-lg leading-none font-black">{type?.name ?? ''}</span>
                                            {holiday && <span className="truncate text-[10px] font-semibold opacity-80">Festivo</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-3">
                            {isDirty && <span className="text-xs font-semibold text-[#a81c24]">Hay cambios sin guardar</span>}
                            <button
                                onClick={() => setDays(savedDays)}
                                disabled={!isDirty || savingMonth}
                                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Deshacer
                            </button>
                            <button
                                onClick={saveMonth}
                                disabled={!isDirty || savingMonth}
                                className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                            >
                                <Save size={14} /> {savingMonth ? 'Guardando…' : 'Guardar mes'}
                            </button>
                        </div>
                    </>
                )}
            </section>

            {/* ---------------------------------------------------- Personal mínimo */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Users size={18} className="text-[#a81c24]" /> Personal mínimo por área
                </h2>
                <p className="mt-1 mb-4 text-xs text-gray-500">
                    Cuántas personas deben estar programadas como mínimo en cada área según el tipo de día. Vacío = sin mínimo.
                </p>

                {dayTypes.length === 0 ? (
                    <p className="text-sm text-gray-500">Crea los tipos de día primero.</p>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold tracking-wide text-gray-500 uppercase">Área</th>
                                        {dayTypes.map((type) => (
                                            <th key={type.id} className="px-3 py-3 text-center">
                                                <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: type.color }}>
                                                    {type.name}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {areas.map((area) => (
                                        <tr key={area.id} className="border-t border-gray-100">
                                            <td className="px-4 py-2 font-medium text-gray-800">{area.nombre}</td>
                                            {dayTypes.map((type) => {
                                                const key = staffingKey(area.id, type.id);
                                                return (
                                                    <td key={type.id} className="px-3 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={staffingValues[key] ?? ''}
                                                            onChange={(e) => setStaffingValues((current) => ({ ...current, [key]: e.target.value }))}
                                                            placeholder="—"
                                                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm text-gray-800"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={saveStaffing}
                                disabled={savingStaffing}
                                className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                            >
                                <Save size={14} /> {savingStaffing ? 'Guardando…' : 'Guardar personal mínimo'}
                            </button>
                        </div>
                    </>
                )}
            </section>

            <ConfirmModal
                show={deletingType !== null}
                variant="danger"
                title={`Eliminar el tipo "${deletingType?.name ?? ''}"`}
                message="Los días que tenían este tipo quedarán sin tipo y se borrará su personal mínimo en todas las áreas."
                confirmLabel="Eliminar"
                onConfirm={() => {
                    if (!deletingType) return;
                    router.delete(route('operatingCalendar.destroyType', deletingType.id), {
                        preserveScroll: true,
                        onSuccess: () => loadMonth(),
                    });
                    setDeletingType(null);
                }}
                onClose={() => setDeletingType(null)}
            />
        </div>
    );
}

OperatingCalendar.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="servicios">{page}</MainLayout>;
