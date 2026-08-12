import { usePage } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { CalendarCog, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ManageCalendarsModal from './ManageCalendarsModal';
import ManageProgramationsModal from './ManageProgramationsModal';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

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
    calendar: Calendar;
    overrides: ProgramationOverride[];
}

interface Employee {
    uid: string;
    name: string;
    programations: Programation[];
}

/* =========================
   COMPONENT
========================= */

export default function DetailsProgramations() {
    const { areaId } = usePage().props as unknown as { areaId: number };

    const [year, setYear] = useState(dayjs().year());
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [loading, setLoading] = useState(false);
    const [managingEmployee, setManagingEmployee] = useState<Employee | null>(null);
    const [managingCalendars, setManagingCalendars] = useState(false);

    const fetchCalendars = useCallback(() => {
        axios.get(route('calendars.byArea', areaId)).then((res) => setCalendars(res.data));
    }, [areaId]);

    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
    const days = Array.from({ length: daysInMonth }, (_, i) => dayjs(`${year}-${month}-${i + 1}`));

    /* =========================
       HELPERS
    ========================= */

    const calendarLabel = (calendar: Calendar) => {
        if (!calendar.hora_entrada || !calendar.hora_salida) {
            return 'Horario no definido';
        }
        return `${calendar.hora_entrada.slice(0, 5)} - ${calendar.hora_salida.slice(0, 5)}`;
    };

    const getProgramationForDay = (employee: Employee, day: dayjs.Dayjs) =>
        employee.programations.find((p) => day.isSameOrAfter(p.start_date, 'day') && day.isSameOrBefore(p.end_date, 'day')) ?? null;

    const getCalendarForDay = (programation: Programation, date: string) => {
        const override = programation.overrides?.find((o) => o.date === date);
        return override?.calendar ?? programation.calendar;
    };

    /* =========================
       FETCH DATA
    ========================= */

    const fetchProgramations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(route('programations.dinamicDetails', areaId), { params: { year, month } });
            setEmployees(res.data);
        } finally {
            setLoading(false);
        }
    }, [areaId, year, month]);

    useEffect(() => {
        fetchProgramations();
    }, [fetchProgramations]);

    useEffect(() => {
        fetchCalendars();
    }, [fetchCalendars]);

    /* =========================
       RENDER
    ========================= */

    return (
        <div className="p-6">
            {/* CONTROLES */}
            <div className="mb-6 flex gap-4 p-5">
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

                <button
                    onClick={() => setManagingCalendars(true)}
                    title="Cambios que afectan a todos los empleados del área"
                    className="ml-auto flex items-center gap-1 rounded-md border border-[#a81c24] px-3 py-2 text-sm font-semibold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                >
                    <CalendarCog className="h-4 w-4" /> Turnos del área (todos)
                </button>
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto rounded-lg border border-[#a81c24] bg-white m-4">
                <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-20 w-[280px] border-r border-b border-[#a81c24] bg-white px-4 py-3 text-left font- text-base text-[#a81c24]">Empleado</th>

                            {days.map((day) => (
                                <th key={day.format('YYYY-MM-DD')} className="h-[48px] w-[90px] border-b text-center text-base font-bold text-[#a81c24]">
                                    {day.format('D')}
                                </th>
                            ))}
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
                                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                            <div className="text-xs text-gray-400">{employee.uid}</div>
                                        </div>

                                        <button
                                            onClick={() => setManagingEmployee(employee)}
                                            title={`Turnos de ${employee.name} (solo este empleado)`}
                                            className="ml-auto rounded-md border border-[#a81c24] p-1 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>

                                {/* DAYS */}
                                {days.map((day) => {
                                    const dayISO = day.format('YYYY-MM-DD');
                                    const programation = getProgramationForDay(employee, day);

                                    if (!programation) {
                                        return <td key={dayISO} className="h-[72px] w-[80px] border border-[#a81c24]"/>;
                                    }

                                    const calendar = getCalendarForDay(programation, dayISO);

                                    return (
                                        <td key={dayISO} className="h-[72px] w-[80px] border border-[#a81c24] text-center text-gray-700">
                                            {calendarLabel(calendar)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {loading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}

            {managingCalendars && (
                <ManageCalendarsModal
                    areaId={areaId}
                    calendars={calendars}
                    onClose={() => setManagingCalendars(false)}
                    onChanged={fetchCalendars}
                />
            )}

            {managingEmployee && (
                <ManageProgramationsModal
                    employeeUid={managingEmployee.uid}
                    employeeName={managingEmployee.name}
                    areaId={areaId}
                    calendars={calendars}
                    programations={managingEmployee.programations}
                    onClose={() => setManagingEmployee(null)}
                    onChanged={() => {
                        setManagingEmployee(null);
                        fetchProgramations();
                    }}
                    onCalendarCreated={fetchCalendars}
                />
            )}
        </div>
    );
}
