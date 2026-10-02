import EmployeeProfileModal from '@/Components/EmployeeProfileModal';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyFixedAreaCutoff, DEFAULT_CLOSED_DAY_EXIT_TIMES, isParkClosed, weeksOfMonth, type ClosedDayExitTimes } from './programaciones.helpers';
import { AbsenceBadge, useAreaAbsences } from './useAreaAbsences';
import { DayTypeBadge, useOperatingDays } from './useOperatingDays';

/* =========================
   TIPOS
========================= */

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

interface WorkPosition {
    id: number;
    attraction: string;
    name: string;
}

interface ProgramationOverride {
    id: number;
    date: string;
    calendar: Calendar;
    work_position_id: number | null;
    work_position: WorkPosition | null;
}

interface Programation {
    id: number;
    calendar_id: number;
    work_position_id: number | null;
    status: string;
    start_date: string;
    end_date: string;
    work_days: number[] | null;
    calendar: Calendar;
    work_position: WorkPosition | null;
    overrides: ProgramationOverride[];
    // "absence:{id}" cuando esta fila fue creada por EmployeeAbsenceController::store() para
    // que un reemplazo cubra a un empleado ausente (vacaciones/incapacidad) — ver
    // EmployeeAbsence::groupCode(). null/otro valor en cualquier programación normal.
    group_code: string | null;
}

interface Contrato {
    id: number;
    name: string;
}

interface Employee {
    uid: string;
    name: string;
    contrato?: Contrato | null;
    programations: Programation[];
}

interface Props {
    areaId: number;
    // Contenido extra (ej. un botón de gestión) que se renderiza junto a los selectores de mes/año.
    rightSlot?: React.ReactNode;
}

// Un empleado trabajando un puesto un día concreto — lo que antes vivía como
// texto secundario dentro de la celda del empleado, ahora ES la celda.
interface DayAssignment {
    employeeUid: string;
    employeeName: string;
    contrato?: Contrato | null;
    calendar: Calendar;
    isAbsenceReplacement: boolean;
    isDraft:boolean;
}

// Índice 0 sin usar: 1=Lunes ... 7=Domingo, igual convención que Carbon::dayOfWeekIso en el backend.
const weekdayLabels = ['', 'L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Mismo criterio que en Programaciones.tsx: el contrato es texto libre del
// catálogo, solo se resalta en ámbar cuando el nombre sugiere "temporal".
const contractBadgeColor = (name?: string | null) =>
    name?.toLowerCase().includes('temporal') ? 'bg-amber-100 text-amber-700' : 'bg-[#eaf3d3] text-[#5e7a15]';

/* =========================
   COMPONENT
   Grilla de solo lectura con lo que los coordinadores subieron para un área:
   mes/año, una fila por puesto de trabajo (agrupado por atracción) y una
   columna por día — cada celda muestra quién cubre ese puesto ese día. Si el
   área no tiene puestos configurados (modo fijo), cae a una fila por empleado.
========================= */

export default function AreaScheduleGrid({ areaId, rightSlot }: Props) {
    // Un coordinador no necesita exportar a Excel su propia área (ya la ve completa en
    // pantalla) — el botón queda solo para los roles que consultan varias áreas.
    const { auth } = usePage().props as { auth?: { user?: { roles?: string[]; park_closed_exit_times?: ClosedDayExitTimes } | null } };
    const isCoordinator = auth?.user?.roles?.includes('coordinator') ?? false;
    // Hora de salida de las áreas fijas los días de parque cerrado (la define el administrador).
    const closedDayExitTimes = auth?.user?.park_closed_exit_times ?? DEFAULT_CLOSED_DAY_EXIT_TIMES;

    const [year, setYear] = useState(dayjs().year());
    const [month, setMonth] = useState(dayjs().month() + 1);
    // Semana visible (índice dentro de monthWeeks) de la tabla "Empleados x días" en modo
    // fijo — se resetea a la semana que contiene hoy (o la primera del mes) al cambiar de
    // área/mes/año, igual que ya hace el scroll horizontal más abajo.
    const [weekIndex, setWeekIndex] = useState(0);
    // Periodo del botón "Exportar a Excel": '' = mes completo, o el lunes ('YYYY-MM-DD') de la semana.
    const [exportWeekStart, setExportWeekStart] = useState('');
    const exportWeeks = useMemo(() => weeksOfMonth(year, month), [year, month]);
    useEffect(() => setExportWeekStart(''), [year, month]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    // Rangos de fechas (globales, ver Areas/Index.tsx) marcados como temporada alta: dentro de
    // esos rangos NO aplica el recorte de horario corto de lunes/martes de hoursForEmployeeDay
    // (solo modo fijo).
    const [highSeasonRanges, setHighSeasonRanges] = useState<{ start: string; end: string }[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // La tabla muestra el mes completo con scroll horizontal: sin esto, al
    // cambiar de área o de mes se quedaba desplazada donde estaba antes,
    // dando la impresión de que faltaban datos que en realidad estaban más
    // a la izquierda (día 1 en adelante).
    useEffect(() => {
        scrollRef.current?.scrollTo({ left: 0 });
    }, [areaId, year, month]);

    // new Date(year, monthIndex, day) siempre construye en hora local, a diferencia de
    // dayjs(`${year}-${month}-${day}`) que delega en el parser nativo de Date y trata
    // los strings sin hora como medianoche UTC (corriendo el día mostrado hacia atrás
    // en zonas horarias detrás de UTC, ej. Colombia).
    // Memoizado: sin esto, "days" era un array NUEVO en cada render (así el usuario solo
    // escribiera en un input o abriera el modal de perfil), lo que invalidaba en cascada
    // todos los useMemo que dependen de él (positions, programationByEmployeeAndDay,
    // monthWeeks, weeklyOverages) — recalculando el mes completo en cada render sin que
    // cambiara ningún dato real.
    const days = useMemo(() => {
        const daysInMonth = dayjs(new Date(year, month - 1, 1)).daysInMonth();
        return Array.from({ length: daysInMonth }, (_, i) => dayjs(new Date(year, month - 1, i + 1)));
    }, [year, month]);
    // Tipo de día (AA, A, B, C...) del calendario operativo, para mostrarlo en los encabezados.
    const operatingDays = useOperatingDays(days[0].format('YYYY-MM-DD'), days[days.length - 1].format('YYYY-MM-DD'));
    // Vacaciones e incapacidades: esos días el turno se quita, así que se muestra la ausencia
    // en vez de dejar la celda en blanco.
    const { absenceFor, absencesOn } = useAreaAbsences(areaId);

    /* =========================
       HELPERS
    ========================= */

    // Comparación por string ISO ("YYYY-MM-DD" ordena igual lexicográfica y cronológicamente):
    // evita re-parsear las fechas del backend con dayjs y el corrimiento de día por UTC.
    // 1=Lunes ... 7=Domingo, igual convención que Carbon::dayOfWeekIso en el backend.
    const isoWeekday = (dayISO: string) => {
        const jsDay = dayjs(new Date(`${dayISO}T00:00:00`)).day();
        return jsDay === 0 ? 7 : jsDay;
    };
    // 6=Sábado, 7=Domingo en la convención isoWeekday de arriba.
    const isWeekend = (dayISO: string) => {
        const wd = isoWeekday(dayISO);
        return wd === 6 || wd === 7;
    };

   const coversDate = (p: Programation, dayISO: string) => {
    // Un override puntual para esta fecha cubre el día aunque caiga fuera del rango original
    // start_date/end_date de la fila (ver upsertOverride en el backend — un Excel/edición puede
    // agregar una excepción para un día que la fila base no cubría todavía).
    if (p.overrides?.some((o) => o.date === dayISO)) return true;
    if (dayISO < p.start_date.slice(0, 10) || dayISO > p.end_date.slice(0, 10)) return false;
    if (!p.work_days || p.work_days.length === 0) return true;
    return p.work_days.includes(isoWeekday(dayISO));
};


    // employeeUid|dayISO -> programación que cubre ese día, precalculado UNA vez por
    // employees/days (antes cada celda de la tabla llamaba a employee.programations.find(),
    // recorriendo TODAS las programaciones del empleado por cada día visible — con muchos
    // empleados y meses de historial esto se notaba, sobre todo en la tabla de modo fijo que
    // consulta un día por celda para cada empleado x día de la semana).
    const programationByEmployeeAndDay = useMemo(() => {
        const index = new Map<string, Programation>();
        for (const employee of employees) {
            for (const day of days) {
                const dayISO = day.format('YYYY-MM-DD');
                const key = `${employee.uid}|${dayISO}`;
                if (index.has(key)) continue;
                const programation = employee.programations.find((p) => coversDate(p, dayISO));
                if (programation) index.set(key, programation);
            }
        }
        return index;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, days]);

    const getProgramationForDay = (employee: Employee, dayISO: string) =>
        programationByEmployeeAndDay.get(`${employee.uid}|${dayISO}`) ?? null;

    const getCalendarForDay = (programation: Programation, date: string) => {
        const override = programation.overrides?.find((o) => o.date === date);
        return override?.calendar ?? programation.calendar;
    };

    // El puesto es del rango completo (programation.work_position_id) salvo que ese día puntual
    // haya sido reemplazado por una excepción que trae su propio puesto (ver
    // ProgramationsController::store) — una excepción que solo cambió el turno no trae puesto
    // propio (work_position_id queda null) y ahí se sigue usando el de la fila.
    const getWorkPositionForDay = (programation: Programation, date: string): WorkPosition | null => {
        const override = programation.overrides?.find((o) => o.date === date);
        if (override && override.work_position_id !== null) return override.work_position;
        return programation.work_position;
    };

    // true si esta fila de programación fue creada por una ausencia (vacaciones/incapacidad)
    // para que este empleado cubra a otro — ver EmployeeAbsenceController::store().
    const isAbsenceReplacement = (programation: Programation) => (programation.group_code ?? '').startsWith('absence:');
    const isDraft = (programation : Programation ) => programation.status === 'Borrador' ;

    // Índice invertido: de "por empleado, qué puesto" a "por puesto, qué empleado(s)" — un
    // puesto puede tener más de una persona el mismo día, así que cada celda es una lista.
    // Se calcula aquí (antes que hoursForEmployeeDay) porque positions.length es lo que indica
    // si el área es de modo fijo (0 puestos) o variable (>0), y hoursForEmployeeDay lo usa.
    const { positions, cellsByPositionAndDay } = useMemo(() => {
        const positionsById = new Map<number, WorkPosition>();
        const cells = new Map<string, DayAssignment[]>();

        for (const employee of employees) {
            for (const programation of employee.programations) {
                for (const day of days) {
                    const dayISO = day.format('YYYY-MM-DD');
                    if (!coversDate(programation, dayISO)) continue;

                    const workPosition = getWorkPositionForDay(programation, dayISO);
                    if (!workPosition) continue;

                    positionsById.set(workPosition.id, workPosition);

                    const key = `${workPosition.id}::${dayISO}`;
                    const list = cells.get(key) ?? [];
                    list.push({
                        employeeUid: employee.uid,
                        employeeName: employee.name,
                        contrato: employee.contrato,
                        calendar: getCalendarForDay(programation, dayISO),
                        isAbsenceReplacement: isAbsenceReplacement(programation),
                        isDraft: isDraft(programation),
                    });
                    cells.set(key, list);
                }
            }
        }

        const positions = [...positionsById.values()].sort((a, b) => a.attraction.localeCompare(b.attraction) || a.name.localeCompare(b.name));

        return { positions, cellsByPositionAndDay: cells };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, year, month]);

    // Horas que dura un turno, en decimal (ej. 8.5 = 8h30). Si la salida es menor o igual a
    // la entrada, es un turno nocturno que cruza medianoche — se le suma un día completo.
    const shiftHours = (calendar: Calendar): number => {
        if (!calendar.hora_entrada || !calendar.hora_salida) return 0;
        const [inH, inM] = calendar.hora_entrada.split(':').map(Number);
        const [outH, outM] = calendar.hora_salida.split(':').map(Number);
        let minutes = outH * 60 + outM - (inH * 60 + inM);
        if (minutes <= 0) minutes += 24 * 60;
        return minutes / 60;
    };

    // Política SOLO para áreas de jornada fija: los días de parque cerrado (lunes y martes fuera
    // de temporada alta) se sale a la hora configurada por el administrador — mismo criterio que
    // ShiftHours::forDay() en el backend (applyFixedAreaCutoff/isParkClosed en programaciones.helpers.ts).
    const hoursForEmployeeDay = (employee: Employee, dayISO: string): number => {
        const programation = getProgramationForDay(employee, dayISO);
        if (!programation) return 0;
        const calendar = getCalendarForDay(programation, dayISO);
        const hours = shiftHours(calendar);
        if (positions.length > 0) return hours;
        if (!isParkClosed(dayISO, highSeasonRanges, closedDayExitTimes)) return hours;

        return applyFixedAreaCutoff(hours, calendar.hora_entrada, dayISO, closedDayExitTimes);
    };

    // Semanas del mes (lunes a domingo), con null en los huecos antes del día 1 o después del
    // último — mismo criterio que monthCalendar() en Programations/programaciones.helpers.ts,
    // adaptado a dayjs. La usan el calendario de modo fijo y el resumen de horas por semana.
    const monthWeeks = useMemo(() => {
        type DayCell = (typeof days)[number] | null;
        const first = dayjs(new Date(year, month - 1, 1));
        const blanks = (first.day() + 6) % 7;
        const cells: DayCell[] = [...Array(blanks).fill(null), ...days];
        while (cells.length % 7 !== 0) cells.push(null);
        const weeks: DayCell[][] = [];
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
        return weeks;
    }, [year, month, days]);

    // Al cambiar de área/mes/año, la semana visible salta a la que contiene hoy (si hoy cae en
    // el mes mostrado) o si no a la primera semana del mes — evita que quede "congelada" en un
    // índice de semana que ya no tiene sentido para el nuevo período.
    useEffect(() => {
        const todayISO = dayjs().format('YYYY-MM-DD');
        const idx = monthWeeks.findIndex((week) => week.some((day) => day?.format('YYYY-MM-DD') === todayISO));
        setWeekIndex(idx >= 0 ? idx : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [areaId, year, month]);

    // Jornada máxima legal semanal en Colombia (Ley 2101 de 2021, reducción gradual de la
    // jornada laboral, vigente 2026): 42 horas por semana calendario — mismo tope que usa
    // Programaciones.tsx al armar la programación.
    const MAX_WEEKLY_HOURS = 42;

    // Por empleado, qué semanas del mes visible superan el tope legal — para mostrar un
    // indicador de alerta junto a su nombre en la grilla (en vez de una tabla de horas aparte,
    // que antes se mostraba siempre visible sin importar si había o no un problema).
    // `firstDayISO` es el primer día de esa semana en que el empleado tiene turno — el ícono solo
    // se muestra ahí (la celda que lo pinta), no en los demás días de la semana, para no repetir
    // la misma advertencia varias veces seguidas.
    const weeklyOverages = useMemo(() => {
        const overagesByEmployee = new Map<string, { weekIndex: number; hours: number; firstDayISO: string }[]>();
        monthWeeks.forEach((week, weekIndex) => {
            employees.forEach((employee) => {
                const weekTotal = week.reduce((sum, day) => sum + (day ? hoursForEmployeeDay(employee, day.format('YYYY-MM-DD')) : 0), 0);
                const firstDayISO = week
                    .find((day) => day && getProgramationForDay(employee, day.format('YYYY-MM-DD')))
                    ?.format('YYYY-MM-DD');
                if (firstDayISO && weekTotal > MAX_WEEKLY_HOURS) {
                    const list = overagesByEmployee.get(employee.uid) ?? [];
                    list.push({ weekIndex, hours: weekTotal, firstDayISO });
                    overagesByEmployee.set(employee.uid, list);
                }
            });
        });
        return overagesByEmployee;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthWeeks, employees]);

    const overageTooltip = (uid: string): string | null => {
        const overages = weeklyOverages.get(uid);
        if (!overages || overages.length === 0) return null;
        return overages.map((o) => `Sem. ${o.weekIndex + 1}: ${o.hours.toFixed(1)}h (supera las ${MAX_WEEKLY_HOURS}h)`).join(' · ');
    };

    // true solo en el primer día visible de CADA semana que ese empleado excedió — evita
    // repetir el mismo ícono en cada día que trabaja esa semana.
    const isFirstOverageDay = (uid: string, dayISO: string): boolean => (weeklyOverages.get(uid) ?? []).some((o) => o.firstDayISO === dayISO);

    /* =========================
       FETCH DATA
    ========================= */

    const fetchProgramations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(route('programations.dinamicDetails', areaId), { params: { year, month } });
            setEmployees(res.data.employees);
            setHighSeasonRanges(res.data.high_season_ranges ?? []);
        } catch {
            setError('No se pudo cargar la programación de esta área.');
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, [areaId, year, month]);

    useEffect(() => {
        fetchProgramations();
    }, [fetchProgramations]);

    /* =========================
       RENDER
    ========================= */

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-center gap-4 p-5">
                <label className="text-xs font-semibold text-gray-500">
                    Mes
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i + 1}>
                                {dayjs().month(i).format('MMMM')}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-xs font-semibold text-gray-500">
                    Año
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800"
                    >
                        {[year - 1, year, year + 1].map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="ml-auto flex items-center gap-2 self-end">
                    {!isCoordinator && (
                        <>
                            <select
                                value={exportWeekStart}
                                onChange={(e) => setExportWeekStart(e.target.value)}
                                title="Periodo a exportar"
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                            >
                                <option value="">Mes completo</option>
                                {exportWeeks.map((week) => (
                                    <option key={week.start} value={week.start}>
                                        {week.label}
                                    </option>
                                ))}
                            </select>
                            <a
                                href={route('programations.exportMonth', {
                                    area: areaId,
                                    year,
                                    month,
                                    ...(exportWeekStart ? { week_start: exportWeekStart } : {}),
                                })}
                                className="flex items-center gap-1.5 rounded-md border border-[#95c020] px-3 py-2 text-sm font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                            >
                                <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
                            </a>
                        </>
                    )}
                    {rightSlot}
                </div>
            </div>

            {error && <p className="mx-5 mb-3 text-sm text-red-600">{error}</p>}

            {positions.length > 0 ? (
                <div ref={scrollRef} className="mx-5 mb-5 overflow-x-auto rounded-xl border border-gray-200 bg-white">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-20 w-[260px] border-r border-b border-gray-200 bg-gray-50 px-5 py-4 text-left text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                                    Atracción · Puesto
                                </th>

                                {days.map((day) => {
                                    const dayISO = day.format('YYYY-MM-DD');
                                    return (
                                        <th
                                            key={dayISO}
                                            className={`h-[64px] w-[170px] border-b border-gray-200 text-center font-semibold text-gray-500 ${
                                                isWeekend(dayISO) ? 'bg-gray-50' : ''
                                            }`}
                                        >
                                            <div className="text-base leading-tight text-gray-700">{day.format('D')}</div>
                                            <div className="mt-0.5 text-[11px] leading-tight font-semibold text-gray-400">
                                                {weekdayLabels[isoWeekday(dayISO)]}
                                            </div>
                                            <DayTypeBadge type={operatingDays[dayISO]} className="mt-1" />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {positions.map((position) => (
                                <tr key={position.id} className="transition hover:bg-gray-50/60">
                                    {/* PUESTO */}
                                    <td className="sticky left-0 z-10 border-r border-b border-gray-100 bg-white px-5 py-4">
                                        <div className="truncate text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                                            {position.attraction}
                                        </div>
                                        <div className="truncate text-sm font-medium text-gray-900">{position.name}</div>
                                    </td>

                                    {/* DÍAS */}
                                    {days.map((day) => {
                                        const dayISO = day.format('YYYY-MM-DD');
                                        const assignments = cellsByPositionAndDay.get(`${position.id}::${dayISO}`) ?? [];
                                        const weekend = isWeekend(dayISO);

                                        return (
                                            <td
                                                key={dayISO}
                                                className={`space-y-2.5 border-b border-gray-100 px-3 py-3.5 align-top ${weekend ? 'bg-gray-50' : ''}`}
                                            >
                                                {assignments.map((a) => {
                                                    const tooltip = isFirstOverageDay(a.employeeUid, dayISO) ? overageTooltip(a.employeeUid) : null;
                                                    return (
                                                        <div key={a.employeeUid} className="leading-tight">
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setProfileUid(a.employeeUid)}
                                                                    className={`block min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-[#a81c24] hover:underline ${
                                                                        a.isDraft ? 'text-gray-400 italic' : 'text-gray-900'
                                                                    }`}
                                                                >
                                                                    {a.employeeName}
                                                                </button>
                                                                {tooltip && (
                                                                    <span title={tooltip} className="flex-none text-[#a81c24]">
                                                                        <AlertTriangle size={12} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                {a.contrato?.name && (
                                                                    <span
                                                                        className={`flex-none rounded-full px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap ${contractBadgeColor(a.contrato.name)}`}
                                                                    >
                                                                        {a.contrato.name}
                                                                    </span>
                                                                )}
                                                                {a.isDraft && (
                                                                    <span
                                                                        title="Turno en borrador, todavía sin confirmar"
                                                                        className="flex-none rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap text-gray-500"
                                                                    >
                                                                        Borrador
                                                                    </span>
                                                                )}
                                                                {a.isAbsenceReplacement && (
                                                                    <span
                                                                        title="Cubre a un empleado ausente (vacaciones/incapacidad)"
                                                                        className="flex-none rounded-full bg-sky-100 px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap text-sky-700"
                                                                    >
                                                                        Reemplazo
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* Quién está de vacaciones o incapacitado cada día: en modo variable el
                                ausente no ocupa ningún puesto, así que no aparecería en la grilla. */}
                            {days.some((day) => absencesOn(day.format('YYYY-MM-DD')).length > 0) && (
                                <tr className="bg-gray-50/60">
                                    <td className="sticky left-0 z-10 border-r border-b border-gray-100 bg-gray-50 px-5 py-4">
                                        <div className="text-sm font-semibold text-gray-700">Ausencias</div>
                                        <div className="text-[11px] text-gray-400">Vacaciones e incapacidades</div>
                                    </td>
                                    {days.map((day) => {
                                        const dayISO = day.format('YYYY-MM-DD');
                                        return (
                                            <td key={dayISO} className="space-y-1.5 border-b border-gray-100 px-3 py-3 align-top">
                                                {absencesOn(dayISO).map((a) => (
                                                    <div key={a.employee_uid} className="flex items-center gap-1.5">
                                                        <span className="min-w-0 truncate text-xs font-semibold text-gray-700">{a.employee_name ?? a.employee_uid}</span>
                                                        <AbsenceBadge type={a.type} short />
                                                    </div>
                                                ))}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : employees.length === 0 ? (
                !loading && (
                    <p className="mx-5 mb-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-400">
                        No hay empleados programados en este mes.
                    </p>
                )
            ) : (
                // Sin puestos configurados (modo fijo): tabla invertida — una columna por
                // empleado, una fila por día de la semana visible, con una X marcando el día
                // en que ese empleado tiene turno programado. Navegable semana a semana dentro
                // del mes elegido arriba (mes/año), en vez del calendario en grilla que había
                // antes (días como celdas, empleados listados dentro de cada una).
                <div className="mx-5 mb-5">
                    <div className="mb-3 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setWeekIndex((i) => Math.max(i - 1, 0))}
                            disabled={weekIndex === 0}
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <p className="text-sm font-semibold text-gray-700">
                            Semana {weekIndex + 1} de {monthWeeks.length}
                            {monthWeeks[weekIndex] && (
                                <span className="ml-2 font-normal text-gray-400">
                                    (
                                    {monthWeeks[weekIndex]
                                        .find((d) => d)
                                        ?.format('D MMM')}{' '}
                                    –{' '}
                                    {[...monthWeeks[weekIndex]]
                                        .reverse()
                                        .find((d) => d)
                                        ?.format('D MMM')}
                                    )
                                </span>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => setWeekIndex((i) => Math.min(i + 1, monthWeeks.length - 1))}
                            disabled={weekIndex >= monthWeeks.length - 1}
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full min-w-[600px] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">
                                        Empleado
                                    </th>
                                    {(monthWeeks[weekIndex] ?? []).map((day, dayIndex) => {
                                        if (!day) return <th key={`blank-${dayIndex}`} className="border-b border-l border-gray-100 bg-gray-50" />;
                                        const weekend = dayIndex >= 5;
                                        return (
                                            <th
                                                key={day.format('YYYY-MM-DD')}
                                                className={`border-b border-l border-gray-100 px-2 py-3 text-center text-[10px] font-bold whitespace-nowrap text-gray-500 uppercase ${weekend ? 'bg-gray-100' : 'bg-gray-50'}`}
                                            >
                                                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][dayIndex]}
                                                <span className="mt-0.5 block font-mono text-[9px] font-normal text-gray-400 normal-case">
                                                    {day.format('D MMM')}
                                                </span>
                                                <DayTypeBadge type={operatingDays[day.format('YYYY-MM-DD')]} className="mt-1 normal-case" />
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee.uid}>
                                        <td className="border-b border-gray-100 px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-gray-700">
                                            <button
                                                type="button"
                                                onClick={() => setProfileUid(employee.uid)}
                                                className="block max-w-[160px] truncate text-left hover:text-[#a81c24] hover:underline"
                                                title={employee.name}
                                            >
                                                {employee.name}
                                            </button>
                                        </td>
                                        {(monthWeeks[weekIndex] ?? []).map((day, dayIndex) => {
                                            if (!day) return <td key={`blank-${dayIndex}`} className="border-b border-l border-gray-100" />;
                                            const dayISO = day.format('YYYY-MM-DD');
                                            const weekend = dayIndex >= 5;
                                            const programation = getProgramationForDay(employee, dayISO);
                                            const tooltip = isFirstOverageDay(employee.uid, dayISO) ? overageTooltip(employee.uid) : null;
                                            const replacement = programation ? isAbsenceReplacement(programation) : false;
                                            const draft = programation ? isDraft(programation):false;

                                            return (
                                                <td
                                                    key={dayISO}
                                                    className={`border-b border-l border-gray-100 px-2 py-2.5 text-center ${weekend ? 'bg-gray-50' : undefined}`}
                                                >
                                                    {programation && (
                                                        <span
                                                            className={`inline-flex items-center gap-1 font-bold ${
                                                                draft? 'text-gray-400 underline decoration-dashed' : replacement ? 'text-sky-600 ' : 'text-[#a81c24]'
                                                                }`}
                                                            title={draft ? 'Turno en borrador , todavia sin confirmar' : replacement ? 'Cubre a un empleado ausente (vacaciones/incapacidad)' : undefined }
                                                        >
                                                            {draft ? 'X?' : 'X'}
                                                            {tooltip && (
                                                              <span title={tooltip} className="text-[#a81c24]">
                                                                <AlertTriangle size={12} />
                                                              </span>
                                                            )}
                                                        </span>
                                                    )}
                                                    {!programation && absenceFor(employee.uid, dayISO) && (
                                                        <AbsenceBadge type={absenceFor(employee.uid, dayISO)!} short />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {loading && <div className="mx-5 mb-4 text-sm text-gray-500">Cargando…</div>}

            <EmployeeProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />
        </div>
    );
}
