import EmployeeAutocomplete from '@/pages/WorkConsolidation/EmployeeAutocomplete';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
    batchCoversDay,
    formatHours,
    getCalendarForDay,
    getProgramationForDay,
    getWorkPositionIdForDay,
    monthCalendar,
    shiftColor,
    toDate,
    toIsoDate,
} from './programaciones.helpers';
import type { Calendar, DraftBatch, Employee, EmployeeSchedule, WorkPosition } from './programaciones.types';

// Paso 02 en modo variable: un calendario mensual donde cada día se abre, en dos modales
// seguidos, para asignar empleado + puesto. Todas las atracciones/puestos de un área
// comparten un solo turno por día (regla del negocio), así que el turno se elige UNA vez
// por día (modal 1) antes de pasar a elegir empleados y puesto (modal 2) — al asignar un
// empleado a un puesto ese día, hereda ese turno.
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
    absenceForDay,
    onSetEmployeeDate,
    onEditCalendar,
    onCreateCalendar,
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
    // Ausencia (vacaciones/incapacidad) ACTIVA de un empleado en una fecha ISO concreta — para
    // que el selector de "agregar empleado" de un día no ofrezca a quien está de ausencia ese día.
    absenceForDay: (uid: string, dayISO: string) => 'vacaciones' | 'incapacidad' | null;
    onSetEmployeeDate: (uid: string, dayISO: string, calendarId: number | null, workPositionId?: number | null) => void;
    // Gestión de turnos (crear/editar) directamente desde el modal "Elige el turno del día" —
    // reemplaza a la sección "Turnos disponibles" que antes vivía aparte, arriba del calendario.
    onEditCalendar: (id: number) => void;
    onCreateCalendar: () => void;
}) {
    const [openDayISO, setOpenDayISO] = useState<string | null>(null);
    const [dayCalendarId, setDayCalendarId] = useState<number | null>(null);
    // 'shift': modal 1 (elegir el turno del día). 'employees': modal 2 (elegir puesto + empleados).
    const [step, setStep] = useState<'shift' | 'employees'>('shift');
    // Si el coordinador marca "usar el mismo turno", se recuerda acá y los próximos días SIN
    // turno propio ya asignado saltan directo al modal de empleados con este turno puesto —
    // sin repetir el modal 1. Un día que YA tiene turno (guardado o en el borrador) siempre
    // muestra el modal 1 con el suyo propio primero, para no pisarlo por accidente.
    const [rememberChoice, setRememberChoice] = useState(false);
    const [rememberedCalendarId, setRememberedCalendarId] = useState<number | null>(null);

    // A qué puesto (y con qué turno) está asignado un empleado un día concreto: el borrador
    // manda si lo tocaste hoy; si no, se mira lo que ya está guardado de verdad.
    const resolveDayAssignment = (dayISO: string, uid: string): { workPositionId: number | null; calendarId: number | null } => {
        const batch = batches.find((b) => b.employeeUids.includes(uid) && batchCoversDay(b, dayISO));
        if (batch) return { workPositionId: batch.workPositionId, calendarId: batch.calendarId };
        const programation = getProgramationForDay(scheduleByEmployee[uid], dayISO);
        if (programation)
            return { workPositionId: getWorkPositionIdForDay(programation, dayISO), calendarId: getCalendarForDay(programation, dayISO).id };
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
    const dayCalendar = dayCalendarId ? (calendars.find((c) => c.id === dayCalendarId) ?? null) : null;

    const openDay = (dayISO: string) => {
        setOpenDayISO(dayISO);
        const existingCalendarId = daySummary(dayISO).calendarId;
        if (existingCalendarId) {
            setDayCalendarId(existingCalendarId);
            setStep('shift');
        } else if (rememberedCalendarId) {
            setDayCalendarId(rememberedCalendarId);
            setStep('employees');
        } else {
            setDayCalendarId(null);
            setStep('shift');
        }
    };

    const closeDayModal = () => {
        setOpenDayISO(null);
        setDayCalendarId(null);
    };

    // Cambiar el turno del día con gente ya asignada la re-etiqueta a todos — nunca puede
    // quedar gente en el mismo día con turnos distintos. Se pasa el workPositionId propio de
    // CADA empleado (row.workPositionId): si no, todos quedarían reasignados al puesto que esté
    // seleccionado en la pestaña en ese momento, sin importar en cuál estaban de verdad. Elegir
    // un turno pasa directo al modal de empleados: es el siguiente paso natural del flujo.
    const pickDayCalendar = (calendarId: number) => {
        if (!openDayISO) return;
        setDayCalendarId(calendarId);
        setRememberedCalendarId(rememberChoice ? calendarId : null);
        assignmentsForDay(openDayISO).forEach((row) => onSetEmployeeDate(row.employee.uid, openDayISO, calendarId, row.workPositionId));
        setStep('employees');
    };

    // Un puesto solo puede tener UN empleado por día: si ya había alguien, elegir uno nuevo lo
    // reemplaza en vez de sumarse (primero se libera al que estaba, con su propio turno intacto
    // por si sigue trabajando otro puesto ese día).
    const addEmployee = (uid: string) => {
        if (!openDayISO || !dayCalendarId || !selectedWorkPositionId) return;
        const currentOccupant = assignmentsForDay(openDayISO).find((r) => r.workPositionId === selectedWorkPositionId);
        if (currentOccupant) {
            onSetEmployeeDate(currentOccupant.employee.uid, openDayISO, null, selectedWorkPositionId);
        }
        onSetEmployeeDate(uid, openDayISO, dayCalendarId);
    };

    const removeEmployee = (uid: string) => {
        if (!openDayISO) return;
        onSetEmployeeDate(uid, openDayISO, null);
    };

    return (
        <div>
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
                                const summary = daySummary(iso);
                                const summaryCalendar = summary.calendarId ? calendars.find((c) => c.id === summary.calendarId) : null;
                                const isOpen = openDayISO === iso;
                                return (
                                    <button
                                        key={iso}
                                        disabled={!inRange}
                                        onClick={() => openDay(iso)}
                                        title={iso}
                                        className={`flex h-9 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors ${
                                            !inRange ? 'text-gray-300' : isOpen ? 'bg-[#a81c24] text-white' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span>{date.getDate()}</span>
                                        {summary.count > 0 && (
                                            <span
                                                className={`flex items-center gap-0.5 text-[9px] font-bold ${isOpen ? 'text-white' : 'text-gray-500'}`}
                                            >
                                                <i
                                                    className={`inline-block h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-white' : summaryCalendar ? shiftColor(summaryCalendar.shift_type).dot : 'bg-gray-400'}`}
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

            {openDayISO && step === 'shift' && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={closeDayModal}>
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={closeDayModal}
                            title="Cerrar"
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
                        >
                            <X size={18} />
                        </button>
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <p className="text-xs font-bold tracking-widest text-gray-400 capitalize uppercase">
                                {toDate(openDayISO).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <button
                                type="button"
                                onClick={onCreateCalendar}
                                className="flex flex-none items-center gap-1 text-xs font-bold text-[#a81c24] hover:underline"
                            >
                                <Plus size={13} /> Nuevo turno
                            </button>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Elige el turno del día</h2>

                        {calendars.length === 0 ? (
                            <p className="mt-7 text-sm text-gray-500">
                                No hay turnos configurados todavía.{' '}
                                <button type="button" onClick={onCreateCalendar} className="font-semibold text-[#a81c24] hover:underline">
                                    Crea el primero
                                </button>
                                .
                            </p>
                        ) : (
                            <div className="mt-7 flex flex-wrap gap-2.5">
                                {calendars.map((cal) => (
                                    <span
                                        key={cal.id}
                                        className={`group flex items-center gap-1 rounded-full border pr-1.5 pl-3.5 text-xs font-medium transition-colors ${
                                            dayCalendarId === cal.id
                                                ? `border-transparent text-white ${shiftColor(cal.shift_type).badge}`
                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <button onClick={() => pickDayCalendar(cal.id)} className="flex items-center gap-1.5 py-2">
                                            {shiftBadgeLetter(cal)} · {shiftLabel(cal)}{' '}
                                            <span className={dayCalendarId === cal.id ? 'font-mono opacity-80' : 'font-mono text-gray-400'}>
                                                {formatHours(cal)}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onEditCalendar(cal.id)}
                                            title="Editar turno"
                                            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 ${
                                                dayCalendarId === cal.id ? 'hover:bg-black/10' : 'hover:bg-gray-100'
                                            }`}
                                        >
                                            <Edit3 size={11} className={dayCalendarId === cal.id ? 'text-white' : 'text-gray-400'} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {calendars.length > 0 && (
                            <label className="mt-5 flex items-center gap-2 text-xs font-medium text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={rememberChoice}
                                    onChange={(e) => {
                                        setRememberChoice(e.target.checked);
                                        setRememberedCalendarId(e.target.checked ? dayCalendarId : null);
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-[#a81c24] focus:ring-[#a81c24]/30"
                                />
                                Usar el mismo turno en los próximos días (sin volver a preguntar)
                            </label>
                        )}

                        {dayCalendarId && (
                            <button
                                onClick={() => setStep('employees')}
                                className="mt-5 w-full rounded-md bg-[#a81c24] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#c9252d]"
                            >
                                Continuar a empleados y puestos
                            </button>
                        )}
                    </div>
                </div>
            )}

            {openDayISO && step === 'employees' && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={closeDayModal}>
                    <div
                        className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-8 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={closeDayModal}
                            title="Cerrar"
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
                        >
                            <X size={18} />
                        </button>
                        <p className="mb-2 text-xs font-bold tracking-widest text-gray-400 capitalize uppercase">
                            {toDate(openDayISO).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <div className="mb-7 flex items-center gap-2.5">
                            <h2 className="text-xl font-semibold text-gray-900">Empleados y puestos</h2>
                            {dayCalendar && (
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold text-white ${shiftColor(dayCalendar.shift_type).badge}`}
                                >
                                    {shiftBadgeLetter(dayCalendar)} {formatHours(dayCalendar)}
                                </span>
                            )}
                            <button onClick={() => setStep('shift')} className="ml-auto text-xs font-semibold text-[#a81c24] hover:underline">
                                Cambiar turno
                            </button>
                        </div>

                        {workPositionsList.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                No hay atracciones ni puestos configurados para esta área todavía.
                            </p>
                        ) : (
                            <>
                                <div className="mb-5 flex flex-wrap gap-2 border-b border-gray-200">
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
                                <div className="mb-6 flex flex-wrap items-center gap-2.5">
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
                                            <button
                                                onClick={() => onEditPosition(selectedWorkPositionId)}
                                                title="Editar puesto"
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                            <button
                                                onClick={() => onDeletePosition(selectedWorkPositionId)}
                                                title="Eliminar puesto"
                                                className="text-gray-400 hover:text-red-600"
                                            >
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
                                        <p className="mb-4 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                            Empleado asignado este día (un puesto, un empleado)
                                        </p>
                                        {(() => {
                                            const dayEmployees = assignmentsForDay(openDayISO).filter(
                                                (r) => r.workPositionId === selectedWorkPositionId,
                                            );
                                            const assignedTodayUids = new Set(assignmentsForDay(openDayISO).map((r) => r.employee.uid));
                                            const available = employeesList.filter(
                                                (e) => !assignedTodayUids.has(e.uid) && !absenceForDay(e.uid, openDayISO),
                                            );
                                            return (
                                                <>
                                                    {dayEmployees.length === 0 && (
                                                        <p className="mb-4 text-xs text-gray-400">Agrega el empleado que trabaja este puesto hoy.</p>
                                                    )}
                                                    <div className="mb-4 flex flex-wrap gap-2">
                                                        {dayEmployees.map(({ employee }) => (
                                                            <span
                                                                key={employee.uid}
                                                                className="inline-flex items-center gap-2 rounded-full bg-gray-100 py-1.5 pr-2 pl-3.5 text-xs text-gray-700"
                                                            >
                                                                {employee.name}
                                                                {employee.cargo?.name && (
                                                                    <span className="text-gray-400">· {employee.cargo.name}</span>
                                                                )}
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
                                                    <div className="max-w-sm">
                                                        <EmployeeAutocomplete
                                                            items={available}
                                                            getLabel={(e) => e.name}
                                                            getSubLabel={(e) => e.cargo?.name ?? e.uid}
                                                            onSelect={(e) => addEmployee(e.uid)}
                                                            placeholder={
                                                                dayEmployees.length > 0 ? 'Cambiar por otro empleado...' : 'Agregar empleado...'
                                                            }
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </>
                        )}
                        <button
                            onClick={closeDayModal}
                            className="mt-8 w-full rounded-md bg-[#a81c24] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#c9252d]"
                        >
                            Guardar y cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
