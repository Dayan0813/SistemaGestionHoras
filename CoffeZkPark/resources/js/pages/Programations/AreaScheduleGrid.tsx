import EmployeeProfileModal from '@/Components/EmployeeProfileModal';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyFixedAreaCutoff } from './programaciones.helpers';

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
    const { auth } = usePage().props as { auth?: { user?: { roles?: string[] } | null } };
    const isCoordinator = auth?.user?.roles?.includes('coordinator') ?? false;

    const [year, setYear] = useState(dayjs().year());
    const [month, setMonth] = useState(dayjs().month() + 1);
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
    const daysInMonth = dayjs(new Date(year, month - 1, 1)).daysInMonth();
    const days = Array.from({ length: daysInMonth }, (_, i) => dayjs(new Date(year, month - 1, i + 1)));

    /* =========================
       HELPERS
    ========================= */

    const calendarLabel = (calendar: Calendar) => {
        if (!calendar.hora_entrada || !calendar.hora_salida) {
            return 'Horario no definido';
        }
        return `${calendar.hora_entrada.slice(0, 5)} - ${calendar.hora_salida.slice(0, 5)}`;
    };

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
        if (dayISO < p.start_date.slice(0, 10) || dayISO > p.end_date.slice(0, 10)) return false;
        if (!p.work_days || p.work_days.length === 0) return true;
        return p.work_days.includes(isoWeekday(dayISO));
    };

    const getProgramationForDay = (employee: Employee, dayISO: string) => employee.programations.find((p) => coversDate(p, dayISO)) ?? null;

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

    const shiftTint = (type: 'D' | 'N') => (type === 'D' ? 'bg-[#eaf3d3] text-[#5e7a15]' : 'bg-slate-100 text-slate-700');

    // true si esta fila de programación fue creada por una ausencia (vacaciones/incapacidad)
    // para que este empleado cubra a otro — ver EmployeeAbsenceController::store().
    const isAbsenceReplacement = (programation: Programation) => (programation.group_code ?? '').startsWith('absence:');

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

    // Política de la empresa SOLO para áreas de jornada fija (lunes hasta medio día, martes
    // hasta las 4pm) — mismo criterio que Programaciones.tsx y AreaScheduleExport.php,
    // implementación compartida en applyFixedAreaCutoff() (programaciones.helpers.ts) para no
    // tener dos copias TS del mismo cálculo a mano.
    const hoursForEmployeeDay = (employee: Employee, dayISO: string): number => {
        const programation = getProgramationForDay(employee, dayISO);
        if (!programation) return 0;
        const calendar = getCalendarForDay(programation, dayISO);
        const hours = shiftHours(calendar);
        if (positions.length > 0) return hours;

        // En temporada alta esta política de horario corto no aplica — se trabaja normal.
        if (highSeasonRanges.some((range) => dayISO >= range.start && dayISO <= range.end)) return hours;

        return applyFixedAreaCutoff(hours, calendar.hora_entrada, dayISO);
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

    // Jornada máxima legal semanal en Colombia (Ley 2101 de 2021, reducción gradual de la
    // jornada laboral, vigente 2026): 42 horas por semana calendario — mismo tope que usa
    // Programaciones.tsx al armar la programación.
    const MAX_WEEKLY_HOURS = 42;

    // Por empleado, qué semanas del mes visible superan el tope legal — para mostrar un
    // indicador de alerta junto a su nombre en la grilla (en vez de una tabla de horas aparte,
    // que antes se mostraba siempre visible sin importar si había o no un problema).
    // `firstDayISO` es el primer día real (dentro del mes) de esa semana — el ícono solo se
    // muestra ahí, no en los demás días donde el empleado también aparece esa semana, para no
    // repetir la misma advertencia varias veces seguidas.
    const weeklyOverages = useMemo(() => {
        const overagesByEmployee = new Map<string, { weekIndex: number; hours: number; firstDayISO: string }[]>();
        monthWeeks.forEach((week, weekIndex) => {
            const firstDayISO = week.find((day) => day)?.format('YYYY-MM-DD');
            if (!firstDayISO) return;
            employees.forEach((employee) => {
                const weekTotal = week.reduce((sum, day) => sum + (day ? hoursForEmployeeDay(employee, day.format('YYYY-MM-DD')) : 0), 0);
                if (weekTotal > MAX_WEEKLY_HOURS) {
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
                        <a
                            href={route('programations.exportMonth', { area: areaId, year, month })}
                            className="flex items-center gap-1.5 rounded-md border border-[#95c020] px-3 py-2 text-sm font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                        >
                            <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
                        </a>
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
                                                                    className="block min-w-0 flex-1 truncate text-left text-sm font-semibold text-gray-900 hover:text-[#a81c24] hover:underline"
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
                                                                <span className="text-[10px] text-gray-400">{calendarLabel(a.calendar)}</span>
                                                                {a.contrato?.name && (
                                                                    <span
                                                                        className={`flex-none rounded-full px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap ${contractBadgeColor(a.contrato.name)}`}
                                                                    >
                                                                        {a.contrato.name}
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
                // Sin puestos configurados (modo fijo): un calendario de verdad, semanas como
                // filas y lunes-domingo como columnas, con los nombres agrupados por turno
                // debajo de cada día — en vez de una fila por empleado.
                <div className="mx-5 mb-5 overflow-x-auto">
                    <div className="grid min-w-[980px] grid-cols-7 gap-2">
                        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((label) => (
                            <div key={label} className="px-1 pb-1 text-center text-[10px] font-bold tracking-wide text-gray-400 uppercase">
                                {label}
                            </div>
                        ))}
                        {monthWeeks.flatMap((week, weekIndex) =>
                            week.map((day, dayIndex) => {
                                const cellKey = `${weekIndex}-${dayIndex}`;
                                if (!day) return <div key={cellKey} className="rounded-xl border border-dashed border-gray-100" />;

                                const dayISO = day.format('YYYY-MM-DD');
                                const weekend = dayIndex >= 5;

                                const groups = new Map<number, { calendar: Calendar; employees: (Employee & { isAbsenceReplacement: boolean })[] }>();
                                employees.forEach((employee) => {
                                    const programation = getProgramationForDay(employee, dayISO);
                                    if (!programation) return;
                                    const calendar = getCalendarForDay(programation, dayISO);
                                    const group = groups.get(calendar.id) ?? { calendar, employees: [] };
                                    group.employees.push({ ...employee, isAbsenceReplacement: isAbsenceReplacement(programation) });
                                    groups.set(calendar.id, group);
                                });
                                const sortedGroups = [...groups.values()].sort((a, b) =>
                                    (a.calendar.hora_entrada ?? '').localeCompare(b.calendar.hora_entrada ?? ''),
                                );

                                return (
                                    <div
                                        key={cellKey}
                                        className={`min-h-[110px] rounded-xl border border-gray-200 p-2 ${weekend ? 'bg-gray-50' : 'bg-white'}`}
                                    >
                                        <div className="mb-1.5 text-right font-mono text-sm text-gray-400">{day.format('D')}</div>
                                        {sortedGroups.length === 0 ? (
                                            <p className="text-center text-xs text-gray-300">—</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {sortedGroups.map(({ calendar, employees: emps }) => (
                                                    <div key={calendar.id}>
                                                        <span
                                                            className={`block truncate rounded px-1 py-0.5 font-mono text-[11px] font-semibold ${shiftTint(calendar.shift_type)}`}
                                                        >
                                                            {calendarLabel(calendar)}
                                                        </span>
                                                        <ul>
                                                            {emps.map((e) => {
                                                                const tooltip = isFirstOverageDay(e.uid, dayISO) ? overageTooltip(e.uid) : null;
                                                                return (
                                                                    <li key={e.uid} className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setProfileUid(e.uid)}
                                                                            className="block min-w-0 flex-1 truncate text-left text-sm text-gray-700 hover:text-[#a81c24] hover:underline"
                                                                        >
                                                                            {e.name}
                                                                        </button>
                                                                        {tooltip && (
                                                                            <span title={tooltip} className="flex-none text-[#a81c24]">
                                                                                <AlertTriangle size={12} />
                                                                            </span>
                                                                        )}
                                                                        {e.isAbsenceReplacement && (
                                                                            <span
                                                                                title="Cubre a un empleado ausente (vacaciones/incapacidad)"
                                                                                className="flex-none rounded-full bg-sky-100 px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap text-sky-700"
                                                                            >
                                                                                Reemplazo
                                                                            </span>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }),
                        )}
                    </div>
                </div>
            )}

            {loading && <div className="mx-5 mb-4 text-sm text-gray-500">Cargando…</div>}

            <EmployeeProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />
        </div>
    );
}
