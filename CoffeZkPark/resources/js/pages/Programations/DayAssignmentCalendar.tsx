import EmployeeAutocomplete from '@/pages/WorkConsolidation/EmployeeAutocomplete';
import { Edit3, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { batchCoversDay, formatHours, getCalendarForDay, getProgramationForDay, monthCalendar, shiftColor, toDate, toIsoDate } from './programaciones.helpers';
import type { Calendar, DraftBatch, Employee, EmployeeSchedule, WorkPosition } from './programaciones.types';

// Paso 03 en modo variable: un calendario mensual donde cada día se abre para asignar
// empleado + puesto. Todas las atracciones/puestos de un área comparten un solo turno por
// día (regla del negocio), así que el turno se elige UNA vez por día ("Turno del día") en
// vez de por empleado — al asignar un empleado a un puesto ese día, hereda ese turno.
export default function DayAssignmentCalendar({
    rangeDates,
    calendarMonths,
    calendars,
    shiftLabel,
    shiftBadgeLetter,
    workPositionsList,
    attractions,
    selectedAttraction,
    onSelectAttraction,
    selectedWorkPositionId,
    onSelectWorkPosition,
    onEditPosition,
    onDeletePosition,
    employeesList,
    batches,
    scheduleByEmployee,
    onSetEmployeeDate,
}: {
    rangeDates: Date[];
    calendarMonths: string[];
    calendars: Calendar[];
    shiftLabel: (calendar: Calendar) => string;
    shiftBadgeLetter: (calendar: Calendar) => string;
    workPositionsList: WorkPosition[];
    attractions: string[];
    selectedAttraction: string | null;
    onSelectAttraction: (attraction: string) => void;
    selectedWorkPositionId: number | null;
    onSelectWorkPosition: (id: number | null) => void;
    onEditPosition: (id: number) => void;
    onDeletePosition: (id: number) => void;
    employeesList: Employee[];
    batches: DraftBatch[];
    scheduleByEmployee: Record<string, EmployeeSchedule>;
    onSetEmployeeDate: (uid: string, dayISO: string, calendarId: number | null) => void;
}) {
    const [openDayISO, setOpenDayISO] = useState<string | null>(null);
    const [dayCalendarId, setDayCalendarId] = useState<number | null>(null);

    // A qué puesto (y con qué turno) está asignado un empleado un día concreto: el borrador
    // manda si lo tocaste hoy; si no, se mira lo que ya está guardado de verdad.
    const resolveDayAssignment = (dayISO: string, uid: string): { workPositionId: number | null; calendarId: number | null } => {
        const batch = batches.find((b) => b.employeeUids.includes(uid) && batchCoversDay(b, dayISO));
        if (batch) return { workPositionId: batch.workPositionId, calendarId: batch.calendarId };
        const programation = getProgramationForDay(scheduleByEmployee[uid], dayISO);
        if (programation) return { workPositionId: programation.work_position_id, calendarId: getCalendarForDay(programation, dayISO).id };
        return { workPositionId: null, calendarId: null };
    };

    const assignmentsForDay = (dayISO: string) =>
        employeesList
            .map((employee) => ({ employee, ...resolveDayAssignment(dayISO, employee.uid) }))
            .filter((row): row is { employee: Employee; workPositionId: number; calendarId: number | null } => row.workPositionId !== null);

    const daySummary = (dayISO: string) => {
        const rows = assignmentsForDay(dayISO);
        return { calendarId: rows.find((r) => r.calendarId !== null)?.calendarId ?? null, count: rows.length };
    };

    const positionsForSelectedAttraction = workPositionsList.filter((wp) => wp.attraction === selectedAttraction && wp.active);

    const openDay = (dayISO: string) => {
        setOpenDayISO(dayISO);
        setDayCalendarId(daySummary(dayISO).calendarId);
    };

    // Cambiar el turno del día con gente ya asignada la re-etiqueta a todos — nunca puede
    // quedar gente en el mismo día con turnos distintos.
    const pickDayCalendar = (calendarId: number) => {
        if (!openDayISO) return;
        setDayCalendarId(calendarId);
        assignmentsForDay(openDayISO).forEach((row) => onSetEmployeeDate(row.employee.uid, openDayISO, calendarId));
    };

    const addEmployee = (uid: string) => {
        if (!openDayISO || !dayCalendarId) return;
        onSetEmployeeDate(uid, openDayISO, dayCalendarId);
    };

    const removeEmployee = (uid: string) => {
        if (!openDayISO) return;
        onSetEmployeeDate(uid, openDayISO, null);
    };

    return (
        <div>
            <div className="flex flex-wrap gap-4">
                {calendarMonths.map((month) => (
                    <div key={month} className="min-w-[380px] max-w-xl flex-1 rounded-xl border border-gray-200 bg-white p-4">
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
                                const summary = daySummary(iso);
                                const dayCalendar = summary.calendarId ? calendars.find((c) => c.id === summary.calendarId) : null;
                                const isOpen = openDayISO === iso;
                                return (
                                    <button
                                        key={iso}
                                        disabled={!inRange}
                                        onClick={() => openDay(iso)}
                                        title={iso}
                                        className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors ${
                                            !inRange
                                                ? 'text-gray-300'
                                                : isOpen
                                                  ? 'bg-[#a81c24] text-white'
                                                  : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span>{date.getDate()}</span>
                                        {summary.count > 0 && (
                                            <span className={`flex items-center gap-0.5 text-[9px] font-bold ${isOpen ? 'text-white' : 'text-gray-500'}`}>
                                                <i
                                                    className={`inline-block h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-white' : (dayCalendar ? shiftColor(dayCalendar.shift_type).dot : 'bg-gray-400')}`}
                                                />
                                                {summary.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {openDayISO && (
                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 capitalize">
                            {toDate(openDayISO).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h3>
                        <button
                            onClick={() => {
                                setOpenDayISO(null);
                                setDayCalendarId(null);
                            }}
                            title="Cerrar"
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Turno del día</p>
                    {calendars.length === 0 ? (
                        <p className="mb-5 text-xs text-gray-400">No hay turnos configurados en el Paso 02 todavía.</p>
                    ) : (
                        <div className="mb-5 flex flex-wrap gap-2">
                            {calendars.map((cal) => (
                                <button
                                    key={cal.id}
                                    onClick={() => pickDayCalendar(cal.id)}
                                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        dayCalendarId === cal.id
                                            ? `border-transparent text-white ${shiftColor(cal.shift_type).badge}`
                                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {shiftBadgeLetter(cal)} · {shiftLabel(cal)}{' '}
                                    <span className={dayCalendarId === cal.id ? 'font-mono opacity-80' : 'font-mono text-gray-400'}>
                                        {formatHours(cal)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {!dayCalendarId ? (
                        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                            Elige el turno del día primero.
                        </p>
                    ) : workPositionsList.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                            No hay atracciones ni puestos configurados para esta área todavía.
                        </p>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200">
                                {attractions.map((a) => (
                                    <button
                                        key={a}
                                        onClick={() => onSelectAttraction(a)}
                                        className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                            selectedAttraction === a
                                                ? 'border-[#a81c24] text-[#a81c24]'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {a}
                                    </button>
                                ))}
                            </div>
                            <div className="mb-5 flex flex-wrap items-center gap-2.5">
                                {positionsForSelectedAttraction.map((wp) => (
                                    <button
                                        key={wp.id}
                                        onClick={() => onSelectWorkPosition(wp.id)}
                                        className={`rounded-full border px-3.5 py-2 text-xs font-medium ${
                                            selectedWorkPositionId === wp.id
                                                ? 'border-[#a81c24] bg-[#a81c24] text-white'
                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {wp.name}
                                    </button>
                                ))}
                                {positionsForSelectedAttraction.length === 0 && (
                                    <p className="text-xs text-gray-400">No hay puestos activos en esta atracción.</p>
                                )}
                                {selectedWorkPositionId && (
                                    <span className="ml-1 flex items-center gap-2">
                                        <button onClick={() => onEditPosition(selectedWorkPositionId)} title="Editar puesto" className="text-gray-400 hover:text-gray-600">
                                            <Edit3 size={15} />
                                        </button>
                                        <button onClick={() => onDeletePosition(selectedWorkPositionId)} title="Eliminar puesto" className="text-gray-400 hover:text-red-600">
                                            <Trash2 size={15} />
                                        </button>
                                    </span>
                                )}
                            </div>
                            {!selectedWorkPositionId ? (
                                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                    Elige un puesto para asignar empleados este día.
                                </p>
                            ) : (
                                <div>
                                    <p className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">Empleados este día en este puesto</p>
                                    {(() => {
                                        const dayEmployees = assignmentsForDay(openDayISO).filter((r) => r.workPositionId === selectedWorkPositionId);
                                        const assignedTodayUids = new Set(assignmentsForDay(openDayISO).map((r) => r.employee.uid));
                                        const available = employeesList.filter((e) => !assignedTodayUids.has(e.uid));
                                        return (
                                            <>
                                                {dayEmployees.length === 0 && (
                                                    <p className="mb-3 text-xs text-gray-400">Agrega los empleados que trabajan este puesto hoy.</p>
                                                )}
                                                <div className="mb-3 flex flex-wrap gap-2">
                                                    {dayEmployees.map(({ employee }) => (
                                                        <span
                                                            key={employee.uid}
                                                            className="inline-flex items-center gap-2 rounded-full bg-gray-100 py-1.5 pr-2 pl-3.5 text-xs text-gray-700"
                                                        >
                                                            {employee.name}
                                                            <button
                                                                onClick={() => removeEmployee(employee.uid)}
                                                                title="Quitar de este día"
                                                                className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-600"
                                                            >
                                                                <X size={11} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="max-w-xs">
                                                    <EmployeeAutocomplete
                                                        items={available}
                                                        getLabel={(e) => e.name}
                                                        getSubLabel={(e) => e.cargo?.name ?? e.uid}
                                                        onSelect={(e) => addEmployee(e.uid)}
                                                        placeholder="Agregar empleado..."
                                                    />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
