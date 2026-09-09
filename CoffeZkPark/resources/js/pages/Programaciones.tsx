import ConfirmModal from '@/Components/confirmModal';
import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Edit3, FileSpreadsheet, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AreaScheduleGrid from './Programations/AreaScheduleGrid';
import CalendarModals from './Programations/CalendarModals';
import { colombianHolidayName } from './Programations/colombianHolidays';
import { allDatesInRange, endDateForBusinessDays, isBusinessDay, isReservationDue } from './vacationPlanning.helpers';
import DayAssignmentCalendar from './Programations/DayAssignmentCalendar';
import {
    allIsoDatesInRange,
    applyFixedAreaCutoff,
    batchCoversDay,
    contractTextColor,
    durationOptions,
    formatDay,
    formatHours,
    formatRangeLabel,
    getCalendarForDay,
    getProgramationForDay,
    getWorkPositionIdForDay,
    initials,
    isHighSeasonDate,
    isoWeekday,
    isoWeekKey,
    monthCalendar,
    monthKey,
    newBatchId,
    shiftColor,
    shiftHours,
    toDate,
    toIsoDate,
} from './Programations/programaciones.helpers';
import type {
    AnchorRect,
    Calendar,
    DraftBatch,
    DraftState,
    Employee,
    EmployeeSchedule,
    HighSeasonRange,
    WorkPosition,
} from './Programations/programaciones.types';
import ShiftPickerPopover from './Programations/ShiftPickerPopover';
import WeeklyHoursWarningModal, { type WeeklyHourOverage } from './Programations/WeeklyHoursWarningModal';
import WorkPositionModals from './Programations/WorkPositionModals';

// Extrae el mensaje de error de una respuesta axios sin depender de "any" — los catch de los
// handlers de calendarios/puestos (createCalendar, deleteCalendar, etc.) solo necesitan este
// único campo, así que basta con un narrowing mínimo en vez de tipar todo el AxiosError.
const axiosErrorMessage = (err: unknown, fallback: string): string => {
    if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (err as { response?: { data?: { message?: unknown } } }).response;
        if (typeof response?.data?.message === 'string') return response.data.message;
    }
    return fallback;
};

// Fila de la tabla de asignación (modo fijo), memoizada aparte del componente principal:
// con cientos de empleados (temporada alta), sin esto un click en UNA celda re-renderizaba
// las filas de TODOS los demás empleados. Solo se re-renderiza si cambian sus propias props
// (p.ej. si su día pintado cambia, o si su propio picker se abre/cierra).
const ABSENCE_TYPE_LABELS: Record<'vacaciones' | 'incapacidad', string> = {
    vacaciones: 'Vacaciones',
    incapacidad: 'Incapacidad',
};

interface EmployeeAbsenceInfo {
    employee_uid: string;
    type: 'vacaciones' | 'incapacidad';
    start_date: string;
    end_date: string;
}

interface AreaOption {
    id: number;
    nombre: string;
}

// Shape real de las props que entrega la ruta "programaciones" (routes/web.php) — tipado
// explícito en vez de "usePage().props as any" para que un futuro cambio de nombre/forma de
// estas props lo detecte el compilador en vez de romperse en silencio en producción.
interface ProgramacionesPageProps {
    allAreas: AreaOption[] | null;
    auth?: {
        user?: {
            id?: number;
            area_id?: number | null;
            area_name?: string | null;
            area_scheduling_mode?: 'fijo' | 'variable' | null;
            area_high_season_ranges?: HighSeasonRange[];
            permissions?: string[];
            vacation_reminder_months?: number;
        } | null;
    };
}

interface ReservationInfo {
    id: number;
    employee_uid: string;
    planned_month: string;
}

const EmployeeRow = React.memo(function EmployeeRow({
    employee,
    visibleDatesInWeek,
    calendars,
    draftedCalendarForDate,
    absenceForDay,
    absenceInfoFor,
    reservationInfoFor,
    shiftLabel,
    shiftBadgeLetter,
    setEmployeeAllSelectedWeekdays,
    setEmployeeDate,
    openDayISO,
    openDayRect,
    onOpenDayPicker,
    onCloseDayPicker,
    onOpenVacationModal,
}: {
    employee: Employee;
    visibleDatesInWeek: Date[];
    calendars: Calendar[];
    draftedCalendarForDate: (uid: string, dayISO: string) => Calendar | null;
    absenceForDay: (uid: string, dayISO: string) => 'vacaciones' | 'incapacidad' | null;
    absenceInfoFor: (uid: string) => EmployeeAbsenceInfo | null;
    reservationInfoFor: (uid: string) => ReservationInfo | null;
    shiftLabel: (calendar: Calendar) => string;
    shiftBadgeLetter: (calendar: Calendar) => string;
    setEmployeeAllSelectedWeekdays: (uid: string, calendarId: number | null) => void;
    setEmployeeDate: (uid: string, dayISO: string, calendarId: number | null) => void;
    openDayISO: string | null;
    openDayRect: AnchorRect | null;
    onOpenDayPicker: (uid: string, dayISO: string, rect: AnchorRect) => void;
    onCloseDayPicker: () => void;
    onOpenVacationModal: (employee: Employee) => void;
}) {
    const e = employee;
    const absenceInfo = absenceInfoFor(e.uid);
    const reservationInfo = reservationInfoFor(e.uid);
    return (
        <tr className={absenceInfo ? 'bg-amber-50/60' : undefined}>
            <td className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                        {initials(e.name)}
                    </span>
                    <div className="min-w-0">
                        <strong className="text-sm font-medium text-gray-900">{e.name}</strong>
                        {absenceInfo && (
                            <div
                                title={`${ABSENCE_TYPE_LABELS[absenceInfo.type]}: ${formatDay(toDate(absenceInfo.start_date))} – ${formatDay(toDate(absenceInfo.end_date))}`}
                                className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-amber-700"
                            >
                                {ABSENCE_TYPE_LABELS[absenceInfo.type]} · {formatDay(toDate(absenceInfo.start_date))}–
                                {formatDay(toDate(absenceInfo.end_date))}
                            </div>
                        )}
                        {reservationInfo && (
                            <div
                                title={`Vacaciones reservadas para ${reservationInfo.planned_month} — pendiente definir fechas exactas`}
                                className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-red-700"
                            >
                                Definir vacaciones de {reservationInfo.planned_month}
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">{e.cargo?.name ?? '—'}</td>
            <td className="border-b border-gray-100 px-4 py-3 text-sm">
                {e.contrato?.name ? (
                    <span className={contractTextColor(e.contrato.name)}>{e.contrato.name}</span>
                ) : (
                    <span className="text-gray-300">—</span>
                )}
            </td>
            <td className="border-b border-gray-100 px-2 py-3 text-center">
                <span className="inline-flex items-center gap-1">
                    {calendars.map((cal) => (
                        <button
                            key={cal.id}
                            title={`Poner ${shiftLabel(cal)} todos los días elegidos a ${e.name}`}
                            onClick={() => setEmployeeAllSelectedWeekdays(e.uid, cal.id)}
                            className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white hover:opacity-80 ${shiftColor(cal.shift_type).badge}`}
                        >
                            {shiftBadgeLetter(cal)}
                        </button>
                    ))}
                    <button
                        title={`Dejar sin asignar todos los días elegidos a ${e.name}`}
                        onClick={() => setEmployeeAllSelectedWeekdays(e.uid, null)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-400 hover:bg-gray-50"
                    >
                        <X size={11} />
                    </button>
                    {(() => {
                        const isTemporal = e.contrato?.name?.toLowerCase().includes('temporal') ?? false;
                        const saldo = e.dias_vacaciones_disponibles ?? 15;
                        const noSaldo = saldo <= 0;
                        const disabled = !!absenceInfo || isTemporal || noSaldo;
                        const title = absenceInfo
                            ? 'Este empleado ya tiene una ausencia activa'
                            : isTemporal
                              ? 'Contrato temporal: no tiene derecho a vacaciones'
                              : noSaldo
                                ? 'Sin saldo de vacaciones disponible'
                                : `Registrar vacaciones para ${e.name} (saldo: ${saldo} día(s))`;
                        return (
                            <button
                                title={title}
                                disabled={disabled}
                                onClick={() => onOpenVacationModal(e)}
                                className="flex h-6 items-center justify-center rounded border border-amber-300 px-1.5 text-[9px] font-bold whitespace-nowrap text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Vac.
                            </button>
                        );
                    })()}
                </span>
            </td>
            {visibleDatesInWeek.map((date) => {
                const dayISO = toIsoDate(date);
                // Modo fijo: a propósito solo mira el borrador (no el ya-guardado como en
                // modo variable) — así se pidió dejarlo, sin cambios de comportamiento.
                // Pero cada fecha se pinta de forma independiente (no por día de la semana):
                // no todos los jueves tienen por qué llevar el mismo turno.
                const dayCalendar = draftedCalendarForDate(e.uid, dayISO);
                const dayColor = dayCalendar ? shiftColor(dayCalendar.shift_type) : null;
                const isOpen = openDayISO === dayISO;
                const absenceType = absenceForDay(e.uid, dayISO);

                if (absenceType) {
                    return (
                        <td key={dayISO} className="relative border-b border-gray-100 px-1.5 py-3 text-center">
                            <span
                                title={`${formatDay(date)}: ${ABSENCE_TYPE_LABELS[absenceType]} — no disponible para asignar`}
                                className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-amber-50 text-[9px] leading-none font-bold text-amber-700"
                            >
                                {absenceType === 'vacaciones' ? 'Vac.' : 'Inc.'}
                            </span>
                        </td>
                    );
                }

                return (
                    <td key={dayISO} className="relative border-b border-gray-100 px-1.5 py-3 text-center">
                        <button
                            onClick={(ev) => {
                                if (isOpen) {
                                    onCloseDayPicker();
                                    return;
                                }
                                const r = ev.currentTarget.getBoundingClientRect();
                                onOpenDayPicker(e.uid, dayISO, { top: r.top, left: r.left, width: r.width, bottom: r.bottom });
                            }}
                            title={
                                dayCalendar
                                    ? `${formatDay(date)}: ${shiftLabel(dayCalendar)} (clic para cambiar)`
                                    : `${formatDay(date)}: sin asignar (clic para elegir turno)`
                            }
                            className={`mx-auto flex h-8 w-8 items-center justify-center rounded text-[11px] font-bold ${
                                dayCalendar && dayColor
                                    ? `${dayColor.badge} text-white`
                                    : 'border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {dayCalendar ? shiftBadgeLetter(dayCalendar) : '·'}
                        </button>
                        {isOpen && openDayRect && (
                            <ShiftPickerPopover
                                rect={openDayRect}
                                calendars={calendars}
                                shiftLabel={shiftLabel}
                                shiftBadgeLetter={shiftBadgeLetter}
                                onPick={(calId) => {
                                    setEmployeeDate(e.uid, dayISO, calId);
                                    onCloseDayPicker();
                                }}
                                onClear={() => {
                                    setEmployeeDate(e.uid, dayISO, null);
                                    onCloseDayPicker();
                                }}
                                onClose={onCloseDayPicker}
                            />
                        )}
                    </td>
                );
            })}
        </tr>
    );
});

export default function Programaciones() {
    const { auth, allAreas } = usePage().props as unknown as ProgramacionesPageProps;
    const areaId: number | null = auth?.user?.area_id ?? null;
    const areaName: string = auth?.user?.area_name ?? 'Sin área asignada';
    const schedulingMode: 'fijo' | 'variable' = auth?.user?.area_scheduling_mode === 'variable' ? 'variable' : 'fijo';
    // Rangos de fechas marcados como temporada alta (global para toda la empresa): dentro de
    // esos rangos NO aplica el recorte de lunes hasta medio día / martes hasta las 4pm — esa
    // política de horario corto solo rige en temporada baja. Solo relevante en modo fijo. Lo
    // configura un admin (ver Areas/Index.tsx) — el coordinador solo lo ve reflejado aquí.
    const highSeasonRanges: HighSeasonRange[] = auth?.user?.area_high_season_ranges ?? [];
    // aux_th tiene "programaciones.ver" pero no "programaciones.crear": ve
    // únicamente la consulta de solo lectura por área, nunca el asistente de
    // creación (que de todos modos no podría enviar).
    const canCreate: boolean = auth?.user?.permissions?.includes('programaciones.crear') ?? false;

    // Recordatorio de plan vacacional: en enero, la primera vez que el coordinador entra a
    // Programaciones en el día (localStorage, misma llave por usuario que el resto de la
    // pantalla), se le ofrece ir a definir el plan de vacaciones del equipo antes de seguir
    // armando turnos. Solo una vez por día, no en cada carga de la página.
    const [showVacationPlanReminder, setShowVacationPlanReminder] = useState(false);
    useEffect(() => {
        if (!canCreate || !auth?.user?.id) return;
        if (new Date().getMonth() !== 0) return;

        const seenKey = `vacation-plan-reminder-seen-${auth.user.id}`;
        const today = toIsoDate(new Date());
        if (window.localStorage.getItem(seenKey) === today) return;

        setShowVacationPlanReminder(true);
        window.localStorage.setItem(seenKey, today);
    }, [canCreate, auth?.user?.id]);

    // Solo llega para aux_admin_th: le permite consultar (solo lectura) lo que subió
    // el coordinador de CUALQUIER área, sin depender de tener un área propia asignada.
    const [otherAreaId, setOtherAreaId] = useState('');

    // La clave incluye el id del usuario (no solo el área): si más adelante
    // se asigna a otro coordinador a la misma área, no debe heredar el
    // borrador sin guardar del anterior en un computador compartido.
    const draftKey = areaId && auth?.user?.id ? `programaciones-draft-${auth.user.id}-${areaId}` : null;
    const draftMaxAgeMs = 24 * 60 * 60 * 1000; // 24 horas
    const initialDraft: Partial<DraftState> = (() => {
        if (!draftKey) return {};
        try {
            const raw = window.localStorage.getItem(draftKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > draftMaxAgeMs) {
                window.localStorage.removeItem(draftKey);
                return {};
            }
            // Descarta batches degenerados (sin empleados, o en modo fijo sin
            // ningún día marcado) que hayan quedado guardados de una sesión vieja.
            if (Array.isArray(parsed.batches)) {
                parsed.batches = parsed.batches
                    .filter((b: DraftBatch) => b.employeeUids?.length > 0 && (!b.workDays || b.workDays.length > 0))
                    // Borradores guardados antes de que existiera el puesto de trabajo no traen workPositionId.
                    .map((b: DraftBatch) => ({ ...b, workPositionId: b.workPositionId ?? null }));
            }
            return parsed;
        } catch {
            return {};
        }
    })();

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [employeesList, setEmployeesList] = useState<Employee[]>([]);
    const [workPositionsList, setWorkPositionsList] = useState<WorkPosition[]>([]);
    const [scheduleByEmployee, setScheduleByEmployee] = useState<Record<string, EmployeeSchedule>>({});
    // Ausencias (vacaciones/incapacidad) ACTIVAS del área — para marcar en la grilla los días
    // que un empleado no está disponible, en vez de mostrarlos como espacio libre normal.
    const [activeAbsences, setActiveAbsences] = useState<EmployeeAbsenceInfo[]>([]);
    // Reservas de mes de vacaciones (sin fechas todavía) ACTIVAS del área — para el
    // recordatorio visual de "definir fechas" en la fila del empleado.
    const [activeReservations, setActiveReservations] = useState<ReservationInfo[]>([]);
    // Atajo rápido "Vac." en la fila del empleado (modo fijo): pide fecha de inicio + cuántos
    // días de esta tanda y llama al mismo endpoint que el formulario largo de Ausencias.tsx,
    // pero pidiendo JSON para poder quedarse en esta pantalla en vez de navegar.
    const [vacationModalEmployee, setVacationModalEmployee] = useState<Employee | null>(null);
    const [vacationStartDate, setVacationStartDate] = useState('');
    const [vacationDays, setVacationDays] = useState<number>(7);
    const [vacationSubmitting, setVacationSubmitting] = useState(false);
    const [vacationError, setVacationError] = useState<string | null>(null);
    // Modo variable: días sueltos que el coordinador marca/desmarca en el calendario del Paso 1
    // (solo referencia visual — no filtra qué días se pueden asignar en el Paso 2, que siempre
    // trabaja sobre todo el rango elegido).
    const [selectedDates, setSelectedDates] = useState<string[]>(initialDraft.selectedDates ?? []);
    // Modo fijo: antes era elegible (L-D, con atajo "Lunes a Viernes"); ahora siempre se
    // trabajan todos los días del período elegido en el Paso de fechas — se quitó el selector
    // de patrón semanal porque no era necesario y confundía con días festivos/puntuales.
    const selectedWeekdays: number[] = [1, 2, 3, 4, 5, 6, 7];
    const [batches, setBatches] = useState<DraftBatch[]>(initialDraft.batches ?? []);
    const [selectedAttraction, setSelectedAttraction] = useState<string | null>(initialDraft.selectedAttraction ?? null);
    const [selectedWorkPositionId, setSelectedWorkPositionId] = useState<number | null>(initialDraft.selectedWorkPositionId ?? null);
    const [creatingPosition, setCreatingPosition] = useState(false);
    const [newPositionNames, setNewPositionNames] = useState<string[]>(['']);
    const [editingPosition, setEditingPosition] = useState<number | null>(null);
    const [deletingPosition, setDeletingPosition] = useState<number | null>(null);
    const [filter, setFilter] = useState('all');
    const [openDayPicker, setOpenDayPicker] = useState<{ uid: string; dayISO: string; rect: AnchorRect } | null>(null);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<number | null>(null);
    const [creatingCalendar, setCreatingCalendar] = useState(false);
    const [deletingCalendar, setDeletingCalendar] = useState<number | null>(null);
    const [discardingDraft, setDiscardingDraft] = useState(false);
    const [toast, setToast] = useState('');
    const [duration, setDuration] = useState(initialDraft.duration ?? 7);
    const [startDate, setStartDate] = useState(initialDraft.startDate ?? toIsoDate(new Date()));
    // Mueve el encabezado; en modo fijo también mueve la Vista previa (en variable, la Vista
    // previa es un calendario del período completo, sin paginar por semana).
    const [weekIndex, setWeekIndex] = useState(0);
    const [savingProgress, setSavingProgress] = useState<{ done: number; total: number } | null>(null);
    // Batches a la espera de confirmación: el coordinador vio la advertencia de horas
    // semanales y todavía no decide si continuar o cancelar.
    const [pendingUpload, setPendingUpload] = useState<{ validBatches: DraftBatch[]; overages: WeeklyHourOverage[] } | null>(null);

    // Persiste el borrador (días elegidos + asignaciones pendientes) en este navegador,
    // para que recargar la página o cerrar la pestaña por accidente no lo pierda.
    useEffect(() => {
        if (!draftKey) return;
        try {
            const draft: DraftState = {
                startDate,
                duration,
                selectedWeekdays,
                selectedDates,
                batches,
                selectedAttraction,
                selectedWorkPositionId,
                savedAt: Date.now(),
            };
            window.localStorage.setItem(draftKey, JSON.stringify(draft));
        } catch {
            // localStorage lleno o bloqueado: el borrador no persiste esta vez, pero la página sigue funcionando.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey, startDate, duration, selectedDates, batches, selectedAttraction, selectedWorkPositionId]);

    // Orden por hora de entrada: en modo fijo el turno más temprano es "Apertura" y el más
    // tardío "Cierre" (así lo pidió el coordinador); en modo variable se numeran como
    // "Calendario A", "B", "C"... en ese mismo orden. shift_type (D/N) no cambia: sigue
    // alimentando lo que ya dependa de él (nómina/recargos); esto es solo la etiqueta visible.
    const sortedCalendars = useMemo(() => [...calendars].sort((a, b) => (a.hora_entrada ?? '').localeCompare(b.hora_entrada ?? '')), [calendars]);
    // "Apertura"/"Cierre" con exactamente 2 turnos; con 3, el de en medio se etiqueta "Normal"
    // (Apertura = más temprano, Normal = intermedio, Cierre = más tardío). Con 4+ turnos ya no
    // hay un único "del medio" — se pasa a letras (A, B, C...) igual que modo variable.
    const fixedModeLabel = (index: number, total: number): string | null => {
        if (total === 2) return index === 0 ? 'Apertura' : 'Cierre';
        if (total === 3) return index === 0 ? 'Apertura' : index === 1 ? 'Normal' : 'Cierre';
        return null;
    };
    const fixedModeBadgeLetter = (index: number, total: number): string | null => {
        if (total === 2) return index === 0 ? 'A' : 'C';
        if (total === 3) return index === 0 ? 'A' : index === 1 ? 'N' : 'C';
        return null;
    };
    const shiftLabel = useCallback(
        (calendar: Calendar) => {
            const index = sortedCalendars.findIndex((c) => c.id === calendar.id);
            if (index === -1) return calendar.shift_type === 'D' ? 'Turno Diurno' : 'Turno Nocturno';
            if (schedulingMode === 'fijo') {
                const label = fixedModeLabel(index, sortedCalendars.length);
                if (label) return label;
            }
            return `Calendario ${String.fromCharCode(65 + index)}`;
        },
        [sortedCalendars, schedulingMode],
    );
    const shiftBadgeLetter = useCallback(
        (calendar: Calendar) => {
            const index = sortedCalendars.findIndex((c) => c.id === calendar.id);
            if (index === -1) return calendar.shift_type;
            if (schedulingMode === 'fijo') {
                const letter = fixedModeBadgeLetter(index, sortedCalendars.length);
                if (letter) return letter;
            }
            return String.fromCharCode(65 + index);
        },
        [sortedCalendars, schedulingMode],
    );

    // Atracciones disponibles en el área (valores distintos de work_positions.attraction).
    const attractions = useMemo(
        () => [...new Set(workPositionsList.map((wp) => wp.attraction).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [workPositionsList],
    );

    // Deja siempre una pestaña de atracción activa, como una navegación real (no un <select> vacío).
    useEffect(() => {
        if (attractions.length > 0 && (!selectedAttraction || !attractions.includes(selectedAttraction))) {
            setSelectedAttraction(attractions[0]);
            setSelectedWorkPositionId(null);
        }
    }, [attractions, selectedAttraction]);

    const rangeDates = useMemo(
        () =>
            Array.from({ length: duration }, (_, index) => {
                const date = toDate(startDate);
                date.setDate(date.getDate() + index);
                return date;
            }),
        [duration, startDate],
    );

    // Modo variable: en vez de obligar al coordinador a marcar día por día, el período elegido
    // (Desde + Duración) se selecciona completo por defecto — solo tiene que desmarcar los días
    // sueltos que no necesite. Se recalcula cada vez que cambia el período (incluida la carga
    // inicial de la página), así que siempre refleja el rango vigente en vez de un borrador viejo.
    useEffect(() => {
        if (schedulingMode !== 'variable') return;
        setSelectedDates(allIsoDatesInRange(startDate, duration));
    }, [schedulingMode, startDate, duration]);

    // "Vista previa semanal" navega, de a 7 días, el mismo período elegido en el Paso 1
    // (Desde + Duración) — con "1 semana" es la única página; con "15 días"/"1 mes"/"2 meses"
    // se recorre en bloques de 7 con las flechas < >.
    const visibleDates = useMemo(() => rangeDates.slice(weekIndex * 7, weekIndex * 7 + 7), [rangeDates, weekIndex]);
    const visibleWeekdayDates = useMemo(
        () => visibleDates.filter((date) => selectedWeekdays.includes(isoWeekday(date))),
        [visibleDates, selectedWeekdays],
    );
    const totalWeeks = Math.max(Math.ceil(duration / 7), 1);
    const calendarMonths = useMemo(() => [...new Set(rangeDates.map(monthKey))], [rangeDates]);
    // Total en TODO el rango elegido (todas las semanas/páginas), usado solo para advertir antes
    // de perderlo al cambiar Desde/Duración.
    const pendingCount = batches.reduce((sum, b) => sum + b.employeeUids.length, 0);
    // Solo lo pendiente en la semana visible en pantalla ahora mismo — lo que "Subir esta
    // semana" / "Descartar esta semana" realmente afectan.
    const pendingVisibleCount = useMemo(() => {
        if (visibleDates.length === 0) return 0;
        const visibleStart = toIsoDate(visibleDates[0]);
        const visibleEnd = toIsoDate(visibleDates[visibleDates.length - 1]);
        return batches.filter((b) => b.startDate <= visibleEnd && b.endDate >= visibleStart).reduce((sum, b) => sum + b.employeeUids.length, 0);
    }, [batches, visibleDates]);

    // Navega a otra "página" de 7 días DENTRO del mismo rango elegido en el Paso 1 (Desde +
    // Duración) — el borrador se conserva íntegro, sin importar a qué semana del rango se
    // navegue: solo cambiar el rango en sí (Desde/Duración) puede perder lo pendiente.
    const goToWeek = (updater: (current: number) => number) => setWeekIndex(updater);

    // Acción de cambio de rango (Desde/Duración) a la espera de que el coordinador confirme que
    // quiere perder el borrador pendiente — reemplaza al window.confirm() nativo por un modal
    // con la paleta del proyecto (ver ConfirmModal más abajo).
    const [pendingRangeChange, setPendingRangeChange] = useState<(() => void) | null>(null);

    // Cambiar Desde/Duración en el Paso 1 define un rango distinto: si hay algo del borrador
    // pendiente de subir en el rango anterior, se avisa antes de descartarlo.
    const changeStartDate = (value: string) => {
        const apply = () => {
            setBatches([]);
            setStartDate(value);
            setWeekIndex(0);
        };
        if (pendingCount === 0) return apply();
        setPendingRangeChange(() => apply);
    };

    const changeDuration = (value: number) => {
        const apply = () => {
            setBatches([]);
            setDuration(value);
            setWeekIndex(0);
        };
        if (pendingCount === 0) return apply();
        setPendingRangeChange(() => apply);
    };

    // Un solo temporizador compartido: si dos toasts se muestran a menos de 3s
    // de diferencia, el del primero ya no puede ocultar antes de tiempo al segundo.
    const toastTimeoutRef = useRef<number | null>(null);
    const notify = (message: string) => {
        if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
        setToast(message);
        toastTimeoutRef.current = window.setTimeout(() => setToast(''), 3000);
    };

    useEffect(() => {
        if (!areaId) return;
        axios
            .get(route('calendars.byArea', areaId))
            .then((res) => {
                const catalog: Calendar[] = res.data.filter((c: Calendar) => !c.is_custom);
                setCalendars(catalog);
            })
            .catch(() => notify('No se pudieron cargar los turnos del área.'));
        axios
            .get(route('programations.employees'), { params: { area_id: areaId } })
            .then((res) => {
                setEmployeesList(res.data.filter((e: Employee) => e.estado === 'Activo'));
            })
            .catch(() => notify('No se pudo cargar la lista de empleados.'));
        axios
            .get(route('workPositions.byArea', areaId))
            .then((res) => setWorkPositionsList(res.data))
            .catch(() => notify('No se pudieron cargar los puestos de trabajo del área.'));
        axios
            .get(route('ausencias.activeByArea'), { params: { area_id: areaId } })
            .then((res) => {
                setActiveAbsences(res.data.absences ?? []);
                setActiveReservations(res.data.reservations ?? []);
            })
            .catch(() => {
                setActiveAbsences([]);
                setActiveReservations([]);
            });
    }, [areaId]);

    // Re-consulta solo lo que el atajo rápido de vacaciones puede haber cambiado (el saldo del
    // empleado y las ausencias activas), sin recargar turnos/puestos — se llama tras registrar
    // una ausencia desde el botón "Vac.", en vez de repetir todo el useEffect de arriba.
    const refreshAbsencesAndEmployees = useCallback(() => {
        if (!areaId) return;
        axios
            .get(route('ausencias.activeByArea'), { params: { area_id: areaId } })
            .then((res) => {
                setActiveAbsences(res.data.absences ?? []);
                setActiveReservations(res.data.reservations ?? []);
            })
            .catch(() => {});
        axios
            .get(route('programations.employees'), { params: { area_id: areaId } })
            .then((res) => setEmployeesList(res.data.filter((e: Employee) => e.estado === 'Activo')))
            .catch(() => {});
    }, [areaId]);

    // Fecha fin tal que [vacationStartDate, vacationEndDate] cubra EXACTAMENTE vacationDays
    // (7 o 15) días HÁBILES — sábados, domingos y festivos colombianos dentro del rango no
    // cuentan, así que el rango real suele ser más largo en días calendario.
    const vacationEndDate = useMemo(
        () => (vacationStartDate ? endDateForBusinessDays(vacationStartDate, vacationDays) : ''),
        [vacationStartDate, vacationDays],
    );
    const vacationPreviewDates = useMemo(
        () => (vacationStartDate && vacationEndDate ? allDatesInRange(vacationStartDate, vacationEndDate) : []),
        [vacationStartDate, vacationEndDate],
    );

    const submitVacationShortcut = () => {
        if (!vacationModalEmployee || !vacationStartDate || !vacationEndDate) {
            setVacationError('Completa fecha de inicio y cantidad de días.');
            return;
        }

        setVacationSubmitting(true);
        setVacationError(null);

        axios
            .post(
                route('ausencias.storePlan'),
                {
                    employee_uid: vacationModalEmployee.uid,
                    ranges: [{ start_date: vacationStartDate, end_date: vacationEndDate }],
                    expects_json: true,
                },
                { headers: { Accept: 'application/json' } },
            )
            .then(() => {
                setVacationModalEmployee(null);
                notify('✅ Vacaciones registradas.');
                refreshAbsencesAndEmployees();
            })
            .catch((err) => {
                setVacationError(err.response?.data?.message ?? 'No se pudo registrar la ausencia.');
            })
            .finally(() => setVacationSubmitting(false));
    };

    const fetchSchedule = useMemo(
        () => () => {
            if (!areaId) return;
            const months = new Map<string, { year: number; month: number }>();
            const addMonth = (date: Date) => {
                const key = monthKey(date);
                if (!months.has(key)) months.set(key, { year: date.getFullYear(), month: date.getMonth() + 1 });
            };
            // "Vista previa semanal" y la grilla de asignación comparten el mismo período
            // (Desde + Duración del Paso 1), así que basta con cubrir esos meses.
            rangeDates.forEach(addMonth);
            addMonth(new Date());
            Promise.all(
                [...months.values()].map(({ year, month }) =>
                    axios
                        .get(route('programations.dinamicDetails', areaId), { params: { year, month } })
                        .then((res) => res.data.employees as EmployeeSchedule[]),
                ),
            )
                .then((results: EmployeeSchedule[][]) => {
                    const merged: Record<string, EmployeeSchedule> = {};
                    results.flat().forEach((employeeSchedule) => {
                        const existing = merged[employeeSchedule.uid];
                        merged[employeeSchedule.uid] = existing
                            ? { uid: employeeSchedule.uid, programations: [...existing.programations, ...employeeSchedule.programations] }
                            : employeeSchedule;
                    });
                    setScheduleByEmployee(merged);
                })
                .catch(() => notify('No se pudo cargar la programación del área.'));
        },
        [areaId, rangeDates],
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

    // Para la "Vista previa" (modo variable): a qué puesto/turno queda un empleado un día
    // concreto, con el borrador mandando sobre lo ya guardado (igual que en el Paso 03), pero
    // marcando isDraft para poder distinguir "pendiente por subir" de "ya guardado" en pantalla.
    //
    // La tabla de Vista previa llama esto una vez POR CELDA (empleados × días del período,
    // hasta 60 columnas) — antes cada llamada volvía a recorrer todos los batches y todas las
    // programaciones del empleado desde cero. Acá se arma un índice una sola vez por render
    // (memoizado), expandiendo cada batch/programación SOLO en sus propios días reales (no en
    // los ~60 días de la vista), y después cada celda hace una simple lectura de mapa en vez de
    // un escaneo lineal.
    const previewAssignmentIndex = useMemo(() => {
        const index = new Map<string, { workPositionId: number | null; calendarId: number; isDraft: boolean }>();
        if (rangeDates.length === 0) return index;
        const rangeStartISO = toIsoDate(rangeDates[0]);
        const rangeEndISO = toIsoDate(rangeDates[rangeDates.length - 1]);

        // Días reales (recortados a la vista) de un rango start..end, respetando workDays.
        const expandDates = (start: string, end: string, workDays?: number[] | null): string[] => {
            const from = start > rangeStartISO ? start : rangeStartISO;
            const to = end < rangeEndISO ? end : rangeEndISO;
            if (from > to) return [];
            const dates: string[] = [];
            const cursor = toDate(from);
            const last = toDate(to);
            while (cursor <= last) {
                if (!workDays || workDays.length === 0 || workDays.includes(isoWeekday(cursor))) {
                    dates.push(toIsoDate(cursor));
                }
                cursor.setDate(cursor.getDate() + 1);
            }
            return dates;
        };

        // 1) Lo ya guardado.
        for (const employee of employeesList) {
            const schedule = scheduleByEmployee[employee.uid];
            if (!schedule) continue;
            for (const programation of schedule.programations) {
                const dates = expandDates(programation.start_date.slice(0, 10), programation.end_date.slice(0, 10), programation.work_days);
                for (const dayISO of dates) {
                    index.set(`${employee.uid}::${dayISO}`, {
                        workPositionId: getWorkPositionIdForDay(programation, dayISO),
                        calendarId: getCalendarForDay(programation, dayISO).id,
                        isDraft: false,
                    });
                }
            }
        }

        // 2) El borrador manda por encima de lo ya guardado.
        for (const batch of batches) {
            const dates = expandDates(batch.startDate, batch.endDate, batch.workDays);
            for (const uid of batch.employeeUids) {
                for (const dayISO of dates) {
                    index.set(`${uid}::${dayISO}`, { workPositionId: batch.workPositionId, calendarId: batch.calendarId, isDraft: true });
                }
            }
        }

        return index;
    }, [employeesList, scheduleByEmployee, batches, rangeDates]);

    // Índice invertido de previewAssignmentIndex: por puesto y día, qué empleado(s) quedaron
    // — para que la Vista previa se vea agrupada por puesto (como la consulta de solo lectura
    // "Consulta por área"), no por empleado. Se arma a partir del índice ya resuelto (el
    // borrador ya manda ahí sobre lo guardado), sin recorrer todo de nuevo con otra prioridad.
    const previewByPositionIndex = useMemo(() => {
        const employeesByUid = new Map(employeesList.map((e) => [e.uid, e]));
        const byPosition = new Map<string, { employee: Employee; calendarId: number; isDraft: boolean }[]>();

        for (const [key, value] of previewAssignmentIndex) {
            if (!value.workPositionId) continue;
            const separatorIndex = key.indexOf('::');
            const uid = key.slice(0, separatorIndex);
            const dayISO = key.slice(separatorIndex + 2);
            const employee = employeesByUid.get(uid);
            if (!employee) continue;

            const posKey = `${value.workPositionId}::${dayISO}`;
            const list = byPosition.get(posKey) ?? [];
            list.push({ employee, calendarId: value.calendarId, isDraft: value.isDraft });
            byPosition.set(posKey, list);
        }

        return byPosition;
    }, [employeesList, previewAssignmentIndex]);

    const previewAssignmentsForPosition = useCallback(
        (workPositionId: number, dayISO: string) => previewByPositionIndex.get(`${workPositionId}::${dayISO}`) ?? [],
        [previewByPositionIndex],
    );

    const activeWorkPositions = useMemo(
        () =>
            [...workPositionsList].filter((wp) => wp.active).sort((a, b) => a.attraction.localeCompare(b.attraction) || a.name.localeCompare(b.name)),
        [workPositionsList],
    );

    // Índice uid|día -> calendarId para los batches del puesto activo, recalculado solo cuando
    // cambian batches/puesto. Evita que cada celda de la tabla (hasta cientos de empleados x
    // días) recorra linealmente todos los batches en cada render — con temporada alta (varios
    // cientos de empleados) esa búsqueda por celda se volvía notoriamente lenta.
    const draftedCalendarIndex = useMemo(() => {
        const index = new Map<string, number>();
        for (const b of batches) {
            if (b.workPositionId !== selectedWorkPositionId) continue;
            const dayCount = Math.round((toDate(b.endDate).getTime() - toDate(b.startDate).getTime()) / 86400000) + 1;
            for (const day of allIsoDatesInRange(b.startDate, dayCount)) {
                for (const uid of b.employeeUids) {
                    index.set(`${uid}|${day}`, b.calendarId);
                }
            }
        }
        return index;
    }, [batches, selectedWorkPositionId]);

    // Turno pendiente (sin subir) para un empleado en una fecha ISO concreta — modo variable.
    // Solo mira los batches del puesto activo: cambiar de puesto no debe mostrar pintados de otro.
    const draftedCalendarForDate = useCallback(
        (uid: string, dayISO: string): Calendar | null => {
            const calendarId = draftedCalendarIndex.get(`${uid}|${dayISO}`);
            if (calendarId === undefined) return null;
            return calendars.find((c) => c.id === calendarId) ?? null;
        },
        [draftedCalendarIndex, calendars],
    );

    // Ausencia (vacaciones/incapacidad) ACTIVA de un empleado en una fecha ISO concreta — para
    // marcar esa celda como no disponible en vez de dejarla asignable. Las Programations que
    // el reemplazo ya heredó no pasan por aquí (esto solo mira EmployeeAbsence, no el estado
    // de la programación en sí).
    const absenceForDay = useCallback(
        (uid: string, dayISO: string): 'vacaciones' | 'incapacidad' | null => {
            const absence = activeAbsences.find((a) => a.employee_uid === uid && dayISO >= a.start_date && dayISO <= a.end_date);
            return absence?.type ?? null;
        },
        [activeAbsences],
    );

    // Ausencia activa de un empleado (la que empieza más pronto, si tuviera varias) sin
    // importar si su rango cae dentro de la semana visible — para resaltar toda su fila con
    // el rango completo, no solo cuando el coordinador hace scroll hasta esos días exactos.
    const absenceInfoFor = useCallback(
        (uid: string): EmployeeAbsenceInfo | null => {
            const matches = activeAbsences.filter((a) => a.employee_uid === uid);
            if (matches.length === 0) return null;
            return matches.reduce((earliest, a) => (a.start_date < earliest.start_date ? a : earliest));
        },
        [activeAbsences],
    );

    // Reserva de mes (sin fechas todavía) de un empleado, SOLO si ya toca avisar (faltan
    // <= vacationReminderMonths meses para el mes reservado) — mismo criterio que
    // PlanVacaciones.tsx, vía isReservationDue().
    const vacationReminderMonths: number = auth?.user?.vacation_reminder_months ?? 3;
    const reservationInfoFor = useCallback(
        (uid: string): ReservationInfo | null => {
            const reservation = activeReservations.find((r) => r.employee_uid === uid && isReservationDue(r.planned_month, vacationReminderMonths));
            return reservation ?? null;
        },
        [activeReservations, vacationReminderMonths],
    );

    // Saca una fecha concreta del rango de un batch, partiéndolo en lo que quede antes y
    // después (puede devolver 0, 1 o 2 pedazos según dónde caiga la fecha dentro del rango).
    const splitOutDate = (batch: DraftBatch, dayISO: string): DraftBatch[] => {
        const pieces: DraftBatch[] = [];
        if (batch.startDate < dayISO) {
            const before = toDate(dayISO);
            before.setDate(before.getDate() - 1);
            pieces.push({ ...batch, id: newBatchId(), endDate: toIsoDate(before) });
        }
        if (batch.endDate > dayISO) {
            const after = toDate(dayISO);
            after.setDate(after.getDate() + 1);
            pieces.push({ ...batch, id: newBatchId(), startDate: toIsoDate(after) });
        }
        return pieces;
    };

    // Pone (o quita, si calendarId es null) el turno de UN empleado en UNA fecha concreta —
    // modo variable —, sin tocar sus otras fechas ni a los demás empleados de un batch compartido.
    // workPositionId es opcional: por defecto usa el puesto seleccionado en pantalla (agregar/quitar
    // empleado dentro del puesto activo), pero DayAssignmentCalendar lo pasa explícito al cambiar
    // el turno del día (pickDayCalendar) — ahí cada empleado debe conservar SU PROPIO puesto, no
    // el que esté seleccionado en la pestaña en ese momento.
    const setEmployeeDate = useCallback(
        (uid: string, dayISO: string, calendarId: number | null, workPositionId: number | null = selectedWorkPositionId) => {
            setBatches((current) => {
                const next: DraftBatch[] = [];
                for (const b of current) {
                    if (!b.employeeUids.includes(uid) || b.workPositionId !== workPositionId || !batchCoversDay(b, dayISO)) {
                        next.push(b);
                        continue;
                    }
                    const others = b.employeeUids.filter((id) => id !== uid);
                    if (others.length) next.push({ ...b, employeeUids: others });
                    next.push(...splitOutDate(b, dayISO).map((piece) => ({ ...piece, employeeUids: [uid] })));
                }
                if (calendarId === null) return next;
                return [...next, { id: newBatchId(), calendarId, workPositionId, employeeUids: [uid], startDate: dayISO, endDate: dayISO }];
            });
        },
        [selectedWorkPositionId],
    );

    // Atajo modo fijo: pone (o quita) el mismo turno en TODAS las fechas reales visibles (según
    // los días de semana elegidos en el Paso 1) para un empleado, de una sola vez — equivalente
    // a "Todos los días". Pinta fecha por fecha (setEmployeeDate) para que cada día quede
    // independiente: un jueves puede tener un turno distinto de otro jueves.
    const setEmployeeAllSelectedWeekdays = useCallback(
        (uid: string, calendarId: number | null) => {
            rangeDates
                .filter((date) => selectedWeekdays.includes(isoWeekday(date)))
                // Salta los días que caen dentro de una ausencia activa (vacaciones/incapacidad)
                // de este empleado — igual criterio que bloquea el click individual en la celda.
                .filter((date) => !absenceForDay(uid, toIsoDate(date)))
                .forEach((date) => setEmployeeDate(uid, toIsoDate(date), calendarId));
        },
        [rangeDates, setEmployeeDate, absenceForDay],
    );

    // Un empleado "tiene" un turno si ya está guardado de verdad (hoy) O si lo tiene pendiente
    // en el borrador (en cualquier día) — así los filtros por calendario también encuentran lo
    // que acabas de armar y todavía no has subido.
    const hasDraft = useCallback(
        (uid: string, calendarId?: number) =>
            batches.some((b) => b.employeeUids.includes(uid) && (calendarId === undefined || b.calendarId === calendarId)),
        [batches],
    );

    // Modo fijo: se asigna directo sobre todos los empleados del área (no hay atracción/puesto).
    const assignableEmployees = employeesList;

    const employees = useMemo(
        () =>
            assignableEmployees.filter((e) => {
                const current = currentCalendarFor(e.uid);
                const matchesFilter = filter === 'all' || (filter === 'none' && !current && !hasDraft(e.uid));
                return matchesFilter && e.name.toLowerCase().includes(search.toLowerCase());
            }),
        [assignableEmployees, filter, search, currentCalendarFor, hasDraft],
    );

    // Política de la empresa SOLO para áreas de jornada fija (lunes hasta medio día, martes
    // hasta las 4pm) — mismo criterio que AreaScheduleGrid.tsx y AreaScheduleExport.php,
    // implementación compartida en applyFixedAreaCutoff() (programaciones.helpers.ts) para no
    // tener dos copias TS del mismo cálculo a mano.
    const effectiveShiftHours = (calendar: Calendar, dayISO: string): number => {
        const hours = shiftHours(calendar);
        if (schedulingMode !== 'fijo') return hours;

        // En temporada alta esta política de horario corto no aplica — se trabaja normal.
        if (isHighSeasonDate(dayISO, highSeasonRanges)) return hours;

        return applyFixedAreaCutoff(hours, calendar.hora_entrada, dayISO);
    };

    // Jornada máxima legal semanal en Colombia (Ley 2101 de 2021, reducción gradual de la
    // jornada laboral, vigente 2026): 42 horas por semana calendario. Es un aviso, no un
    // bloqueo — el coordinador puede seguir agregando empleados/turnos aunque se supere.
    const MAX_WEEKLY_HOURS = 42;

    // Antes de subir el borrador: por cada empleado y semana calendario (lunes a domingo),
    // suma las horas YA guardadas (scheduleByEmployee) más las que trae el borrador que se está
    // por enviar, y devuelve las combinaciones empleado+semana que superan el tope legal.
    const findWeeklyHourOverages = (validBatches: DraftBatch[]) => {
        const totals = new Map<string, number>(); // key: `${uid}::${weekKey}` -> horas
        const employeesByUid = new Map(employeesList.map((e) => [e.uid, e]));

        const addHours = (uid: string, dayISO: string, hours: number) => {
            if (hours <= 0) return;
            const weekKey = isoWeekKey(toDate(dayISO));
            const key = `${uid}::${weekKey}`;
            totals.set(key, (totals.get(key) ?? 0) + hours);
        };

        // Horas ya guardadas en el servidor, dentro del rango que el borrador va a tocar.
        const affectedUids = new Set(validBatches.flatMap((b) => b.employeeUids));
        const earliest = validBatches.reduce((min, b) => (b.startDate < min ? b.startDate : min), validBatches[0].startDate);
        const latest = validBatches.reduce((max, b) => (b.endDate > max ? b.endDate : max), validBatches[0].endDate);
        for (const uid of affectedUids) {
            const schedule = scheduleByEmployee[uid];
            if (!schedule) continue;
            for (let cursor = toDate(earliest); toIsoDate(cursor) <= latest; cursor.setDate(cursor.getDate() + 1)) {
                const dayISO = toIsoDate(cursor);
                const programation = getProgramationForDay(schedule, dayISO);
                if (!programation) continue;
                addHours(uid, dayISO, effectiveShiftHours(getCalendarForDay(programation, dayISO), dayISO));
            }
        }

        // Horas que trae el borrador que se va a enviar ahora.
        for (const batch of validBatches) {
            const calendar = calendars.find((c) => c.id === batch.calendarId);
            if (!calendar) continue;
            for (const uid of batch.employeeUids) {
                for (let cursor = toDate(batch.startDate); toIsoDate(cursor) <= batch.endDate; cursor.setDate(cursor.getDate() + 1)) {
                    const dayISO = toIsoDate(cursor);
                    if (batch.workDays && batch.workDays.length > 0 && !batch.workDays.includes(isoWeekday(cursor))) continue;
                    addHours(uid, dayISO, effectiveShiftHours(calendar, dayISO));
                }
            }
        }

        return Array.from(totals.entries())
            .filter(([, hours]) => hours > MAX_WEEKLY_HOURS)
            .map(([key, hours]) => {
                const [uid, weekKey] = key.split('::');
                const employeeName = employeesByUid.get(uid)?.name ?? uid;
                return { employeeName, weekKey, hours, key };
            })
            .sort((a, b) => b.hours - a.hours);
    };

    // Detección EN VIVO mientras el coordinador va programando (no solo al subir): cada vez que
    // el borrador cambia, recalcula qué empleado+semana ya pasó el tope legal y avisa con un
    // toast — solo para combinaciones NUEVAS (que aún no se habían avisado), para no repetir el
    // mismo aviso en cada tecla/click mientras la condición sigue vigente.
    const warnedOverageKeysRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (batches.length === 0) {
            warnedOverageKeysRef.current.clear();
            return;
        }
        const overages = findWeeklyHourOverages(batches);
        const currentKeys = new Set(overages.map((o) => o.key));

        // Deja de "recordar" las que ya no aplican (ej. se quitó el turno que las causaba) para
        // que, si vuelven a pasarse más adelante, se vuelva a avisar.
        for (const key of Array.from(warnedOverageKeysRef.current)) {
            if (!currentKeys.has(key)) warnedOverageKeysRef.current.delete(key);
        }

        const newOverages = overages.filter((o) => !warnedOverageKeysRef.current.has(o.key));
        if (newOverages.length > 0) {
            newOverages.forEach((o) => warnedOverageKeysRef.current.add(o.key));
            const [first, ...rest] = newOverages;
            const extra = rest.length > 0 ? ` (+${rest.length} más)` : '';
            notify(`⚠ ${first.employeeName} ya supera las ${MAX_WEEKLY_HOURS}h de la semana ${first.weekKey}: ${first.hours.toFixed(1)}h${extra}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batches, scheduleByEmployee]);

    // Envía la lista de batches ya validada (y, si aplicaba, ya confirmada pese a la
    // advertencia de horas semanales) al servidor, un batch a la vez. Los que fallan se
    // quedan en el borrador (no se pierden), pero ya NO frenan a los siguientes: un batch
    // roto (ej. quedó huérfano porque su puesto se eliminó) antes solo bloqueaba toda la
    // cola detrás de él.
    const sendBatches = (validBatches: DraftBatch[]) => {
        if (!areaId) return;

        if (validBatches.length !== batches.length) {
            setBatches(validBatches);
        }

        setSavingProgress({ done: 0, total: validBatches.length });
        let failedCount = 0;
        const sendNext = (index: number) => {
            if (index >= validBatches.length) {
                setSavingProgress(null);
                const succeeded = validBatches.length - failedCount;
                notify(
                    failedCount > 0
                        ? `Se subieron ${succeeded} de ${validBatches.length} bloques. ${failedCount} qued${failedCount === 1 ? 'ó' : 'aron'} en el borrador por error.`
                        : 'Programación subida correctamente',
                );

                // La vista previa arranca mostrando la primera página (el inicio del período
                // del Paso 1): si lo que se subió empieza más adelante dentro de ese mismo
                // período, saltar ahí para que se vea de inmediato — si no, parece que "no se
                // guardó" cuando en realidad solo hay que navegar a esa semana.
                const earliestStart = validBatches.reduce((min, b) => (b.startDate < min ? b.startDate : min), validBatches[0].startDate);
                const daysFromRangeStart = Math.round((toDate(earliestStart).getTime() - toDate(startDate).getTime()) / 86400000);
                if (daysFromRangeStart >= 0) {
                    setWeekIndex(Math.min(Math.floor(daysFromRangeStart / 7), totalWeeks - 1));
                }

                fetchSchedule();
                return;
            }
            const batch = validBatches[index];
            router.post(
                route('programationsStore'),
                {
                    area_id: areaId,
                    calendar_id: batch.calendarId,
                    work_position_id: batch.workPositionId ?? null,
                    start_date: batch.startDate,
                    end_date: batch.endDate,
                    employees: batch.employeeUids,
                    work_days: batch.workDays ?? null,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: (page) => {
                        setBatches((current) => current.filter((b) => b.id !== batch.id));
                        setSavingProgress({ done: index + 1, total: validBatches.length });
                        const warning = (page.props as unknown as { flash?: { warning?: string } })?.flash?.warning;
                        if (warning) notify(warning);
                        sendNext(index + 1);
                    },
                    onError: () => {
                        failedCount++;
                        setSavingProgress({ done: index + 1, total: validBatches.length });
                        sendNext(index + 1);
                    },
                },
            );
        };
        sendNext(0);
    };

    // Valida un conjunto de batches (nunca vacíos de empleados / sin días marcados) y, si pasan
    // el chequeo de horas semanales, los envía — si no, muestra la advertencia de horas antes de
    // continuar. Compartido por "Subir programación" (todo el borrador) y "Subir solo esta
    // semana" (solo lo que cae dentro de visibleDates).
    const validateAndSend = (candidateBatches: DraftBatch[], emptyMessage: string) => {
        if (!areaId) return;

        const validBatches = candidateBatches.filter((b) => b.employeeUids.length > 0 && (!b.workDays || b.workDays.length > 0));

        if (validBatches.length === 0) {
            notify(emptyMessage);
            return;
        }

        const overages = findWeeklyHourOverages(validBatches);
        if (overages.length > 0) {
            setPendingUpload({ validBatches, overages });
            return;
        }

        sendBatches(validBatches);
    };

    // Sube ÚNICAMENTE los batches que caen dentro de la semana visible en pantalla — el resto
    // del borrador (otras semanas del mismo rango elegido en el Paso 1) queda intacto para
    // subirlo después navegando ahí.
    const uploadVisibleWeek = () => {
        if (visibleDates.length === 0) return;
        const visibleStart = toIsoDate(visibleDates[0]);
        const visibleEnd = toIsoDate(visibleDates[visibleDates.length - 1]);
        const visibleBatches = batches.filter((b) => b.startDate <= visibleEnd && b.endDate >= visibleStart);
        validateAndSend(visibleBatches, 'No hay ninguna programación con empleados y turno asignado en la semana visible.');
    };

    // Quita del borrador únicamente los batches que caen dentro de la semana visible — el resto
    // del rango no se toca.
    const discardDraft = () => {
        if (visibleDates.length === 0) return;
        const visibleStart = toIsoDate(visibleDates[0]);
        const visibleEnd = toIsoDate(visibleDates[visibleDates.length - 1]);
        setBatches((current) => current.filter((b) => !(b.startDate <= visibleEnd && b.endDate >= visibleStart)));
        setDiscardingDraft(false);
        notify('Se descartó lo programado en esta semana');
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
        } catch (err: unknown) {
            notify(axiosErrorMessage(err, 'No se pudo actualizar el turno'));
        }
        setEditing(null);
    };

    const createCalendar = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!areaId) return;
        const form = new FormData(event.currentTarget);
        try {
            const res = await axios.post(route('calendars.store'), {
                area_id: areaId,
                hora_entrada: String(form.get('start')),
                hora_salida: String(form.get('end')),
                shift_type: String(form.get('shift_type')),
            });
            setCalendars((cs) => [...cs, res.data]);
            notify('Turno creado correctamente');
            setCreatingCalendar(false);
        } catch (err: unknown) {
            notify(axiosErrorMessage(err, 'No se pudo crear el turno'));
        }
    };

    const deleteCalendar = async () => {
        if (!deletingCalendar) return;
        try {
            await axios.delete(route('calendars.destroy', deletingCalendar));
            setCalendars((cs) => cs.filter((c) => c.id !== deletingCalendar));
            notify('Turno eliminado correctamente');
        } catch (err: unknown) {
            notify(axiosErrorMessage(err, 'No se pudo eliminar el turno'));
        }
        setDeletingCalendar(null);
    };

    const createPosition = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!areaId) return;
        const form = new FormData(event.currentTarget);
        const attraction = String(form.get('attraction')).trim();
        // Nombres únicos y no vacíos: permite crear varios puestos de una atracción de una sola vez.
        const names = [...new Set(newPositionNames.map((n) => n.trim()).filter(Boolean))];
        if (!names.length) return;

        let created = 0;
        let lastCreated: WorkPosition | null = null;
        try {
            for (const name of names) {
                const res = await axios.post(route('workPositions.store'), {
                    area_id: areaId,
                    attraction,
                    name,
                    active: true,
                });
                setWorkPositionsList((ps) => [...ps, res.data]);
                lastCreated = res.data;
                created++;
            }
            setSelectedAttraction(attraction);
            if (lastCreated) setSelectedWorkPositionId(lastCreated.id);
            notify(created > 1 ? `${created} puestos creados correctamente` : 'Puesto creado correctamente');
            setCreatingPosition(false);
        } catch (err: unknown) {
            // Los ya creados en este lote quedan (setWorkPositionsList ya corrió para esos); solo
            // se avisa del que falló para que el usuario corrija ese nombre y reintente.
            notify(axiosErrorMessage(err, 'No se pudo crear el puesto'));
        }
    };

    const savePosition = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingPosition) return;
        const form = new FormData(event.currentTarget);
        try {
            const res = await axios.put(route('workPositions.update', editingPosition), {
                attraction: String(form.get('attraction')).trim(),
                name: String(form.get('name')).trim(),
                active: form.get('active') === 'on',
            });
            setWorkPositionsList((ps) => ps.map((p) => (p.id === editingPosition ? res.data : p)));
            notify('Puesto actualizado correctamente');
        } catch (err: unknown) {
            notify(axiosErrorMessage(err, 'No se pudo actualizar el puesto'));
        }
        setEditingPosition(null);
    };

    const openCreatePosition = () => {
        setNewPositionNames(['']);
        setCreatingPosition(true);
    };

    const deletePosition = async () => {
        if (!deletingPosition) return;
        try {
            await axios.delete(route('workPositions.destroy', deletingPosition));
            setWorkPositionsList((ps) => ps.filter((p) => p.id !== deletingPosition));
            if (selectedWorkPositionId === deletingPosition) setSelectedWorkPositionId(null);
            // El backend solo bloquea el borrado si hay Programations YA guardadas — no sabe
            // nada de este borrador local. Si había turnos pintados (sin subir) bajo este
            // puesto, hay que descartarlos aquí: si no, quedarían "huérfanos" (imposibles de
            // editar, porque su acordeón ya no existe) y trabarían la subida del resto para
            // siempre, porque el backend los rechazaría uno y otra vez (work_position_id ya
            // no existe).
            const orphanedBatches = batches.filter((b) => b.workPositionId === deletingPosition);
            const discardedEmployees = orphanedBatches.reduce((sum, b) => sum + b.employeeUids.length, 0);
            if (orphanedBatches.length > 0) {
                setBatches((current) => current.filter((b) => b.workPositionId !== deletingPosition));
            }
            notify(
                discardedEmployees > 0
                    ? `Puesto eliminado. Se descartaron ${discardedEmployees} asignación${discardedEmployees === 1 ? '' : 'es'} sin subir que tenía pendientes.`
                    : 'Puesto eliminado correctamente',
            );
        } catch (err: unknown) {
            notify(axiosErrorMessage(err, 'No se pudo eliminar el puesto'));
        }
        setDeletingPosition(null);
    };

    const otherAreasSection = allAreas ? (
        <section className="rounded-xl border border-[#a81c24]/30 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Consulta por área</p>
                    <h2 className="text-lg font-semibold text-gray-900">Programación subida por los coordinadores</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-gray-500">
                        Área
                        <select
                            value={otherAreaId}
                            onChange={(event) => setOtherAreaId(event.target.value)}
                            className="ml-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        >
                            <option value="">Selecciona un área</option>
                            {allAreas.map((area: { id: number; nombre: string }) => (
                                <option key={area.id} value={area.id}>
                                    {area.nombre}
                                </option>
                            ))}
                        </select>
                    </label>
                    <a
                        href={route('programations.exportAllAreas', { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}
                        title="Descarga un Excel con una hoja por cada área, del mes actual"
                        className="flex items-center gap-1.5 rounded-md border border-[#95c020] px-3 py-1.5 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <FileSpreadsheet size={14} /> Exportar todas las áreas
                    </a>
                </div>
            </div>
            {otherAreaId ? (
                <AreaScheduleGrid areaId={Number(otherAreaId)} />
            ) : (
                <p className="px-1 text-sm text-gray-500">Elige un área para ver la programación que subió su coordinador.</p>
            )}
        </section>
    ) : null;

    // Rol de solo lectura (aux_th): nunca ve el asistente de creación, solo
    // la consulta por área — ni siquiera necesita tener un área propia.
    if (!canCreate) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
                    <header>
                        <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Consulta</p>
                        <h1 className="text-2xl font-semibold text-[#a81c24]">Programaciones</h1>
                    </header>
                    {otherAreasSection ?? <p className="text-sm text-gray-500">No hay áreas disponibles para consultar.</p>}
                </div>
            </div>
        );
    }

    if (!areaId) {
        // aux_admin_th tiene "programaciones.crear" pero, al ser un rol administrativo,
        // normalmente no tiene un área propia asignada: en ese caso debe ver la consulta
        // por área (otherAreasSection) igual que aux_th, no un bloqueo total.
        if (otherAreasSection) {
            return (
                <div className="min-h-screen bg-gray-50">
                    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
                        <header>
                            <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Consulta</p>
                            <h1 className="text-2xl font-semibold text-[#a81c24]">Programaciones</h1>
                        </header>
                        {otherAreasSection}
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
                    <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
                        <p className="text-lg font-semibold text-gray-800">No tienes un área asignada</p>
                        <p className="mt-2 text-sm text-gray-500">
                            Contacta a un administrador para que te asocie a un área y puedas programar turnos.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Cuerpo de "Asigna el horario" del modo fijo (sin atracción/puesto de por medio). El modo
    // variable usa <DayAssignmentCalendar /> en su lugar (Paso 02 en ese modo, ver más abajo).
    const renderAssignmentBody = () => (
        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            filter === 'all' ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        Todos <b className="ml-1 font-mono">{assignableEmployees.length}</b>
                    </button>
                    <button
                        onClick={() => setFilter('none')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            filter === 'none' ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        Sin asignar{' '}
                        <b className="ml-1 font-mono">{assignableEmployees.filter((e) => !currentCalendarFor(e.uid) && !hasDraft(e.uid)).length}</b>
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
            {totalWeeks > 1 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2.5">
                    <p className="m-0 text-xs text-gray-500">
                        Semana{' '}
                        <strong className="text-gray-800">
                            {weekIndex + 1} de {totalWeeks}
                        </strong>{' '}
                        ({formatRangeLabel(visibleDates)}).
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => goToWeek((p) => Math.max(p - 1, 0))}
                            disabled={weekIndex === 0}
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={() => goToWeek((p) => Math.min(p + 1, totalWeeks - 1))}
                            disabled={weekIndex >= totalWeeks - 1}
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
            {employeesList.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    No hay empleados activos en esta área.
                </p>
            ) : selectedWeekdays.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    Elige los días en el Paso 1
                </p>
            ) : (
                <div className="overflow-auto rounded-xl border border-gray-200 bg-white" onScroll={() => setOpenDayPicker(null)}>
                    <table className="w-full min-w-[950px] border-collapse">
                        <thead>
                            <tr>
                                <th className="border-b border-gray-100 bg-gray-50 px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Empleado
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Cargo
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Contrato
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-2 py-4 text-center text-[10px] font-bold text-gray-500 uppercase">
                                    Todos los días
                                </th>
                                {visibleWeekdayDates.map((date) => (
                                    <th
                                        key={toIsoDate(date)}
                                        className="border-b border-gray-100 bg-gray-50 px-1.5 py-4 text-center text-[10px] font-bold text-gray-500 uppercase"
                                    >
                                        {date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                                        <small className="mt-1 block font-mono text-[9px] font-normal text-gray-400 normal-case">
                                            {formatDay(date)}
                                        </small>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map((e) => (
                                <EmployeeRow
                                    key={e.uid}
                                    employee={e}
                                    visibleDatesInWeek={visibleWeekdayDates}
                                    calendars={calendars}
                                    draftedCalendarForDate={draftedCalendarForDate}
                                    absenceForDay={absenceForDay}
                                    absenceInfoFor={absenceInfoFor}
                                    reservationInfoFor={reservationInfoFor}
                                    shiftLabel={shiftLabel}
                                    shiftBadgeLetter={shiftBadgeLetter}
                                    setEmployeeAllSelectedWeekdays={setEmployeeAllSelectedWeekdays}
                                    setEmployeeDate={setEmployeeDate}
                                    openDayISO={openDayPicker?.uid === e.uid ? openDayPicker.dayISO : null}
                                    openDayRect={openDayPicker?.uid === e.uid ? openDayPicker.rect : null}
                                    onOpenDayPicker={(uid, dayISO, rect) => setOpenDayPicker({ uid, dayISO, rect })}
                                    onCloseDayPicker={() => setOpenDayPicker(null)}
                                    onOpenVacationModal={(employee) => {
                                        setVacationModalEmployee(employee);
                                        setVacationStartDate('');
                                        setVacationDays(7);
                                        setVacationError(null);
                                    }}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
                {otherAreasSection}
                <header>
                    <h1 className="text-2xl font-semibold text-[#a81c24]">Programación por turnos</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Área asignada: <strong className="font-semibold text-gray-700">{areaName}</strong>
                    </p>
                </header>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex flex-wrap items-end gap-4">
                            <label className="block text-xs font-semibold text-gray-500">
                                Desde
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => changeStartDate(event.target.value)}
                                    className="mt-1.5 block w-40 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="block text-xs font-semibold text-gray-500">
                                Duración
                                <select
                                    value={duration}
                                    onChange={(event) => changeDuration(Number(event.target.value))}
                                    className="mt-1.5 block w-36 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                >
                                    {durationOptions.map((option) => (
                                        <option key={option.days} value={option.days}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="h-10 w-px bg-gray-200 max-sm:hidden" />
                        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
                            <p className="m-0 text-sm text-gray-600">
                                {pendingVisibleCount > 0 ? (
                                    <>
                                        <strong className="text-gray-900">{pendingVisibleCount}</strong> empleado
                                        {pendingVisibleCount > 1 ? 's' : ''} en el borrador de esta semana, sin subir todavía.
                                    </>
                                ) : (
                                    'No hay cambios pendientes por subir en esta semana.'
                                )}
                                {pendingCount > pendingVisibleCount && (
                                    <span className="ml-1 text-gray-400">
                                        (hay {pendingCount - pendingVisibleCount} más en otras semanas del rango)
                                    </span>
                                )}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={!pendingVisibleCount}
                                    onClick={() => setDiscardingDraft(true)}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Descartar esta semana
                                </button>
                                <button
                                    disabled={!pendingVisibleCount || !!savingProgress}
                                    onClick={uploadVisibleWeek}
                                    className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Upload size={14} />
                                    {savingProgress
                                        ? `Subiendo ${savingProgress.done + 1}/${savingProgress.total}…`
                                        : `Subir esta semana${pendingVisibleCount > 0 ? ` (${pendingVisibleCount})` : ''}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {schedulingMode === 'fijo' && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-center gap-3">
                            <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">01</span>
                            <div>
                                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Primer paso</p>
                                <h2 className="text-lg font-semibold text-gray-900">Elige los días</h2>
                            </div>
                        </div>
                        <p className="mb-3 text-xs text-gray-500">
                            Período seleccionado: <strong className="text-gray-800">{formatRangeLabel(rangeDates)}</strong> ·{' '}
                            {durationOptions.find((option) => option.days === duration)?.label}
                        </p>
                        <div className="space-y-6">
                            <p className="text-xs text-gray-500">
                                Se trabajan todos los días del período seleccionado. Los días marcados con{' '}
                                <span className="font-semibold text-amber-600">●</span> son festivos en Colombia (solo referencia).
                            </p>
                            <div className="flex flex-wrap gap-6">
                                {calendarMonths.map((month) => (
                                    <div key={month} className="min-w-[480px] flex-1 rounded-xl border border-gray-200 bg-white p-5">
                                        <h3 className="mb-4 text-sm font-semibold text-gray-900 capitalize">
                                            {toDate(`${month}-01`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-gray-400">
                                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                                                <span key={`${day}-${index}`}>{day}</span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1.5 text-center">
                                            {monthCalendar(month).map((date, index) => {
                                                if (!date) return <span key={`empty-${index}`} />;
                                                const iso = toIsoDate(date);
                                                const inRange = rangeDates.some((rangeDate) => toIsoDate(rangeDate) === iso);
                                                const isWeekendDay = isoWeekday(date) === 6 || isoWeekday(date) === 7;
                                                const holidayName = colombianHolidayName(iso);
                                                return (
                                                    <span
                                                        key={iso}
                                                        title={holidayName ?? undefined}
                                                        className={`relative flex h-9 items-center justify-center rounded-md text-xs font-medium ${
                                                            inRange
                                                                ? isWeekendDay
                                                                    ? 'bg-amber-500 text-white'
                                                                    : 'bg-[#95c020] text-white'
                                                                : 'text-gray-300'
                                                        }`}
                                                    >
                                                        {date.getDate()}
                                                        {holidayName && (
                                                            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-300 ring-1 ring-white" />
                                                        )}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {highSeasonRanges.length > 0 && (
                                <p className="rounded-lg bg-[#eaf3d3] px-4 py-2.5 text-xs text-[#5e7a15]">
                                    Temporada alta configurada por administración:{' '}
                                    <strong>
                                        {highSeasonRanges
                                            .map(
                                                (r) =>
                                                    `${toDate(r.start).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – ${toDate(
                                                        r.end,
                                                    ).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`,
                                            )
                                            .join(', ')}
                                    </strong>{' '}
                                    — en esas fechas no aplica el horario corto de lunes/martes.
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {schedulingMode === 'fijo' && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center gap-3">
                            <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">02</span>
                            <div>
                                <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Segundo paso</p>
                                <h2 className="text-lg font-semibold text-gray-900">Turnos disponibles</h2>
                            </div>
                            <button
                                onClick={() => setCreatingCalendar(true)}
                                className="ml-auto flex items-center gap-1.5 rounded-md border border-[#a81c24] px-3 py-1.5 text-xs font-bold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                            >
                                <Plus size={14} /> Nuevo turno
                            </button>
                        </div>
                        {calendars.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                <p className="m-0">No hay turnos configurados para esta área todavía.</p>
                                <button
                                    onClick={() => setCreatingCalendar(true)}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white"
                                >
                                    <Plus size={14} /> Crear el primer turno
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                                {calendars.map((item) => {
                                    const color = shiftColor(item.shift_type);
                                    return (
                                        <div key={item.id} className="group flex items-center gap-3 px-5 py-4">
                                            <span className={`h-2 w-2 flex-none rounded-full ${color.dot}`} />
                                            <span className="w-5 flex-none font-mono text-xs font-bold text-gray-400">{shiftBadgeLetter(item)}</span>
                                            <span className="flex-1 text-sm font-medium text-gray-800">{shiftLabel(item)}</span>
                                            <span className="flex-none font-mono text-xs text-gray-500">{formatHours(item)}</span>
                                            <span className="flex flex-none items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button onClick={() => setEditing(item.id)} title="Editar">
                                                    <Edit3 size={14} className="text-gray-400 hover:text-gray-600" />
                                                </button>
                                                <button onClick={() => setDeletingCalendar(item.id)} title="Eliminar">
                                                    <Trash2 size={14} className="text-gray-400 hover:text-red-600" />
                                                </button>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">
                            {schedulingMode === 'variable' ? '01' : '03'}
                        </span>
                        <div>
                            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                                {schedulingMode === 'variable' ? 'Primer paso' : 'Tercer paso'}
                            </p>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {schedulingMode === 'variable' ? 'Elige el día y asigna empleados a su puesto' : 'Asigna el horario'}
                            </h2>
                        </div>
                        {schedulingMode === 'variable' && (
                            <button
                                onClick={openCreatePosition}
                                className="ml-auto flex items-center gap-1.5 rounded-md border border-[#a81c24] px-3 py-1.5 text-xs font-bold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                            >
                                <Plus size={14} /> Nueva atracción / puesto
                            </button>
                        )}
                    </div>
                    {schedulingMode === 'variable' && (
                        <p className="mb-3 text-xs text-gray-500">
                            Período: <strong className="text-gray-800">{formatRangeLabel(rangeDates)}</strong> ·{' '}
                            {durationOptions.find((option) => option.days === duration)?.label} — haz clic en un día del calendario para elegir su
                            turno y agregar empleados con su cargo.
                        </p>
                    )}
                    {schedulingMode === 'fijo' ? (
                        renderAssignmentBody()
                    ) : workPositionsList.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                            <p className="m-0">No hay atracciones ni puestos configurados para esta área todavía.</p>
                            <button
                                onClick={openCreatePosition}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white"
                            >
                                <Plus size={14} /> Crear la primera atracción y puesto
                            </button>
                        </div>
                    ) : (
                        <DayAssignmentCalendar
                            rangeDates={rangeDates}
                            calendarMonths={calendarMonths}
                            calendars={calendars}
                            shiftLabel={shiftLabel}
                            shiftBadgeLetter={shiftBadgeLetter}
                            workPositionsList={workPositionsList}
                            attractions={attractions}
                            selectedAttraction={selectedAttraction}
                            onSelectAttraction={(a) => {
                                setSelectedAttraction(a);
                                setSelectedWorkPositionId(null);
                            }}
                            selectedWorkPositionId={selectedWorkPositionId}
                            onSelectWorkPosition={setSelectedWorkPositionId}
                            onEditPosition={setEditingPosition}
                            onDeletePosition={setDeletingPosition}
                            employeesList={employeesList}
                            batches={batches}
                            scheduleByEmployee={scheduleByEmployee}
                            absenceForDay={absenceForDay}
                            onSetEmployeeDate={setEmployeeDate}
                            onEditCalendar={setEditing}
                            onCreateCalendar={() => setCreatingCalendar(true)}
                        />
                    )}
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Resultado en vivo</p>
                            <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {schedulingMode === 'fijo' && totalWeeks > 1 && (
                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                    <button
                                        disabled={weekIndex === 0}
                                        onClick={() => goToWeek((index) => Math.max(index - 1, 0))}
                                        className="flex h-7 w-7 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a81c24]"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-semibold whitespace-nowrap">{formatRangeLabel(visibleDates)}</span>
                                    <button
                                        disabled={weekIndex === totalWeeks - 1}
                                        onClick={() => goToWeek((index) => Math.min(index + 1, totalWeeks - 1))}
                                        className="flex h-7 w-7 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a81c24]"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                            <span className="text-xs text-gray-500">
                                {employeesList.length} empleados · {schedulingMode === 'variable' ? rangeDates.length : visibleDates.length} días
                            </span>
                        </div>
                    </div>
                    {schedulingMode === 'variable' ? (
                        <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
                            <table className="w-full border-separate border-spacing-0 text-xs">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-10 min-w-[220px] border-r border-b border-gray-100 bg-gray-50 px-4 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">
                                            Atracción · Puesto
                                        </th>
                                        {rangeDates.map((date) => {
                                            const weekend = isoWeekday(date) === 6 || isoWeekday(date) === 7;
                                            return (
                                                <th
                                                    key={toIsoDate(date)}
                                                    className={`min-w-[130px] border-b border-gray-100 px-2 py-4 text-center text-[10px] font-bold text-gray-500 uppercase ${weekend ? 'bg-gray-50' : ''}`}
                                                >
                                                    {date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                                                    <small className="mt-1 block font-mono text-[9px] font-normal text-gray-400 normal-case">
                                                        {formatDay(date)}
                                                    </small>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeWorkPositions.map((position) => (
                                        <tr key={position.id}>
                                            <td className="sticky left-0 z-10 border-r border-b border-gray-100 bg-white px-4 py-3">
                                                <div className="truncate text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                                                    {position.attraction}
                                                </div>
                                                <div className="truncate text-xs font-medium text-gray-900">{position.name}</div>
                                            </td>
                                            {rangeDates.map((date) => {
                                                const dayISO = toIsoDate(date);
                                                const assignments = previewAssignmentsForPosition(position.id, dayISO);
                                                const weekend = isoWeekday(date) === 6 || isoWeekday(date) === 7;
                                                return (
                                                    <td
                                                        key={dayISO}
                                                        className={`space-y-1.5 border-b border-gray-100 px-2 py-2.5 text-center align-top ${weekend ? 'bg-gray-50' : ''}`}
                                                    >
                                                        {assignments.length === 0 && <span className="text-gray-300">—</span>}
                                                        {assignments.map(({ employee, calendarId, isDraft }) => {
                                                            const cal = calendars.find((c) => c.id === calendarId) ?? null;
                                                            if (!cal) return null;
                                                            return (
                                                                <span
                                                                    key={employee.uid}
                                                                    className={`inline-flex w-full flex-col items-center gap-0.5 rounded-md border px-2 py-2 ${
                                                                        isDraft
                                                                            ? `border-dashed bg-white ${shiftColor(cal.shift_type).border} ${shiftColor(cal.shift_type).text}`
                                                                            : `${shiftColor(cal.shift_type).border} ${shiftColor(cal.shift_type).soft} ${shiftColor(cal.shift_type).softText}`
                                                                    }`}
                                                                    title={isDraft ? 'Pendiente por subir' : 'Ya guardado'}
                                                                >
                                                                    <b className="w-full truncate text-[11px] font-semibold">{employee.name}</b>
                                                                    <span className="w-full truncate font-mono text-[9px] opacity-80">
                                                                        {shiftBadgeLetter(cal)} {formatHours(cal)}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {activeWorkPositions.length === 0 && (
                                        <tr>
                                            <td colSpan={rangeDates.length + 1} className="px-4 py-6 text-center text-sm text-gray-400">
                                                No hay puestos activos configurados para esta área.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="grid min-w-[980px] grid-cols-7 gap-3">
                                {visibleDates.map((date) => {
                                    const dayISO = toIsoDate(date);
                                    const weekend = isoWeekday(date) === 6 || isoWeekday(date) === 7;

                                    // Agrupa a los empleados de ese día por turno (el borrador manda sobre lo
                                    // ya guardado), para mostrarlos como una lista de nombres bajo cada turno.
                                    const groups = new Map<number, { calendar: Calendar; people: { employee: Employee; isDraft: boolean }[] }>();
                                    employeesList.forEach((e) => {
                                        const programation = getProgramationForDay(scheduleByEmployee[e.uid], dayISO);
                                        const savedCalendar = programation ? getCalendarForDay(programation, dayISO) : null;
                                        const draftBatch = !savedCalendar
                                            ? batches.find((b) => b.employeeUids.includes(e.uid) && batchCoversDay(b, dayISO))
                                            : undefined;
                                        const draftCalendar = draftBatch ? (calendars.find((c) => c.id === draftBatch.calendarId) ?? null) : null;
                                        const cal = savedCalendar ?? draftCalendar;
                                        if (!cal) return;
                                        const group = groups.get(cal.id) ?? { calendar: cal, people: [] };
                                        group.people.push({ employee: e, isDraft: !savedCalendar });
                                        groups.set(cal.id, group);
                                    });
                                    const sortedGroups = [...groups.values()].sort((a, b) =>
                                        (a.calendar.hora_entrada ?? '').localeCompare(b.calendar.hora_entrada ?? ''),
                                    );

                                    return (
                                        <div key={dayISO} className={`rounded-xl border border-gray-200 p-3 ${weekend ? 'bg-gray-50' : 'bg-white'}`}>
                                            <div className="mb-3 text-center">
                                                <div className="truncate text-[10px] font-bold tracking-wide text-gray-400 uppercase">
                                                    {date.toLocaleDateString('es-CO', { weekday: 'long' }).replace('.', '')}
                                                </div>
                                                <div className="font-mono text-xs text-gray-600">{formatDay(date)}</div>
                                            </div>
                                            {sortedGroups.length === 0 ? (
                                                <p className="text-center text-[11px] text-gray-300">Sin asignar</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {sortedGroups.map(({ calendar, people }) => (
                                                        <div key={calendar.id}>
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] font-semibold ${shiftColor(calendar.shift_type).soft} ${shiftColor(calendar.shift_type).softText}`}
                                                            >
                                                                {shiftBadgeLetter(calendar)} {formatHours(calendar)}
                                                            </span>
                                                            <ul className="mt-1.5 space-y-1">
                                                                {people.map(({ employee, isDraft }) => (
                                                                    <li
                                                                        key={employee.uid}
                                                                        className={`truncate text-xs ${isDraft ? 'text-gray-500 italic' : 'text-gray-800'}`}
                                                                        title={isDraft ? `${employee.name} (pendiente por subir)` : employee.name}
                                                                    >
                                                                        {employee.name}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="font-bold text-gray-800"></span>
                        {calendars.map((item) => (
                            <span key={item.id} className="flex items-center gap-1">
                                <i className={`inline-block h-2 w-2 rounded-full ${shiftColor(item.shift_type).dot}`} /> {shiftLabel(item)}{' '}
                                <code className="font-mono text-gray-700">{formatHours(item)}</code>
                            </span>
                        ))}
                        <span className="flex items-center gap-1">
                            <i className="inline-block h-2 w-2 rounded-full bg-gray-300" /> Libre / sin asignar
                        </span>
                        <span className="flex items-center gap-1">
                            <i className="inline-block h-2 w-2 rounded-full border border-dashed border-gray-400" /> Punteado = en el borrador, sin
                            subir
                        </span>
                    </div>
                </section>

                <CalendarModals
                    calendars={calendars}
                    areaName={areaName}
                    shiftLabel={shiftLabel}
                    editingId={editing}
                    onCloseEdit={() => setEditing(null)}
                    onSubmitEdit={save}
                    creating={creatingCalendar}
                    onCloseCreate={() => setCreatingCalendar(false)}
                    onSubmitCreate={createCalendar}
                    deletingId={deletingCalendar}
                    onConfirmDelete={deleteCalendar}
                    onCloseDelete={() => setDeletingCalendar(null)}
                />
                <WorkPositionModals
                    workPositionsList={workPositionsList}
                    attractions={attractions}
                    selectedAttraction={selectedAttraction}
                    editingId={editingPosition}
                    onCloseEdit={() => setEditingPosition(null)}
                    onSubmitEdit={savePosition}
                    creating={creatingPosition}
                    onCloseCreate={() => setCreatingPosition(false)}
                    onSubmitCreate={createPosition}
                    newPositionNames={newPositionNames}
                    setNewPositionNames={setNewPositionNames}
                    deletingId={deletingPosition}
                    onConfirmDelete={deletePosition}
                    onCloseDelete={() => setDeletingPosition(null)}
                />
                {toast && (
                    <div className="fixed right-6 bottom-6 z-30 flex items-center gap-2 rounded-lg bg-[#5e7a15] px-4 py-3 text-sm text-white shadow-lg">
                        <Check size={16} /> {toast}
                    </div>
                )}
                <ConfirmModal
                    show={discardingDraft}
                    variant="danger"
                    title="Descartar esta semana"
                    message={`Vas a quitar ${pendingVisibleCount} empleado${pendingVisibleCount === 1 ? '' : 's'} pendientes de esta semana. El resto del rango no se toca. Esta acción no se puede deshacer.`}
                    confirmLabel="Descartar"
                    onConfirm={discardDraft}
                    onClose={() => setDiscardingDraft(false)}
                />
                <ConfirmModal
                    show={pendingRangeChange !== null}
                    variant="warning"
                    title="Cambiar el período"
                    message={`Tienes ${pendingCount} empleado${pendingCount === 1 ? '' : 's'} sin subir en el rango actual. Si cambias el período, se perderá.`}
                    confirmLabel="Cambiar de todas formas"
                    onConfirm={() => {
                        pendingRangeChange?.();
                        setPendingRangeChange(null);
                    }}
                    onClose={() => setPendingRangeChange(null)}
                />
                {pendingUpload && (
                    <WeeklyHoursWarningModal
                        overages={pendingUpload.overages}
                        maxWeeklyHours={MAX_WEEKLY_HOURS}
                        onConfirm={() => {
                            sendBatches(pendingUpload.validBatches);
                            setPendingUpload(null);
                        }}
                        onCancel={() => setPendingUpload(null)}
                    />
                )}
                {vacationModalEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
                            <h3 className="text-sm font-semibold text-gray-900">Vacaciones — {vacationModalEmployee.name}</h3>
                            <p className="mt-1 text-xs text-gray-500">
                                Saldo disponible: {vacationModalEmployee.dias_vacaciones_disponibles ?? 15} día(s) hábil(es)
                            </p>
                            <label className="mt-3 block text-xs font-medium text-gray-600">Fecha de inicio</label>
                            <input
                                type="date"
                                value={vacationStartDate}
                                onChange={(e) => setVacationStartDate(e.target.value)}
                                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                            />
                            <label className="mt-3 block text-xs font-medium text-gray-600">Días hábiles de esta tanda</label>
                            <div className="mt-1 flex gap-2">
                                {[7, 15].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setVacationDays(n)}
                                        className={`flex-1 rounded border px-3 py-1.5 text-sm font-semibold ${
                                            vacationDays === n
                                                ? 'border-amber-600 bg-amber-600 text-white'
                                                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {n} días
                                    </button>
                                ))}
                            </div>

                            {vacationStartDate && vacationPreviewDates.length > 0 && (
                                <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-2">
                                    <p className="mb-1.5 text-[11px] font-semibold text-gray-500">
                                        {formatDay(toDate(vacationStartDate))} – {formatDay(toDate(vacationEndDate))} ({vacationDays} día(s) hábil(es)
                                        de {vacationPreviewDates.length} día(s) calendario)
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {vacationPreviewDates.map((d) => {
                                            const businessDay = isBusinessDay(d);
                                            return (
                                                <span
                                                    key={d}
                                                    title={businessDay ? undefined : 'Fin de semana o festivo — no cuenta contra el saldo'}
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                                        businessDay ? 'bg-white text-gray-700' : 'text-gray-400 underline decoration-gray-400'
                                                    }`}
                                                >
                                                    {formatDay(toDate(d))}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {vacationError && <p className="mt-2 text-xs text-red-600">{vacationError}</p>}
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setVacationModalEmployee(null)}
                                    className="rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitVacationShortcut}
                                    disabled={vacationSubmitting}
                                    className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {vacationSubmitting ? 'Guardando...' : 'Registrar vacaciones'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showVacationPlanReminder && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                            <div className="flex items-start gap-3 px-6 pt-6">
                                <CalendarCheck className="mt-0.5 flex-none text-[#a81c24]" size={24} />
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900">Es hora de planificar las vacaciones del año</h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Enero es el mes prioritario para definir el plan de vacaciones de todo el equipo. Puedes hacerlo ahora o más
                                        tarde desde el menú.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => setShowVacationPlanReminder(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Ahora no
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.visit(route('plan-vacaciones'))}
                                    className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#8d171e]"
                                >
                                    Ir al plan de vacaciones
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
Programaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="programaciones">{page}</MainLayout>;
