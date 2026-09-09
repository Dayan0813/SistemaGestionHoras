import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { AlertTriangle, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    businessDaysInRange,
    endDateForBusinessDays,
    isBusinessDay,
    isHighSeasonDay,
    isReservationDue,
    type HighSeasonRange,
} from './vacationPlanning.helpers';

const TOTAL_VACATION_DAYS = 15;

interface PlannedAbsence {
    id: number;
    // null cuando es una reserva de mes sin fechas exactas todavía (ver planned_month).
    start_date: string | null;
    end_date: string | null;
    planned_month: string | null;
    days: number | null;
}

interface EmployeeRow {
    uid: string;
    name: string;
    contrato: { name: string } | null;
    dias_vacaciones_disponibles: number;
    area_id: number | null;
    absences: PlannedAbsence[];
}

interface CurrentProps {
    currentRouteName: string;
}

interface AreaOption {
    id: number;
    nombre: string;
}

// Shape real de las props que entrega la ruta "plan-vacaciones" (routes/web.php) — tipado
// explícito en vez de "usePage().props as any" para que un futuro cambio de nombre/forma de
// estas props lo detecte el compilador en vez de romperse en silencio en producción.
interface PlanVacacionesPageProps {
    employees: EmployeeRow[];
    highSeasonRanges: HighSeasonRange[];
    vacationReminderMonths: number | null;
    allAreas: AreaOption[] | null;
    selectedArea: number | null;
    auth?: {
        user?: {
            permissions?: string[];
            vacation_reminder_months?: number;
        } | null;
    };
}

interface Tanda {
    id: number;
    startDate: string;
    endDate: string;
}

let nextTandaId = 1;
const newTanda = (): Tanda => ({ id: nextTandaId++, startDate: '', endDate: '' });

// Laravel serializa start_date/end_date (cast 'date') como datetime ISO completo
// ("2026-01-12T00:00:00.000000Z"), no como solo "YYYY-MM-DD" — se toma únicamente la parte de
// fecha para evitar corrimientos de zona horaria (mismo criterio que Ausencias.tsx).
const formatIsoDate = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

const formatMonth = (yyyyMm: string) =>
    new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

const WEEKDAY_SHORT = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
const todayIso = () => new Date().toISOString().slice(0, 10);

const shiftMonth = (monthIso: string, delta: number) => {
    const [y, m] = monthIso.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Selector de mes propio — reemplaza el <input type="month"> nativo del navegador (picker gris
// del sistema operativo, fuera de la paleta de la app) por un botón que abre un popover con
// año navegable y una grilla de 12 meses, en la misma línea visual que RangeCalendar.
const MonthPicker = ({ value, onChange }: { value: string; onChange: (monthIso: string) => void }) => {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => Number((value || todayIso()).slice(0, 4)));
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value) setViewYear(Number(value.slice(0, 4)));
    }, [value]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const selectedYear = value ? Number(value.slice(0, 4)) : null;
    const selectedMonth = value ? Number(value.slice(5, 7)) : null;

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
            >
                <span className={value ? 'capitalize text-gray-800' : 'text-gray-400'}>{value ? formatMonth(value) : 'Elige un mes'}</span>
                <CalendarCheck size={16} className="text-gray-400" />
            </button>

            {open && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y - 1)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold text-gray-800">{viewYear}</span>
                        <button
                            type="button"
                            onClick={() => setViewYear((y) => y + 1)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {MONTH_SHORT.map((label, i) => {
                            const monthNum = i + 1;
                            const isSelected = selectedYear === viewYear && selectedMonth === monthNum;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                        onChange(`${viewYear}-${String(monthNum).padStart(2, '0')}`);
                                        setOpen(false);
                                    }}
                                    className={`rounded-lg py-2 text-xs font-semibold capitalize transition-colors ${
                                        isSelected ? 'bg-[#a81c24] text-white' : 'text-gray-700 hover:bg-[#a81c24]/10 hover:text-[#a81c24]'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const RangeCalendar = ({
    monthIso,
    startDate,
    endDate,
    onPick,
    onMonthChange,
}: {
    monthIso: string;
    startDate: string;
    endDate: string;
    onPick: (startDate: string, endDate: string) => void;
    // Si se pasa, muestra flechas para navegar de mes (modal de edición, sin mes fijo del paso
    // 1); si se omite, el calendario queda fijo al mes elegido (modal de creación).
    onMonthChange?: (nextMonthIso: string) => void;
}) => {
    const [year, month] = monthIso.split('-').map(Number);
    const firstOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();

    const cells: (string | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return `${monthIso}-${String(day).padStart(2, '0')}`;
    })];

    const handleClick = (iso: string) => {
        if (!startDate || (startDate && endDate)) {
            onPick(iso, '');
        } else if (iso < startDate) {
            onPick(iso, startDate);
        } else {
            onPick(startDate, iso);
        }
    };

    const today = todayIso();

    return (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
            {onMonthChange && (
                <div className="mb-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => onMonthChange(shiftMonth(monthIso, -1))}
                        className="rounded px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100"
                    >
                        ‹
                    </button>
                    <span className="text-xs font-semibold text-gray-700 capitalize">{formatMonth(monthIso)}</span>
                    <button
                        type="button"
                        onClick={() => onMonthChange(shiftMonth(monthIso, 1))}
                        className="rounded px-2 py-1 text-xs font-bold text-gray-500 hover:bg-gray-100"
                    >
                        ›
                    </button>
                </div>
            )}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400">
                {WEEKDAY_SHORT.map((w) => (
                    <span key={w} className="py-1">
                        {w}
                    </span>
                ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((iso, i) => {
                    if (!iso) return <span key={`blank-${i}`} />;

                    const businessDay = isBusinessDay(iso);
                    const inRange = !!startDate && !!endDate && iso >= startDate && iso <= endDate;
                    const isEdge = iso === startDate || iso === endDate;
                    const isToday = iso === today;
                    // Un fin de semana/festivo dentro del rango NO cuenta contra el saldo — se
                    // mantiene gris y tachado aunque esté "seleccionado", para no dar a entender
                    // que es un día de vacaciones más.
                    const inRangeNonBusiness = inRange && !isEdge && !businessDay;

                    return (
                        <button
                            key={iso}
                            type="button"
                            onClick={() => handleClick(iso)}
                            title={!businessDay ? 'Fin de semana o festivo — no cuenta contra el saldo' : undefined}
                            className={`relative rounded-lg py-2 text-sm font-semibold transition-colors ${
                                isEdge
                                    ? 'bg-[#a81c24] text-white'
                                    : inRangeNonBusiness
                                      ? 'bg-gray-50 text-gray-300 line-through decoration-gray-300'
                                      : inRange
                                        ? 'bg-[#a81c24]/15 text-[#a81c24]'
                                        : businessDay
                                          ? 'text-gray-700 hover:bg-gray-100'
                                          : 'text-gray-300 hover:bg-gray-50'
                            } ${isToday && !isEdge ? 'ring-1 ring-inset ring-[#95c020]' : ''}`}
                        >
                            {Number(iso.slice(8, 10))}
                        </button>
                    );
                })}
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#a81c24]" /> Seleccionado
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm text-gray-300 ring-1 ring-gray-300" /> Fin de semana / festivo
                </span>
            </div>
        </div>
    );
};

const PlanVacaciones = ({ currentRouteName }: CurrentProps) => {
    const { employees, highSeasonRanges, vacationReminderMonths, auth, allAreas, selectedArea } = usePage().props as unknown as PlanVacacionesPageProps;
    const canManage = auth?.user?.permissions?.includes('ausencias.crear') ?? false;
    const reminderMonths: number = vacationReminderMonths ?? auth?.user?.vacation_reminder_months ?? 3;
    // aux_admin_th y aux_th no tienen área propia: el backend solo devuelve empleados de la
    // área elegida en "?area=" (nunca todas mezcladas) — mismo patrón que Ausencias.tsx y
    // Programaciones.tsx.
    const isMultiAreaReadOnly = !!allAreas;

    const isJanuary = new Date().getMonth() === 0;

    const [planEmployee, setPlanEmployee] = useState<EmployeeRow | null>(null);
    // Paso 1 obligatorio al abrir el modal: elegir el mes de las vacaciones. Mientras no haya
    // mes elegido no se muestran los campos de tandas (fechas) — evita que el coordinador
    // arranque a definir días sin haber fijado antes en qué mes caen.
    const [planMonth, setPlanMonth] = useState('');
    const [reserveOnly, setReserveOnly] = useState(false);
    const [tandas, setTandas] = useState<Tanda[]>([newTanda()]);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Edición de una tanda YA guardada (columna "Fechas planificadas"): modal aparte, más
    // simple que el de creación (una sola fecha inicio/fin, sin múltiples tandas).
    const [editTarget, setEditTarget] = useState<{ employee: EmployeeRow; absence: PlannedAbsence } | null>(null);
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');
    const [editMonth, setEditMonth] = useState('');
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const isTemporal = (e: EmployeeRow) => (e.contrato?.name ?? '').toLowerCase().includes('temporal');

    const openPlanModal = (employee: EmployeeRow) => {
        setPlanEmployee(employee);
        setTandas([newTanda()]);
        setReserveOnly(false);
        setPlanMonth('');
        setFormError(null);
    };

    const closePlanModal = () => {
        setPlanEmployee(null);
        setFormError(null);
    };

    // Días hábiles de cada tanda (para el contador en vivo) y si alguno cae en temporada alta —
    // calculado en cliente, misma validación autoritativa se repite en el backend al guardar.
    const tandaDetails = useMemo(
        () =>
            tandas.map((t) => {
                const days = businessDaysInRange(t.startDate, t.endDate);
                const highSeasonDay = days.find((d) => isHighSeasonDay(d, (highSeasonRanges as HighSeasonRange[]) ?? []));
                return { ...t, businessDays: days, highSeasonDay: highSeasonDay ?? null };
            }),
        [tandas, highSeasonRanges],
    );

    const totalBusinessDays = useMemo(() => tandaDetails.reduce((sum, t) => sum + t.businessDays.length, 0), [tandaDetails]);
    const hasHighSeasonConflict = tandaDetails.some((t) => t.highSeasonDay !== null);
    const saldo = planEmployee?.dias_vacaciones_disponibles ?? TOTAL_VACATION_DAYS;
    const exceedsBalance = totalBusinessDays > saldo;
    const hasIncompleteTanda = tandas.some((t) => !t.startDate || !t.endDate);
    // "Hasta" anterior a "Desde" — se avisa en el momento en vez de dejar que el botón
    // simplemente quede deshabilitado sin explicación (businessDaysInRange devuelve [] en ese caso).
    const hasInvertedTanda = tandas.some((t) => t.startDate && t.endDate && t.endDate < t.startDate);
    // Las tandas deben caer dentro del mes elegido en el paso 1 — no tiene sentido reservar
    // "marzo" y luego definir fechas de febrero.
    const hasTandaOutsideMonth = !!planMonth && tandas.some((t) => t.startDate && !t.startDate.startsWith(planMonth));

    const canSubmit =
        !!planMonth && !hasIncompleteTanda && !hasInvertedTanda && !hasTandaOutsideMonth && !exceedsBalance && !hasHighSeasonConflict && totalBusinessDays > 0;

    const MAX_TANDAS = 2;
    const addTanda = () => setTandas((prev) => (prev.length >= MAX_TANDAS ? prev : [...prev, newTanda()]));
    const removeTanda = (id: number) => setTandas((prev) => (prev.length > 1 ? prev.filter((t) => t.id !== id) : prev));
    const updateTanda = (id: number, field: 'startDate' | 'endDate', value: string) =>
        setTandas((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

    // Botones "1 semana" / "15 días" (días HÁBILES) de una tanda: calculan "Hasta" saltando
    // sábados, domingos y festivos colombianos a partir de "Desde" — aparecen apenas se elige
    // la fecha de inicio, como atajo a llenar "Hasta" a mano.
    const setTandaDuration = (id: number, businessDays: number) =>
        setTandas((prev) =>
            prev.map((t) => (t.id === id && t.startDate ? { ...t, endDate: endDateForBusinessDays(t.startDate, businessDays) } : t)),
        );

    const submitPlan = () => {
        if (!planEmployee || !canSubmit) return;

        setSubmitting(true);
        setFormError(null);

        axios
            .post(
                route('ausencias.storePlan'),
                {
                    employee_uid: planEmployee.uid,
                    ranges: tandas.map((t) => ({ start_date: t.startDate, end_date: t.endDate })),
                    expects_json: true,
                },
                { headers: { Accept: 'application/json' } },
            )
            .then(() => {
                closePlanModal();
                router.reload({ only: ['employees'] });
            })
            .catch((err) => {
                setFormError(err.response?.data?.message ?? 'No se pudo registrar el plan de vacaciones.');
            })
            .finally(() => setSubmitting(false));
    };

    const submitReservation = () => {
        if (!planEmployee || !planMonth) return;

        setSubmitting(true);
        setFormError(null);

        axios
            .post(
                route('ausencias.storeReservation'),
                { employee_uid: planEmployee.uid, planned_month: planMonth, expects_json: true },
                { headers: { Accept: 'application/json' } },
            )
            .then(() => {
                closePlanModal();
                router.reload({ only: ['employees'] });
            })
            .catch((err) => {
                setFormError(err.response?.data?.message ?? 'No se pudo reservar el mes.');
            })
            .finally(() => setSubmitting(false));
    };

    // Al editar una reserva (sin fechas) se arranca con los campos vacíos; si ya tenía fechas
    // reales (tanda normal), se precargan para ajustarlas.
    const openEditModal = (employee: EmployeeRow, absence: PlannedAbsence) => {
        setEditTarget({ employee, absence });
        const start = absence.start_date ? absence.start_date.slice(0, 10) : '';
        setEditStartDate(start);
        setEditEndDate(absence.end_date ? absence.end_date.slice(0, 10) : '');
        setEditMonth(start ? start.slice(0, 7) : absence.planned_month ?? todayIso().slice(0, 7));
        setEditError(null);
    };

    const closeEditModal = () => {
        setEditTarget(null);
        setEditError(null);
    };

    const editBusinessDays = useMemo(() => businessDaysInRange(editStartDate, editEndDate), [editStartDate, editEndDate]);
    const editHighSeasonDay = useMemo(
        () => editBusinessDays.find((d) => isHighSeasonDay(d, (highSeasonRanges as HighSeasonRange[]) ?? [])) ?? null,
        [editBusinessDays, highSeasonRanges],
    );
    // El saldo disponible para esta edición incluye de vuelta los días que la tanda ya tenía
    // descontados (se está reemplazando la tanda, no sumando una nueva) — mismo criterio que
    // el backend en updatePlanRange().
    const editAvailableBalance = (editTarget?.employee.dias_vacaciones_disponibles ?? 0) + (editTarget?.absence.days ?? 0);
    const editExceedsBalance = editBusinessDays.length > editAvailableBalance;
    const editInverted = !!editStartDate && !!editEndDate && editEndDate < editStartDate;
    const canSubmitEdit = !!editStartDate && !!editEndDate && !editInverted && editBusinessDays.length > 0 && !editExceedsBalance && !editHighSeasonDay;

    const submitEdit = () => {
        if (!editTarget || !canSubmitEdit) return;

        setEditSubmitting(true);
        setEditError(null);

        axios
            .put(
                route('ausencias.updatePlanRange', editTarget.absence.id),
                { start_date: editStartDate, end_date: editEndDate, expects_json: true },
                { headers: { Accept: 'application/json' } },
            )
            .then(() => {
                closeEditModal();
                router.reload({ only: ['employees'] });
            })
            .catch((err) => {
                setEditError(err.response?.data?.message ?? 'No se pudo actualizar la tanda.');
            })
            .finally(() => setEditSubmitting(false));
    };

    return (
        <div>
            <div className="container mx-auto mt-10">
                <h1 className="text-2xl font-bold text-gray-900">Plan de vacaciones</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Empleados con contrato fijo — saldo de {TOTAL_VACATION_DAYS} días hábiles al año, fraccionables en varias tandas.
                </p>
            </div>

            {isMultiAreaReadOnly && (
                <div className="container mx-auto mt-6">
                    <label className="block text-xs font-semibold text-gray-500">
                        Área
                        <select
                            value={selectedArea ?? ''}
                            onChange={(e) => router.get(route('plan-vacaciones'), e.target.value ? { area: e.target.value } : {})}
                            className="mt-1 block w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        >
                            <option value="">Selecciona un área</option>
                            {allAreas.map((a: { id: number; nombre: string }) => (
                                <option key={a.id} value={a.id}>
                                    {a.nombre}
                                </option>
                            ))}
                        </select>
                    </label>
                    {!selectedArea && <p className="mt-2 text-xs text-gray-400">Elige un área para consultar su plan de vacaciones.</p>}
                </div>
            )}

            {isJanuary && (
                <div className="container mx-auto mt-6">
                    <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
                        <CalendarCheck className="flex-none text-amber-600" size={22} />
                        <p className="text-sm font-medium text-amber-800">
                            Enero es el mes prioritario para planificar las vacaciones del año de todo el equipo.
                        </p>
                    </div>
                </div>
            )}

            <div className="container mx-auto mt-6 mb-10">
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full min-w-[900px] border-collapse text-sm table-fixed">
                        <thead>
                            <tr className="bg-gray-50 text-left text-[11px] font-bold text-gray-500 uppercase">
                                <th className="w-[18%] px-4 py-3">Empleado</th>
                                <th className="w-[13%] px-4 py-3">Contrato</th>
                                <th className="w-[13%] px-4 py-3">Saldo disponible</th>
                                <th className="w-[44%] px-4 py-3">Fechas planificadas</th>
                                {canManage && <th className="w-[12%] px-4 py-3 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(employees as EmployeeRow[]).length === 0 ? (
                                <tr>
                                    <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-gray-400">
                                        No hay empleados activos en esta área.
                                    </td>
                                </tr>
                            ) : (
                                (employees as EmployeeRow[]).map((e) => {
                                    const temporal = isTemporal(e);
                                    return (
                                        <tr key={e.uid} className="border-t border-gray-100">
                                            <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                                            <td className="px-4 py-3 text-gray-700">{e.contrato?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {temporal ? <span className="text-gray-400">Sin derecho a vacaciones</span> : `${e.dias_vacaciones_disponibles} día(s)`}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {e.absences.length === 0 ? (
                                                    <span className="text-sm text-gray-400">Sin planificar</span>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {e.absences.map((a) => {
                                                            const isReservation = a.start_date === null && a.planned_month !== null;
                                                            const due = isReservation && a.planned_month ? isReservationDue(a.planned_month, reminderMonths) : false;
                                                            return (
                                                                <li key={a.id} className="flex flex-wrap items-center gap-2">
                                                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
                                                                        {isReservation
                                                                            ? `${formatMonth(a.planned_month!)} (sin fechas)`
                                                                            : `${formatIsoDate(a.start_date!)} – ${formatIsoDate(a.end_date!)}`}
                                                                        {a.days !== null && <span className="text-gray-400">({a.days}d)</span>}
                                                                        {canManage && (
                                                                            <button
                                                                                onClick={() => openEditModal(e, a)}
                                                                                title={isReservation ? 'Definir fechas de esta reserva' : 'Editar fechas de esta tanda'}
                                                                                className="text-gray-400 hover:text-amber-700"
                                                                            >
                                                                                <Pencil size={14} />
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                    {due && (
                                                                        <button
                                                                            onClick={() => canManage && openEditModal(e, a)}
                                                                            className="flex items-center gap-1 text-xs font-bold text-red-700"
                                                                        >
                                                                            <CalendarClock size={13} /> Definir fechas ahora
                                                                        </button>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </td>
                                            {canManage && (
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => openPlanModal(e)}
                                                        disabled={temporal || e.dias_vacaciones_disponibles <= 0}
                                                        className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Planificar
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {planEmployee && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
                        <div className="flex flex-none items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h2 className="text-base font-semibold text-gray-900">Planificar vacaciones — {planEmployee.name}</h2>
                            <button onClick={closePlanModal} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 overflow-y-auto px-6 py-5">
                            {formError && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

                            <div
                                className={`rounded-xl border p-4 ${planMonth ? 'border-gray-200 bg-gray-50' : 'border-[#a81c24]/30 bg-[#a81c24]/5'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#a81c24] text-xs font-bold text-white">
                                        1
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800">Mes de las vacaciones</span>
                                </div>
                                <div className="mt-2">
                                    <MonthPicker value={planMonth} onChange={setPlanMonth} />
                                </div>
                                {!planMonth ? (
                                    <p className="mt-2 text-xs text-[#a81c24]">Elige primero el mes para poder definir los días de la tanda.</p>
                                ) : (
                                    <label className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-600">
                                        <input type="checkbox" checked={reserveOnly} onChange={(e) => setReserveOnly(e.target.checked)} />
                                        Aún no tengo las fechas exactas — solo reservar el mes
                                    </label>
                                )}
                            </div>

                            {!planMonth ? null : reserveOnly ? (
                                <p className="text-xs text-gray-400">
                                    No se descuenta saldo todavía — se avisará más adelante para definir las fechas exactas dentro de {formatMonth(planMonth)}.
                                </p>
                            ) : (
                                <>
                                    {hasTandaOutsideMonth && (
                                        <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                            <AlertTriangle size={13} /> Las fechas deben caer dentro de {formatMonth(planMonth)}.
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
                                        <span className="text-sm text-gray-600">
                                            Días hábiles usados: <strong className={exceedsBalance ? 'text-red-600' : 'text-gray-900'}>{totalBusinessDays}</strong> de{' '}
                                            {saldo}
                                        </span>
                                        {exceedsBalance && <span className="text-xs font-semibold text-red-600">Excede el saldo disponible</span>}
                                    </div>

                                    <div className="space-y-3">
                                        {tandaDetails.map((t, index) => (
                                            <div key={t.id} className="rounded-lg border border-gray-200 p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-gray-500">Tanda {index + 1}</span>
                                                    {tandas.length > 1 && (
                                                        <button onClick={() => removeTanda(t.id)} className="text-gray-400 hover:text-red-600">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {!t.startDate
                                                        ? 'Elige el día de inicio en el calendario.'
                                                        : !t.endDate
                                                          ? `Desde ${formatIsoDate(t.startDate)} — elige ahora el día final.`
                                                          : `${formatIsoDate(t.startDate)} a ${formatIsoDate(t.endDate)} · ${t.businessDays.length} día(s) hábil(es)`}
                                                </p>

                                                {t.startDate && (
                                                    <div className="mt-2 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setTandaDuration(t.id, 7)}
                                                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            1 semana (7 días hábiles)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setTandaDuration(t.id, 15)}
                                                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            15 días hábiles
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateTanda(t.id, 'startDate', '')}
                                                            className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                                                        >
                                                            Limpiar
                                                        </button>
                                                    </div>
                                                )}

                                                <RangeCalendar
                                                    monthIso={planMonth}
                                                    startDate={t.startDate}
                                                    endDate={t.endDate}
                                                    onPick={(start, end) => {
                                                        updateTanda(t.id, 'startDate', start);
                                                        updateTanda(t.id, 'endDate', end);
                                                    }}
                                                />

                                                {t.highSeasonDay && (
                                                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                                                        <AlertTriangle size={13} /> Cae en temporada alta ({formatIsoDate(t.highSeasonDay)}).
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {tandas.length < MAX_TANDAS ? (
                                        <button
                                            onClick={addTanda}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-[#95c020] hover:underline"
                                        >
                                            <Plus size={14} /> Agregar tanda
                                        </button>
                                    ) : (
                                        <p className="text-xs text-gray-400">Máximo {MAX_TANDAS} tandas por plan.</p>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex flex-none justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                            <button
                                type="button"
                                onClick={closePlanModal}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={submitting || (reserveOnly ? !planMonth : !canSubmit)}
                                onClick={reserveOnly ? submitReservation : submitPlan}
                                className="rounded-md bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : reserveOnly ? 'Guardar' : 'Guardar plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editTarget && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl">
                        <div className="flex flex-none items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h2 className="text-base font-semibold text-gray-900">Editar tanda — {editTarget.employee.name}</h2>
                            <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 overflow-y-auto px-6 py-5">
                            {editError && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}

                            <p className="text-xs text-gray-400">
                                {!editStartDate
                                    ? 'Elige el día de inicio en el calendario.'
                                    : !editEndDate
                                      ? `Desde ${formatIsoDate(editStartDate)} — elige ahora el día final.`
                                      : `${formatIsoDate(editStartDate)} a ${formatIsoDate(editEndDate)} · ${editBusinessDays.length} día(s) hábil(es) de ${editAvailableBalance} disponible(s).`}
                            </p>

                            {editStartDate && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditStartDate('');
                                        setEditEndDate('');
                                    }}
                                    className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                                >
                                    Limpiar
                                </button>
                            )}

                            <RangeCalendar
                                monthIso={editMonth}
                                startDate={editStartDate}
                                endDate={editEndDate}
                                onMonthChange={setEditMonth}
                                onPick={(start, end) => {
                                    setEditStartDate(start);
                                    setEditEndDate(end);
                                }}
                            />

                            {editInverted && (
                                <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                    <AlertTriangle size={13} /> La fecha "Hasta" no puede ser anterior a "Desde".
                                </p>
                            )}
                            {editExceedsBalance && editStartDate && editEndDate && !editInverted && (
                                <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                    <AlertTriangle size={13} /> Excede el saldo disponible.
                                </p>
                            )}
                            {editHighSeasonDay && (
                                <p className="flex items-center gap-1 text-xs text-red-600">
                                    <AlertTriangle size={13} /> Cae en temporada alta ({formatIsoDate(editHighSeasonDay)}).
                                </p>
                            )}
                        </div>

                        <div className="flex flex-none justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={editSubmitting || !canSubmitEdit}
                                onClick={submitEdit}
                                className="rounded-md bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                                {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

PlanVacaciones.layout = (page: any) => <MainLayout RouteNavbar={page.props.currentRouteName}>{page}</MainLayout>;

export default PlanVacaciones;
