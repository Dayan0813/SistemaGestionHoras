import axios from 'axios';
import dayjs from 'dayjs';
import { FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

interface ProgramationOverride {
    id: number;
    date: string;
    calendar: Calendar;
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
    overrides: ProgramationOverride[];
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

// Índice 0 sin usar: 1=Lunes ... 7=Domingo, igual convención que Carbon::dayOfWeekIso en el backend.
const weekdayLabels = ['', 'L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Mismo criterio que en Programaciones.tsx: el contrato es texto libre del
// catálogo, solo se resalta en ámbar cuando el nombre sugiere "temporal".
const contractBadgeColor = (name?: string | null) =>
    name?.toLowerCase().includes('temporal') ? 'bg-amber-100 text-amber-700' : 'bg-[#eaf3d3] text-[#5e7a15]';

/* =========================
   COMPONENT
   Grilla de solo lectura con lo que los coordinadores subieron
   para un área: mes/año + calendario diario por empleado.
========================= */

export default function AreaScheduleGrid({ areaId, rightSlot }: Props) {
    const [year, setYear] = useState(dayjs().year());
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
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

    const getProgramationForDay = (employee: Employee, dayISO: string) =>
        employee.programations.find((p) => {
            if (dayISO < p.start_date.slice(0, 10) || dayISO > p.end_date.slice(0, 10)) return false;
            if (!p.work_days || p.work_days.length === 0) return true;
            return p.work_days.includes(isoWeekday(dayISO));
        }) ?? null;

    const getCalendarForDay = (programation: Programation, date: string) => {
        const override = programation.overrides?.find((o) => o.date === date);
        return override?.calendar ?? programation.calendar;
    };

    /* =========================
       FETCH DATA
    ========================= */

    const fetchProgramations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(route('programations.dinamicDetails', areaId), { params: { year, month } });
            setEmployees(res.data);
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
            <div className="mb-6 flex flex-wrap gap-4 p-5">
                <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm"
                >
                    {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i + 1}>
                            {dayjs().month(i).format('MMMM')}
                        </option>
                    ))}
                </select>

                <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm"
                >
                    {[year - 1, year, year + 1].map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>

                <div className="ml-auto flex items-center gap-2">
                    <a
                        href={route('programations.exportMonth', { area: areaId, year, month })}
                        className="flex items-center gap-1.5 rounded-md border border-[#95c020] px-3 py-2 text-sm font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
                    </a>
                    {rightSlot}
                </div>
            </div>

            {error && <p className="mx-4 mb-3 text-sm text-red-600">{error}</p>}

            <div ref={scrollRef} className="m-4 overflow-x-auto rounded-lg border border-[#a81c24] bg-white">
                <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-20 w-[280px] border-r border-b border-[#a81c24] bg-white px-4 py-3 text-left font- text-base text-[#a81c24]">Empleado</th>

                            {days.map((day) => {
                                const dayISO = day.format('YYYY-MM-DD');
                                return (
                                    <th
                                        key={dayISO}
                                        className={`h-[56px] w-[90px] border-b text-center font-bold text-[#a81c24] ${
                                            isWeekend(dayISO) ? 'bg-slate-100' : ''
                                        }`}
                                    >
                                        <div className="text-base leading-tight">{day.format('D')}</div>
                                        <div className="text-[10px] leading-tight font-semibold text-gray-400">{weekdayLabels[isoWeekday(dayISO)]}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {employees.map((employee) => (
                            <tr key={employee.uid} className="transition hover:bg-gray-50">
                                {/* EMPLOYEE */}
                                <td className="sticky left-0 z-10 w-[280px] border-r bg-white px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#95c020]/30 text-[#95c020] font-extrabold">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                                                <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" />
                                            </svg>
                                        </div>

                                        <div className="leading-tight">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-gray-900">{employee.name}</span>
                                                {employee.contrato?.name && (
                                                    <span
                                                        className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${contractBadgeColor(employee.contrato.name)}`}
                                                    >
                                                        {employee.contrato.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400">{employee.uid}</div>
                                        </div>
                                    </div>
                                </td>

                                {/* DAYS */}
                                {days.map((day) => {
                                    const dayISO = day.format('YYYY-MM-DD');
                                    const programation = getProgramationForDay(employee, dayISO);

                                    const weekend = isWeekend(dayISO);

                                    if (!programation) {
                                        return (
                                            <td key={dayISO} className={`h-[72px] w-[80px] border border-[#a81c24] ${weekend ? 'bg-slate-100' : ''}`} />
                                        );
                                    }

                                    const calendar = getCalendarForDay(programation, dayISO);

                                    return (
                                        <td
                                            key={dayISO}
                                            className={`h-[72px] w-[80px] border border-[#a81c24] text-center text-gray-700 ${
                                                weekend ? 'bg-slate-100' : ''
                                            }`}
                                        >
                                            {calendarLabel(calendar)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {!loading && employees.length === 0 && (
                            <tr>
                                <td colSpan={days.length + 1} className="px-4 py-6 text-center text-sm text-gray-400">
                                    No hay empleados programados en este mes.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {loading && <div className="mt-4 px-4 text-sm text-gray-500">Cargando…</div>}
        </div>
    );
}
