import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Check, ChevronLeft, ChevronRight, Edit3, Search, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
}
interface Employee {
    uid: string;
    name: string;
    estado: string;
    cargo?: { name: string } | null;
    contrato?: { name: string } | null;
}
interface ProgramationOverride {
    id: number;
    date: string;
    calendar: Calendar;
}
interface Programation {
    id: number;
    calendar_id: number;
    status: string;
    start_date: string;
    end_date: string;
    calendar: Calendar;
    overrides: ProgramationOverride[];
}
interface EmployeeSchedule {
    uid: string;
    programations: Programation[];
}

const durationOptions = [
    { days: 7, label: '1 semana' },
    { days: 15, label: '15 días' },
    { days: 30, label: '1 mes' },
    { days: 60, label: '2 meses' },
];

const toDate = (value: string) => new Date(`${value}T00:00:00`);
const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
const formatDay = (value: Date) => value.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
const formatRangeLabel = (datesInRange: Date[]) => {
    const first = datesInRange[0];
    const last = datesInRange[datesInRange.length - 1];
    return `${first.toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })} – ${last.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`;
};
const monthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
const monthCalendar = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const totalDays = new Date(year, month, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    return [...Array(blanks).fill(null), ...Array.from({ length: totalDays }, (_, index) => new Date(year, month - 1, index + 1))];
};

// Agrupa fechas ISO sueltas en bloques de días consecutivos (el backend solo acepta un rango continuo por petición).
const toContiguousRanges = (isoDates: string[]) => {
    const sorted = [...isoDates].sort();
    const ranges: { start: string; end: string }[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const expectedNext = toDate(prev);
        expectedNext.setDate(expectedNext.getDate() + 1);
        if (current === toIsoDate(expectedNext)) {
            prev = current;
            continue;
        }
        ranges.push({ start, end: prev });
        start = current;
        prev = current;
    }
    ranges.push({ start, end: prev });
    return ranges;
};

// Misma comparación por string ISO (recortado a 10 caracteres) que usa DetailsProgramations.tsx,
// para evitar el corrimiento de día por timezone al re-parsear fechas del backend.
const getProgramationForDay = (schedule: EmployeeSchedule | undefined, dayISO: string) =>
    schedule?.programations.find((p) => dayISO >= p.start_date.slice(0, 10) && dayISO <= p.end_date.slice(0, 10)) ?? null;
const getCalendarForDay = (programation: Programation, dayISO: string) =>
    programation.overrides?.find((o) => o.date.slice(0, 10) === dayISO)?.calendar ?? programation.calendar;

const formatHours = (calendar: Calendar) =>
    calendar.hora_entrada && calendar.hora_salida ? `${calendar.hora_entrada.slice(0, 5)} – ${calendar.hora_salida.slice(0, 5)}` : 'Horario no definido';
const shiftColor = (type: 'D' | 'N') =>
    type === 'D'
        ? { badge: 'bg-[#95c020]', text: 'text-[#5e7a15]', soft: 'bg-[#eaf3d3]', softText: 'text-[#5e7a15]', border: 'border-[#95c020]', dot: 'bg-[#95c020]' }
        : { badge: 'bg-blue-700', text: 'text-blue-700', soft: 'bg-blue-50', softText: 'text-blue-700', border: 'border-blue-700', dot: 'bg-blue-700' };
const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();

export default function Programaciones() {
    const { auth } = usePage().props as any;
    const areaId: number | null = auth?.user?.area_id ?? null;
    const areaName: string = auth?.user?.area_name ?? 'Sin área asignada';

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [employeesList, setEmployeesList] = useState<Employee[]>([]);
    const [scheduleByEmployee, setScheduleByEmployee] = useState<Record<string, EmployeeSchedule>>({});
    const [shiftId, setShiftId] = useState<number | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<number | null>(null);
    const [toast, setToast] = useState('');
    const [duration, setDuration] = useState(7);
    const [startDate, setStartDate] = useState(toIsoDate(new Date()));
    const [weekIndex, setWeekIndex] = useState(0);
    const [savingProgress, setSavingProgress] = useState<{ done: number; total: number } | null>(null);

    const rangeDates = useMemo(
        () =>
            Array.from({ length: duration }, (_, index) => {
                const date = toDate(startDate);
                date.setDate(date.getDate() + index);
                return date;
            }),
        [duration, startDate],
    );
    const visibleDates = rangeDates.slice(weekIndex * 7, weekIndex * 7 + 7);
    const totalWeeks = Math.ceil(duration / 7);
    const calendarMonths = useMemo(() => [...new Set(rangeDates.map(monthKey))], [rangeDates]);
    const shift = calendars.find((c) => c.id === shiftId) ?? null;

    const notify = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 3000);
    };

    useEffect(() => {
        if (!areaId) return;
        axios.get(route('calendars.byArea', areaId)).then((res) => {
            const catalog: Calendar[] = res.data.filter((c: Calendar) => !c.is_custom);
            setCalendars(catalog);
            setShiftId((current) => current ?? catalog[0]?.id ?? null);
        });
        axios.get(route('programations.employees'), { params: { area_id: areaId } }).then((res) => {
            setEmployeesList(res.data.filter((e: Employee) => e.estado === 'Activo'));
        });
    }, [areaId]);

    const fetchSchedule = useMemo(
        () => () => {
            if (!areaId) return;
            const months = new Map<string, { year: number; month: number }>();
            const addMonth = (date: Date) => {
                const key = monthKey(date);
                if (!months.has(key)) months.set(key, { year: date.getFullYear(), month: date.getMonth() + 1 });
            };
            visibleDates.forEach(addMonth);
            addMonth(new Date());
            Promise.all(
                [...months.values()].map(({ year, month }) =>
                    axios.get(route('programations.dinamicDetails', areaId), { params: { year, month } }).then((res) => res.data),
                ),
            ).then((results: EmployeeSchedule[][]) => {
                const merged: Record<string, EmployeeSchedule> = {};
                results.flat().forEach((employeeSchedule) => {
                    const existing = merged[employeeSchedule.uid];
                    merged[employeeSchedule.uid] = existing
                        ? { uid: employeeSchedule.uid, programations: [...existing.programations, ...employeeSchedule.programations] }
                        : employeeSchedule;
                });
                setScheduleByEmployee(merged);
            });
        },
        [areaId, visibleDates],
    );

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const todayISO = toIsoDate(new Date());
    const currentCalendarFor = useCallback(
        (uid: string): Calendar | null => {
            const programation = getProgramationForDay(scheduleByEmployee[uid], todayISO);
            return programation ? getCalendarForDay(programation, todayISO) : null;
        },
        [scheduleByEmployee, todayISO],
    );

    const employees = useMemo(
        () =>
            employeesList.filter((e) => {
                const current = currentCalendarFor(e.uid);
                const matchesFilter = filter === 'all' || (filter === 'none' ? !current : current?.id === Number(filter));
                return matchesFilter && e.name.toLowerCase().includes(search.toLowerCase());
            }),
        [employeesList, filter, search, currentCalendarFor],
    );

    const toggle = (uid: string) => setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

    const assign = () => {
        if (!selected.length || !selectedDates.length || !shiftId || !areaId) return;
        const ranges = toContiguousRanges(selectedDates);
        setSavingProgress({ done: 0, total: ranges.length });
        const sendNext = (index: number) => {
            if (index >= ranges.length) {
                setSavingProgress(null);
                notify(`Turno asignado correctamente (${ranges.length} bloque${ranges.length > 1 ? 's' : ''})`);
                setSelectedDates([]);
                fetchSchedule();
                return;
            }
            const currentRange = ranges[index];
            router.post(
                route('programationsStore'),
                { area_id: areaId, calendar_id: shiftId, start_date: currentRange.start, end_date: currentRange.end, employees: selected },
                {
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: () => {
                        setSavingProgress({ done: index + 1, total: ranges.length });
                        sendNext(index + 1);
                    },
                    onError: () => {
                        setSavingProgress(null);
                        notify('Ocurrió un error al asignar el turno');
                    },
                },
            );
        };
        sendNext(0);
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editing) return;
        const form = new FormData(event.currentTarget);
        const current = calendars.find((c) => c.id === editing);
        if (!current) return;
        try {
            const res = await axios.put(route('calendars.update', editing), {
                hora_entrada: String(form.get('start')),
                hora_salida: String(form.get('end')),
                shift_type: current.shift_type,
            });
            setCalendars((cs) => cs.map((c) => (c.id === editing ? res.data : c)));
            notify('Horario del turno actualizado');
        } catch (err: any) {
            notify(err?.response?.data?.message ?? 'No se pudo actualizar el turno');
        }
        setEditing(null);
    };

    if (!areaId) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                <p className="text-lg font-semibold text-gray-800">No tienes un área asignada</p>
                <p className="mt-2 text-sm text-gray-500">Contacta a un administrador para que te asocie a un área y puedas programar turnos.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Planificación semanal</p>
                    <h1 className="text-2xl font-semibold text-[#a81c24]">Programación por turnos</h1>
                    <div className="mt-4 flex items-center gap-3 text-sm text-gray-800">
                        <button
                            disabled={weekIndex === 0}
                            onClick={() => setWeekIndex((index) => Math.max(index - 1, 0))}
                            className="flex h-8 w-8 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a81c24]"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <strong>{formatRangeLabel(visibleDates)}</strong>
                        <button
                            disabled={weekIndex === totalWeeks - 1}
                            onClick={() => setWeekIndex((index) => Math.min(index + 1, totalWeeks - 1))}
                            className="flex h-8 w-8 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a81c24]"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
                <div className="w-full max-w-xs rounded-xl border border-[#a81c24] bg-white p-4 shadow-sm sm:w-72">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Área asignada</p>
                    <strong className="block text-sm text-gray-900">{areaName}</strong>
                    <label className="mt-3 block text-xs font-semibold text-gray-500">
                        Desde
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => {
                                setStartDate(event.target.value);
                                setWeekIndex(0);
                            }}
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        />
                    </label>
                    <label className="mt-3 block text-xs font-semibold text-gray-500">
                        Duración
                        <select
                            value={duration}
                            onChange={(event) => {
                                setDuration(Number(event.target.value));
                                setWeekIndex(0);
                                setSelectedDates([]);
                            }}
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        >
                            {durationOptions.map((option) => (
                                <option key={option.days} value={option.days}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </header>

            <div className="flex items-center gap-3 rounded-lg border-l-4 border-[#95c020] bg-[#eaf3d3] px-4 py-3 text-sm text-[#3f5510]">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-[#95c020] text-[11px] font-bold">
                    i
                </span>
                <p className="m-0">
                    Los turnos y horarios disponibles pertenecen exclusivamente a <strong>{areaName}</strong>.
                </p>
            </div>

            <section>
                <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">01</span>
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Primer paso</p>
                        <h2 className="text-lg font-semibold text-gray-900">Elige el turno</h2>
                    </div>
                </div>
                {calendars.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                        No hay turnos configurados para esta área.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {calendars.map((item) => {
                            const color = shiftColor(item.shift_type);
                            const selected = shiftId === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setShiftId(item.id)}
                                    className={`relative flex items-center gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                        selected ? `border-2 ${color.border}` : 'border-gray-200'
                                    }`}
                                >
                                    <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg text-lg font-semibold text-white ${color.badge}`}>
                                        {item.shift_type}
                                    </span>
                                    <span className="flex-1">
                                        <strong className="block text-sm text-gray-900">{item.shift_type === 'D' ? 'Turno Diurno' : 'Turno Nocturno'}</strong>
                                        <b className={`block font-mono text-xs ${color.text}`}>{formatHours(item)}</b>
                                    </span>
                                    <Edit3
                                        size={16}
                                        className="flex-none text-gray-400 hover:text-gray-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditing(item.id);
                                        }}
                                    />
                                    {selected && (
                                        <span className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full text-white ${color.badge}`}>
                                            <Check size={13} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">02</span>
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Segundo paso</p>
                        <h2 className="text-lg font-semibold text-gray-900">Elige los empleados</h2>
                    </div>
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
                        <Users size={15} /> {selected.length} seleccionados
                    </span>
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                filter === 'all' ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Todos <b className="ml-1 font-mono">{employeesList.length}</b>
                        </button>
                        {calendars.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setFilter(String(item.id))}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                    filter === String(item.id) ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {item.shift_type === 'D' ? 'Diurno' : 'Nocturno'} ({formatHours(item)}){' '}
                                <b className="ml-1 font-mono">{employeesList.filter((e) => currentCalendarFor(e.uid)?.id === item.id).length}</b>
                            </button>
                        ))}
                        <button
                            onClick={() => setFilter('none')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                filter === 'none' ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Sin asignar <b className="ml-1 font-mono">{employeesList.filter((e) => !currentCalendarFor(e.uid)).length}</b>
                        </button>
                    </div>
                    <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-gray-500 focus-within:border-[#a81c24]">
                        <Search size={15} />
                        <input
                            placeholder="Buscar empleado..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-48 border-0 bg-transparent text-xs text-gray-700 outline-none"
                        />
                    </label>
                </div>
                {employeesList.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                        No hay empleados activos en esta área.
                    </p>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                        {employees.map((e) => {
                            const current = currentCalendarFor(e.uid);
                            const color = current ? shiftColor(current.shift_type) : null;
                            return (
                                <button
                                    key={e.uid}
                                    onClick={() => toggle(e.uid)}
                                    className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 ${
                                        selected.includes(e.uid) ? 'bg-green-50' : ''
                                    }`}
                                >
                                    <span
                                        className={`flex h-5 w-5 flex-none items-center justify-center rounded border text-white ${
                                            selected.includes(e.uid) ? 'border-[#95c020] bg-[#95c020]' : 'border-gray-300 bg-white'
                                        }`}
                                    >
                                        {selected.includes(e.uid) && <Check size={13} />}
                                    </span>
                                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                                        {initials(e.name)}
                                    </span>
                                    <span className="flex-1">
                                        <strong className="block text-sm text-gray-900">{e.name}</strong>
                                        <small className="block text-xs text-gray-500">{e.cargo?.name ?? e.contrato?.name ?? e.uid}</small>
                                    </span>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${current && color ? `${color.soft} ${color.softText}` : 'bg-gray-100 text-gray-500'}`}
                                    >
                                        {current ? (current.shift_type === 'D' ? 'Diurno' : 'Nocturno') : 'Sin asignar'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section>
                <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">03</span>
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Tercer paso</p>
                        <h2 className="text-lg font-semibold text-gray-900">Elige los días</h2>
                    </div>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                    Período seleccionado: <strong className="text-gray-800">{formatRangeLabel(rangeDates)}</strong> ·{' '}
                    {durationOptions.find((option) => option.days === duration)?.label}
                </p>
                <div className="flex flex-wrap gap-4">
                    {calendarMonths.map((month) => (
                        <div key={month} className="w-[280px] rounded-xl border border-gray-200 bg-white p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 capitalize">
                                {toDate(`${month}-01`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                            </h3>
                            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400">
                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                                    <span key={`${day}-${index}`}>{day}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {monthCalendar(month).map((date, index) => {
                                    if (!date) return <span key={`empty-${index}`} />;
                                    const iso = toIsoDate(date);
                                    const inRange = rangeDates.some((rangeDate) => toIsoDate(rangeDate) === iso);
                                    const isSelected = selectedDates.includes(iso);
                                    return (
                                        <button
                                            disabled={!inRange}
                                            key={iso}
                                            onClick={() =>
                                                setSelectedDates((current) => (current.includes(iso) ? current.filter((item) => item !== iso) : [...current, iso]))
                                            }
                                            className={`aspect-square rounded-md text-xs font-medium ${
                                                isSelected
                                                    ? 'bg-[#95c020] text-white'
                                                    : inRange
                                                      ? 'text-gray-700 hover:bg-[#eaf3d3]'
                                                      : 'cursor-not-allowed text-gray-300'
                                            }`}
                                        >
                                            {date.getDate()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#a81c24] px-5 py-3.5 text-white shadow-lg">
                <p className="m-0 text-sm">
                    {shift ? (
                        <>
                            Asignar <strong>{shift.shift_type === 'D' ? 'Turno Diurno' : 'Turno Nocturno'}</strong> ({formatHours(shift)}) a{' '}
                            <strong>{selected.length} empleados</strong> en <strong>{selectedDates.length} días</strong>
                        </>
                    ) : (
                        'Selecciona un turno para continuar'
                    )}
                </p>
                <button
                    disabled={!selected.length || !selectedDates.length || !shiftId || !!savingProgress}
                    onClick={assign}
                    className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-bold text-[#a81c24] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {savingProgress ? `Guardando ${savingProgress.done + 1}/${savingProgress.total}…` : 'Asignar turno'}
                    {!savingProgress && <ChevronRight size={16} />}
                </button>
            </div>

            <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Resultado en vivo</p>
                        <h2 className="text-lg font-semibold text-gray-900">Vista previa semanal</h2>
                    </div>
                    <span className="text-xs text-gray-500">{employeesList.length} empleados · 7 días</span>
                </div>
                <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] border-collapse">
                        <thead>
                            <tr>
                                <th className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Empleado
                                </th>
                                {visibleDates.map((date) => (
                                    <th
                                        key={toIsoDate(date)}
                                        className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-center text-[10px] font-bold text-gray-500 uppercase"
                                    >
                                        {date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                                        <small className="mt-1 block font-mono text-[9px] font-normal normal-case text-gray-400">
                                            {formatDay(date)}
                                        </small>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employeesList.map((e) => (
                                <tr key={e.uid}>
                                    <td className="flex items-center gap-2 border-b border-gray-100 px-3 py-3 text-left text-xs">
                                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gray-100 text-[8px] font-bold text-gray-600">
                                            {initials(e.name)}
                                        </span>
                                        <strong className="text-gray-900">{e.name}</strong>
                                    </td>
                                    {visibleDates.map((date) => {
                                        const dayISO = toIsoDate(date);
                                        const programation = getProgramationForDay(scheduleByEmployee[e.uid], dayISO);
                                        const cellCalendar = programation ? getCalendarForDay(programation, dayISO) : null;
                                        return (
                                            <td key={dayISO} className="border-b border-gray-100 px-2 py-3 text-center text-[10px]">
                                                {cellCalendar ? (
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded px-2 py-1.5 font-mono text-white ${shiftColor(cellCalendar.shift_type).badge}`}
                                                    >
                                                        <b className="font-sans text-xs font-semibold">{cellCalendar.shift_type}</b>
                                                        {formatHours(cellCalendar)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">Libre</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="font-bold text-gray-800">Leyenda</span>
                    {calendars.map((item) => (
                        <span key={item.id} className="flex items-center gap-1">
                            <i className={`inline-block h-2 w-2 rounded-full ${shiftColor(item.shift_type).dot}`} />{' '}
                            {item.shift_type === 'D' ? 'Diurno' : 'Nocturno'} <code className="font-mono text-gray-700">{formatHours(item)}</code>
                        </span>
                    ))}
                    <span className="flex items-center gap-1">
                        <i className="inline-block h-2 w-2 rounded-full bg-gray-300" /> Libre / sin asignar
                    </span>
                </div>
            </section>

            {editing !== null && (() => {
                const current = calendars.find((c) => c.id === editing);
                if (!current) return null;
                return (
                    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                        <form className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-xl" onSubmit={save}>
                            <button type="button" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={() => setEditing(null)}>
                                <X size={18} />
                            </button>
                            <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del turno</p>
                            <h2 className="text-xl font-semibold text-gray-900">Editar {current.shift_type === 'D' ? 'Turno Diurno' : 'Turno Nocturno'}</h2>
                            <p className="mt-1 mb-6 text-sm text-gray-500">Actualiza el horario y se reflejará en toda la programación.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-xs font-bold text-gray-600">
                                    Hora de inicio
                                    <input
                                        name="start"
                                        type="time"
                                        defaultValue={current.hora_entrada?.slice(0, 5) ?? ''}
                                        required
                                        className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                </label>
                                <label className="text-xs font-bold text-gray-600">
                                    Hora de fin
                                    <input
                                        name="end"
                                        type="time"
                                        defaultValue={current.hora_salida?.slice(0, 5) ?? ''}
                                        required
                                        className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                </label>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">Guardar cambios</button>
                            </div>
                        </form>
                    </div>
                );
            })()}
            {toast && (
                <div className="fixed right-6 bottom-6 z-30 flex items-center gap-2 rounded-lg bg-[#5e7a15] px-4 py-3 text-sm text-white shadow-lg">
                    <Check size={16} /> {toast}
                </div>
            )}
        </div>
    );
}
Programaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="programaciones">{page}</MainLayout>;
