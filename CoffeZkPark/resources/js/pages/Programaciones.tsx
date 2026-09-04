import ConfirmModal from '@/Components/confirmModal';
import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Check, ChevronLeft, ChevronRight, Edit3, FileSpreadsheet, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AreaScheduleGrid from './Programations/AreaScheduleGrid';
import DayAssignmentCalendar from './Programations/DayAssignmentCalendar';
import {
    allIsoDatesInRange,
    batchCoversDay,
    contractTextColor,
    durationOptions,
    formatDay,
    formatHours,
    formatRangeLabel,
    getCalendarForDay,
    getProgramationForDay,
    initials,
    isoWeekday,
    monthCalendar,
    monthKey,
    newBatchId,
    shiftColor,
    toDate,
    toIsoDate,
} from './Programations/programaciones.helpers';
import ShiftPickerPopover from './Programations/ShiftPickerPopover';
import type {
    AnchorRect,
    Calendar,
    DraftBatch,
    DraftState,
    Employee,
    EmployeeSchedule,
    WorkPosition,
} from './Programations/programaciones.types';

export default function Programaciones() {
    const { auth, allAreas } = usePage().props as any;
    const areaId: number | null = auth?.user?.area_id ?? null;
    const areaName: string = auth?.user?.area_name ?? 'Sin área asignada';
    const schedulingMode: 'fijo' | 'variable' = auth?.user?.area_scheduling_mode === 'variable' ? 'variable' : 'fijo';
    // aux_th tiene "programaciones.ver" pero no "programaciones.crear": ve
    // únicamente la consulta de solo lectura por área, nunca el asistente de
    // creación (que de todos modos no podría enviar).
    const canCreate: boolean = auth?.user?.permissions?.includes('programaciones.crear') ?? false;

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
    const [selectedDates, setSelectedDates] = useState<string[]>(initialDraft.selectedDates ?? []);
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(initialDraft.selectedWeekdays ?? [1, 2, 3, 4, 5, 6, 7]);
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
    // Día abierto en la Vista previa (modo variable) para ver el detalle de quién trabaja qué
    // puesto ese día — es de solo lectura, a diferencia del panel del Paso 03.
    const [openPreviewDayISO, setOpenPreviewDayISO] = useState<string | null>(null);
    const [savingProgress, setSavingProgress] = useState<{ done: number; total: number } | null>(null);

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
    }, [
        draftKey,
        startDate,
        duration,
        selectedWeekdays,
        selectedDates,
        batches,
        selectedAttraction,
        selectedWorkPositionId,
    ]);

    // Orden por hora de entrada: en modo fijo el turno más temprano es "Apertura" y el más
    // tardío "Cierre" (así lo pidió el coordinador); en modo variable se numeran como
    // "Calendario A", "B", "C"... en ese mismo orden. shift_type (D/N) no cambia: sigue
    // alimentando lo que ya dependa de él (nómina/recargos); esto es solo la etiqueta visible.
    const sortedCalendars = useMemo(
        () => [...calendars].sort((a, b) => (a.hora_entrada ?? '').localeCompare(b.hora_entrada ?? '')),
        [calendars],
    );
    // "Apertura"/"Cierre" solo tiene sentido con exactamente 2 turnos (el caso normal en modo
    // fijo). Si alguna vez se crea un tercero, colapsaría con "Cierre" — mejor pasar a letras
    // (A, B, C...) igual que modo variable en vez de mostrar dos turnos distintos como "Cierre".
    const shiftLabel = (calendar: Calendar) => {
        const index = sortedCalendars.findIndex((c) => c.id === calendar.id);
        if (index === -1) return calendar.shift_type === 'D' ? 'Turno Diurno' : 'Turno Nocturno';
        if (schedulingMode === 'fijo' && sortedCalendars.length <= 2) return index === 0 ? 'Apertura' : 'Cierre';
        return `Calendario ${String.fromCharCode(65 + index)}`;
    };
    const shiftBadgeLetter = (calendar: Calendar) => {
        const index = sortedCalendars.findIndex((c) => c.id === calendar.id);
        if (index === -1) return calendar.shift_type;
        if (schedulingMode === 'fijo' && sortedCalendars.length <= 2) return index === 0 ? 'A' : 'C';
        return String.fromCharCode(65 + index);
    };

    // Atracciones disponibles en el área (valores distintos de work_positions.attraction).
    const attractions = useMemo(
        () => [...new Set(workPositionsList.map((wp) => wp.attraction).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [workPositionsList],
    );
    const positionPendingDeletion = workPositionsList.find((wp) => wp.id === deletingPosition) ?? null;

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
    const totalWeeks = Math.max(Math.ceil(duration / 7), 1);
    // Si cambia el período (Desde o Duración), vuelve a la primera página en vez de quedarse
    // en una página que puede ya no existir para el nuevo rango.
    useEffect(() => setWeekIndex(0), [startDate, duration]);
    useEffect(() => setOpenPreviewDayISO(null), [startDate, duration]);
    const calendarMonths = useMemo(() => [...new Set(rangeDates.map(monthKey))], [rangeDates]);
    const calendarPendingDeletion = calendars.find((c) => c.id === deletingCalendar) ?? null;
    const pendingCount = batches.reduce((sum, b) => sum + b.employeeUids.length, 0);

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
    }, [areaId]);

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
    const resolvePreviewAssignment = useCallback(
        (dayISO: string, uid: string): { workPositionId: number | null; calendarId: number | null; isDraft: boolean } => {
            const batch = batches.find((b) => b.employeeUids.includes(uid) && batchCoversDay(b, dayISO));
            if (batch) return { workPositionId: batch.workPositionId, calendarId: batch.calendarId, isDraft: true };
            const programation = getProgramationForDay(scheduleByEmployee[uid], dayISO);
            if (programation) return { workPositionId: programation.work_position_id, calendarId: getCalendarForDay(programation, dayISO).id, isDraft: false };
            return { workPositionId: null, calendarId: null, isDraft: false };
        },
        [batches, scheduleByEmployee],
    );

    const previewAssignmentsForDay = useCallback(
        (dayISO: string) =>
            employeesList
                .map((employee) => ({ employee, ...resolvePreviewAssignment(dayISO, employee.uid) }))
                .filter((row): row is { employee: Employee; workPositionId: number | null; calendarId: number; isDraft: boolean } => row.calendarId !== null),
        [employeesList, resolvePreviewAssignment],
    );

    // Turno pendiente (sin subir) para un empleado en una fecha ISO concreta — modo variable.
    // Solo mira los batches del puesto activo: cambiar de puesto no debe mostrar pintados de otro.
    const draftedCalendarForDate = useCallback(
        (uid: string, dayISO: string): Calendar | null => {
            const batch = batches.find(
                (b) => b.employeeUids.includes(uid) && b.workPositionId === selectedWorkPositionId && batchCoversDay(b, dayISO),
            );
            return batch ? (calendars.find((c) => c.id === batch.calendarId) ?? null) : null;
        },
        [batches, calendars, selectedWorkPositionId],
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
    const setEmployeeDate = (uid: string, dayISO: string, calendarId: number | null) => {
        setBatches((current) => {
            const next: DraftBatch[] = [];
            for (const b of current) {
                if (!b.employeeUids.includes(uid) || b.workPositionId !== selectedWorkPositionId || !batchCoversDay(b, dayISO)) {
                    next.push(b);
                    continue;
                }
                const others = b.employeeUids.filter((id) => id !== uid);
                if (others.length) next.push({ ...b, employeeUids: others });
                next.push(...splitOutDate(b, dayISO).map((piece) => ({ ...piece, employeeUids: [uid] })));
            }
            if (calendarId === null) return next;
            return [
                ...next,
                { id: newBatchId(), calendarId, workPositionId: selectedWorkPositionId, employeeUids: [uid], startDate: dayISO, endDate: dayISO },
            ];
        });
    };

    // Atajo modo fijo: pone (o quita) el mismo turno en TODAS las fechas reales visibles (según
    // los días de semana elegidos en el Paso 1) para un empleado, de una sola vez — equivalente
    // a "Todos los días". Pinta fecha por fecha (setEmployeeDate) para que cada día quede
    // independiente: un jueves puede tener un turno distinto de otro jueves.
    const setEmployeeAllSelectedWeekdays = (uid: string, calendarId: number | null) => {
        rangeDates
            .filter((date) => selectedWeekdays.includes(isoWeekday(date)))
            .forEach((date) => setEmployeeDate(uid, toIsoDate(date), calendarId));
    };

    // Un empleado "tiene" un turno si ya está guardado de verdad (hoy) O si lo tiene pendiente
    // en el borrador (en cualquier día) — así los filtros por calendario también encuentran lo
    // que acabas de armar y todavía no has subido.
    const hasDraft = useCallback((uid: string, calendarId?: number) => batches.some((b) => b.employeeUids.includes(uid) && (calendarId === undefined || b.calendarId === calendarId)), [batches]);

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

    // Envía todo el borrador al servidor, un batch a la vez. Los que fallan se quedan en el
    // borrador (no se pierden), pero ya NO frenan a los siguientes: un batch roto (ej. quedó
    // huérfano porque su puesto se eliminó) antes solo bloqueaba toda la cola detrás de él.
    const uploadDraft = () => {
        if (!areaId) return;

        // Blindaje: nunca enviar un batch sin empleados o (en modo fijo) sin
        // ningún día de la semana marcado — eso sería una "programación
        // vacía" que no debería llegar a guardarse.
        const validBatches = batches.filter((b) => b.employeeUids.length > 0 && (!b.workDays || b.workDays.length > 0));

        if (validBatches.length === 0) {
            notify('No hay ninguna programación con empleados y turno asignado para subir.');
            if (validBatches.length !== batches.length) setBatches([]);
            return;
        }

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
                        const warning = (page.props as any)?.flash?.warning;
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

    const discardDraft = () => {
        setBatches([]);
        setDiscardingDraft(false);
        notify('Borrador descartado');
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
        } catch (err: any) {
            notify(err?.response?.data?.message ?? 'No se pudo crear el turno');
        }
    };

    const deleteCalendar = async () => {
        if (!deletingCalendar) return;
        try {
            await axios.delete(route('calendars.destroy', deletingCalendar));
            setCalendars((cs) => cs.filter((c) => c.id !== deletingCalendar));
            notify('Turno eliminado correctamente');
        } catch (err: any) {
            notify(err?.response?.data?.message ?? 'No se pudo eliminar el turno');
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
        } catch (err: any) {
            // Los ya creados en este lote quedan (setWorkPositionsList ya corrió para esos); solo
            // se avisa del que falló para que el usuario corrija ese nombre y reintente.
            notify(err?.response?.data?.message ?? 'No se pudo crear el puesto');
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
        } catch (err: any) {
            notify(err?.response?.data?.message ?? 'No se pudo actualizar el puesto');
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
        } catch (err: any) {
            notify(err?.response?.data?.message ?? 'No se pudo eliminar el puesto');
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
            <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
                <header>
                    <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Consulta</p>
                    <h1 className="text-2xl font-semibold text-[#a81c24]">Programaciones</h1>
                </header>
                {otherAreasSection ?? (
                    <p className="text-sm text-gray-500">No hay áreas disponibles para consultar.</p>
                )}
            </div>
        );
    }

    if (!areaId) {
        return (
            <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
                {otherAreasSection}
                <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                    <p className="text-lg font-semibold text-gray-800">No tienes un área asignada</p>
                    <p className="mt-2 text-sm text-gray-500">Contacta a un administrador para que te asocie a un área y puedas programar turnos.</p>
                </div>
            </div>
        );
    }

    // Cuerpo de "Asigna el horario" del modo fijo (sin atracción/puesto de por medio). El modo
    // variable usa <DayAssignmentCalendar /> en su lugar — ver el Paso 03 más abajo.
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
                        <b className="ml-1 font-mono">
                            {assignableEmployees.filter((e) => !currentCalendarFor(e.uid) && !hasDraft(e.uid)).length}
                        </b>
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
                            onClick={() => setWeekIndex((p) => Math.max(p - 1, 0))}
                            disabled={weekIndex === 0}
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <button
                            onClick={() => setWeekIndex((p) => Math.min(p + 1, totalWeeks - 1))}
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
                                <th className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Empleado
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Cargo
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">
                                    Contrato
                                </th>
                                <th className="border-b border-gray-100 bg-gray-50 px-2 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">
                                    Todos los días
                                </th>
                                {visibleDates
                                    .filter((date) => selectedWeekdays.includes(isoWeekday(date)))
                                    .map((date) => (
                                        <th
                                            key={toIsoDate(date)}
                                            className="border-b border-gray-100 bg-gray-50 px-1.5 py-3 text-center text-[10px] font-bold text-gray-500 uppercase"
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
                            {employees.map((e) => {
                                return (
                                    <tr key={e.uid}>
                                        <td className="border-b border-gray-100 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                                                    {initials(e.name)}
                                                </span>
                                                <strong className="text-sm font-medium text-gray-900">{e.name}</strong>
                                            </div>
                                        </td>
                                        <td className="border-b border-gray-100 px-3 py-2 text-sm text-gray-600">{e.cargo?.name ?? '—'}</td>
                                        <td className="border-b border-gray-100 px-3 py-2 text-sm">
                                            {e.contrato?.name ? (
                                                <span className={contractTextColor(e.contrato.name)}>{e.contrato.name}</span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="border-b border-gray-100 px-2 py-2 text-center">
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
                                            </span>
                                        </td>
                                        {visibleDates
                                            .filter((date) => selectedWeekdays.includes(isoWeekday(date)))
                                            .map((date) => {
                                                const dayISO = toIsoDate(date);
                                                // Modo fijo: a propósito solo mira el borrador (no el ya-guardado como en
                                                // modo variable) — así se pidió dejarlo, sin cambios de comportamiento.
                                                // Pero cada fecha se pinta de forma independiente (no por día de la semana):
                                                // no todos los jueves tienen por qué llevar el mismo turno.
                                                const dayCalendar = draftedCalendarForDate(e.uid, dayISO);
                                                const dayColor = dayCalendar ? shiftColor(dayCalendar.shift_type) : null;
                                                const isOpen = openDayPicker?.uid === e.uid && openDayPicker?.dayISO === dayISO;
                                                return (
                                                    <td key={dayISO} className="relative border-b border-gray-100 px-1.5 py-2 text-center">
                                                        <button
                                                            onClick={(ev) => {
                                                                if (isOpen) {
                                                                    setOpenDayPicker(null);
                                                                    return;
                                                                }
                                                                const r = ev.currentTarget.getBoundingClientRect();
                                                                setOpenDayPicker({
                                                                    uid: e.uid,
                                                                    dayISO,
                                                                    rect: { top: r.top, left: r.left, width: r.width, bottom: r.bottom },
                                                                });
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
                                                        {isOpen && openDayPicker && (
                                                            <ShiftPickerPopover
                                                                rect={openDayPicker.rect}
                                                                calendars={calendars}
                                                                shiftLabel={shiftLabel}
                                                                shiftBadgeLetter={shiftBadgeLetter}
                                                                onPick={(calId) => {
                                                                    setEmployeeDate(e.uid, dayISO, calId);
                                                                    setOpenDayPicker(null);
                                                                }}
                                                                onClear={() => {
                                                                    setEmployeeDate(e.uid, dayISO, null);
                                                                    setOpenDayPicker(null);
                                                                }}
                                                                onClose={() => setOpenDayPicker(null)}
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
            {otherAreasSection}
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Planificación semanal</p>
                    <h1 className="text-2xl font-semibold text-[#a81c24]">Programación por turnos</h1>
                    <p className="mt-1 text-xs text-gray-500">
                        Los turnos y horarios disponibles pertenecen exclusivamente a <strong className="text-gray-700">{areaName}</strong>.
                    </p>
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
                <div className="w-full max-w-xs rounded-xl border border-[#a81c24] bg-white p-4 sm:w-72">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Área asignada</p>
                    <strong className="block text-sm text-gray-900">{areaName}</strong>
                    <label className="mt-3 block text-xs font-semibold text-gray-500">
                        Desde
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        />
                    </label>
                    <label className="mt-3 block text-xs font-semibold text-gray-500">
                        Duración
                        <select
                            value={duration}
                            onChange={(event) => setDuration(Number(event.target.value))}
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

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="m-0 text-sm text-gray-700">
                    {pendingCount > 0 ? (
                        <>
                            <strong>{pendingCount}</strong> empleado{pendingCount > 1 ? 's' : ''} en el borrador, sin subir todavía.
                        </>
                    ) : (
                        'No hay cambios pendientes por subir.'
                    )}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        disabled={!pendingCount}
                        onClick={() => setDiscardingDraft(true)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Descartar borrador
                    </button>
                    <button
                        disabled={!pendingCount || !!savingProgress}
                        onClick={uploadDraft}
                        className="flex items-center gap-1.5 rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Upload size={14} />
                        {savingProgress ? `Subiendo ${savingProgress.done + 1}/${savingProgress.total}…` : 'Subir programación'}
                    </button>
                </div>
            </div>

            <section>
                <div className="mb-4 flex items-center gap-3">
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
                {schedulingMode === 'variable' ? (
                    <div className="flex flex-wrap gap-4">
                        {calendarMonths.map((month) => (
                            <div key={month} className="min-w-[100px]min-h-[300px] max-w-xl flex-1 rounded-xl border border-gray-200 bg-white p-4">
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
                                                    setSelectedDates((current) =>
                                                        current.includes(iso) ? current.filter((item) => item !== iso) : [...current, iso],
                                                    )
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
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-500">
                            Así queda el calendario con los días elegidos abajo (solo referencia, se edita con los botones):
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {calendarMonths.map((month) => (
                                <div key={month} className="min-w-[100px] min-h-[300px] max-w-xl flex-1 rounded-xl border border-gray-200 bg-white p-4">
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
                                            const isWorkDay = inRange && selectedWeekdays.includes(isoWeekday(date));
                                            const isWeekendDay = isoWeekday(date) === 6 || isoWeekday(date) === 7;
                                            return (
                                                <span
                                                    key={iso}
                                                    className={`flex aspect-square items-center justify-center rounded-md text-xs font-medium ${
                                                        isWorkDay
                                                            ? isWeekendDay
                                                                ? 'bg-amber-500 text-white'
                                                                : 'bg-[#95c020] text-white'
                                                            : inRange
                                                              ? 'text-gray-700'
                                                              : 'text-gray-300'
                                                    }`}
                                                >
                                                    {date.getDate()}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="mb-3 text-xs text-gray-500">
                                Elige los días de la semana que se repiten durante todo el período seleccionado.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => {
                                    const iso = index + 1;
                                    const active = selectedWeekdays.includes(iso);
                                    const isWeekend = iso === 6 || iso === 7;
                                    return (
                                        <button
                                            key={iso}
                                            onClick={() =>
                                                setSelectedWeekdays((current) =>
                                                    current.includes(iso) ? current.filter((d) => d !== iso) : [...current, iso],
                                                )
                                            }
                                            className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold ${
                                                active
                                                    ? isWeekend
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-[#95c020] text-white'
                                                    : 'border border-gray-300 text-gray-600 hover:bg-[#eaf3d3]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5])}
                                className="mt-3 text-xs font-semibold text-[#a81c24] hover:underline"
                            >
                                Lunes a Viernes
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <section>
                <div className="mb-4 flex flex-wrap items-center gap-3">
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
                                <div key={item.id} className="group flex items-center gap-3 px-4 py-3">
                                    <span className={`h-2 w-2 flex-none rounded-full ${color.dot}`} />
                                    <span className="w-5 flex-none font-mono text-xs font-bold text-gray-400">{shiftBadgeLetter(item)}</span>
                                    <span className="flex-1 text-sm font-medium text-gray-800">{shiftLabel(item)}</span>
                                    <span className="flex-none font-mono text-xs text-gray-500">{formatHours(item)}</span>
                                    <span className="flex flex-none items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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

            <section>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-[#eaf3d3] px-2.5 py-1.5 font-mono text-sm font-semibold text-[#5e7a15]">03</span>
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Tercer paso</p>
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
                        onSetEmployeeDate={setEmployeeDate}
                    />
                )}
            </section>

            <section>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Resultado en vivo</p>
                        <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {schedulingMode === 'fijo' && totalWeeks > 1 && (
                            <div className="flex items-center gap-2 text-sm text-gray-800">
                                <button
                                    disabled={weekIndex === 0}
                                    onClick={() => setWeekIndex((index) => Math.max(index - 1, 0))}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#a81c24]"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-semibold whitespace-nowrap">{formatRangeLabel(visibleDates)}</span>
                                <button
                                    disabled={weekIndex === totalWeeks - 1}
                                    onClick={() => setWeekIndex((index) => Math.min(index + 1, totalWeeks - 1))}
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
                    <div>
                        <div className="flex flex-wrap gap-4">
                            {calendarMonths.map((month) => (
                                <div key={month} className="min-w-[1000px] min-h-[40px] max-w-xl flex-1 rounded-xl border border-gray-200 bg-white p-4">
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
                                            const rows = inRange ? previewAssignmentsForDay(iso) : [];
                                            const hasDraftRow = rows.some((r) => r.isDraft);
                                            const dayCalendar = rows[0] ? calendars.find((c) => c.id === rows[0].calendarId) : null;
                                            const isOpen = openPreviewDayISO === iso;
                                            return (
                                                <button
                                                    key={iso}
                                                    disabled={!inRange}
                                                    onClick={() => setOpenPreviewDayISO((cur) => (cur === iso ? null : iso))}
                                                    title={iso}
                                                    className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors ${
                                                        !inRange ? 'text-gray-300' : isOpen ? 'bg-[#a81c24] text-white' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span>{date.getDate()}</span>
                                                    {rows.length > 0 && (
                                                        <span className={`flex items-center gap-0.5 text-[9px] font-bold ${isOpen ? 'text-white' : 'text-gray-500'}`}>
                                                            <i
                                                                className={`inline-block h-1.5 w-1.5 rounded-full ${
                                                                    isOpen ? 'bg-white' : dayCalendar ? shiftColor(dayCalendar.shift_type).dot : 'bg-gray-400'
                                                                } ${!isOpen && hasDraftRow ? 'opacity-60' : ''}`}
                                                            />
                                                            {rows.length}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {openPreviewDayISO && (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900 capitalize">
                                        {toDate(openPreviewDayISO).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h3>
                                    <button onClick={() => setOpenPreviewDayISO(null)} title="Cerrar" className="text-gray-400 hover:text-gray-600">
                                        <X size={16} />
                                    </button>
                                </div>
                                {(() => {
                                    const rows = previewAssignmentsForDay(openPreviewDayISO);
                                    if (rows.length === 0) {
                                        return <p className="text-sm text-gray-500">Nadie tiene turno asignado este día.</p>;
                                    }
                                    return (
                                        <div className="divide-y divide-gray-100">
                                            {rows.map(({ employee, workPositionId, calendarId, isDraft }) => {
                                                const cal = calendars.find((c) => c.id === calendarId) ?? null;
                                                const wp = workPositionId ? workPositionsList.find((p) => p.id === workPositionId) : null;
                                                return (
                                                    <div key={employee.uid} className="flex items-center gap-3 py-2.5">
                                                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                                                            {initials(employee.name)}
                                                        </span>
                                                        <div className="flex min-w-0 flex-1 items-baseline gap-2">
                                                            <strong className="flex-none text-sm text-gray-900">{employee.name}</strong>
                                                            <span className="min-w-0 truncate text-xs text-neutral-500">
                                                                {wp ? `${wp.attraction} · ${wp.name}` : '—'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-none items-center gap-2">
                                                            <span
                                                                className={`flex-none rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                                                                    employee.cargo?.name ? 'bg-gray-100 text-gray-600' : 'text-gray-300'
                                                                }`}
                                                            >
                                                                {employee.cargo?.name ?? '—'}
                                                            </span>
                                                            {cal && (
                                                                <span
                                                                    className={`inline-flex flex-none items-center gap-1 rounded px-2 py-1.5 font-mono text-[10px] ${
                                                                        isDraft
                                                                            ? `border border-dashed ${shiftColor(cal.shift_type).border} ${shiftColor(cal.shift_type).text}`
                                                                            : `text-white ${shiftColor(cal.shift_type).badge}`
                                                                    }`}
                                                                    title={isDraft ? 'Pendiente por subir' : 'Ya guardado'}
                                                                >
                                                                    <b className="font-sans text-xs font-semibold">{shiftBadgeLetter(cal)}</b>
                                                                    {formatHours(cal)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                ) : (
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
                                            <span>
                                                <strong className="block text-gray-900">{e.name}</strong>
                                            </span>
                                        </td>
                                        {visibleDates.map((date) => {
                                            const dayISO = toIsoDate(date);
                                            const programation = getProgramationForDay(scheduleByEmployee[e.uid], dayISO);
                                            const cellCalendar = programation ? getCalendarForDay(programation, dayISO) : null;
                                            const draftBatch = !cellCalendar
                                                ? batches.find((b) => b.employeeUids.includes(e.uid) && batchCoversDay(b, dayISO))
                                                : undefined;
                                            const draftCellCalendar = draftBatch ? (calendars.find((c) => c.id === draftBatch.calendarId) ?? null) : null;
                                            return (
                                                <td key={dayISO} className="border-b border-gray-100 px-2 py-3 text-center text-[10px]">
                                                    {cellCalendar ? (
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded px-2 py-1.5 font-mono text-white ${shiftColor(cellCalendar.shift_type).badge}`}
                                                        >
                                                            <b className="font-sans text-xs font-semibold">{shiftBadgeLetter(cellCalendar)}</b>
                                                            {formatHours(cellCalendar)}
                                                        </span>
                                                    ) : draftCellCalendar ? (
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded border border-dashed px-2 py-1.5 font-mono ${shiftColor(draftCellCalendar.shift_type).border} ${shiftColor(draftCellCalendar.shift_type).text}`}
                                                            title="Pendiente por subir"
                                                        >
                                                            <b className="font-sans text-xs font-semibold">{shiftBadgeLetter(draftCellCalendar)}</b>
                                                            {formatHours(draftCellCalendar)}
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
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="font-bold text-gray-800"></span>
                    {calendars.map((item) => (
                        <span key={item.id} className="flex items-center gap-1">
                            <i className={`inline-block h-2 w-2 rounded-full ${shiftColor(item.shift_type).dot}`} />{' '}
                            {shiftLabel(item)} <code className="font-mono text-gray-700">{formatHours(item)}</code>
                        </span>
                    ))}
                    <span className="flex items-center gap-1">
                        <i className="inline-block h-2 w-2 rounded-full bg-gray-300" /> Libre / sin asignar
                    </span>
                    <span className="flex items-center gap-1">
                        <i className="inline-block h-2 w-2 rounded-full border border-dashed border-gray-400" /> Punteado = en el borrador, sin subir
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
                            <h2 className="text-xl font-semibold text-gray-900">Editar {shiftLabel(current)}</h2>
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
            {creatingCalendar && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                    <form className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-xl" onSubmit={createCalendar}>
                        <button
                            type="button"
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            onClick={() => setCreatingCalendar(false)}
                        >
                            <X size={18} />
                        </button>
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del turno</p>
                        <h2 className="text-xl font-semibold text-gray-900">Nuevo turno</h2>
                        <p className="mt-1 mb-6 text-sm text-gray-500">
                            Define el horario de este turno para {areaName}. Va a quedar disponible para toda el área.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-bold text-gray-600">
                                Hora de inicio
                                <input
                                    name="start"
                                    type="time"
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                            <label className="text-xs font-bold text-gray-600">
                                Hora de fin
                                <input
                                    name="end"
                                    type="time"
                                    required
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </label>
                        </div>
                        <label className="mt-3 block text-xs font-bold text-gray-600">
                            Tipo
                            <select
                                name="shift_type"
                                defaultValue="D"
                                required
                                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                            >
                                <option value="D">Diurno</option>
                                <option value="N">Nocturno</option>
                            </select>
                        </label>
                        <p className="mt-1 text-xs text-gray-400">Diurno/Nocturno alimenta el cálculo de recargos en nómina; no cambia el nombre que ves en pantalla.</p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCreatingCalendar(false)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">Crear turno</button>
                        </div>
                    </form>
                </div>
            )}
            {editingPosition !== null && (() => {
                const current = workPositionsList.find((p) => p.id === editingPosition);
                if (!current) return null;
                return (
                    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                        <form className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-xl" onSubmit={savePosition}>
                            <button
                                type="button"
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                                onClick={() => setEditingPosition(null)}
                            >
                                <X size={18} />
                            </button>
                            <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del puesto</p>
                            <h2 className="text-xl font-semibold text-gray-900">Editar {current.name}</h2>
                            <div className="mt-6 space-y-3">
                                <label className="block text-xs font-bold text-gray-600">
                                    Atracción
                                    <input
                                        name="attraction"
                                        list="attractions-list"
                                        defaultValue={current.attraction}
                                        required
                                        className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-600">
                                    Puesto
                                    <input
                                        name="name"
                                        defaultValue={current.name}
                                        required
                                        className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                    <input name="active" type="checkbox" defaultChecked={current.active} className="h-4 w-4" />
                                    Activo
                                </label>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingPosition(null)}
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
            {creatingPosition && (
                <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
                    <form className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-xl" onSubmit={createPosition}>
                        <button
                            type="button"
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            onClick={() => setCreatingPosition(false)}
                        >
                            <X size={18} />
                        </button>
                        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Configuración del puesto</p>
                        <h2 className="text-xl font-semibold text-gray-900">Nueva atracción / puesto</h2>
                        <p className="mt-1 mb-6 text-sm text-gray-500">
                            Si la atracción ya existe, escribe el mismo nombre para agrupar el puesto ahí.
                        </p>
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-600">
                                Atracción
                                <input
                                    name="attraction"
                                    list="attractions-list"
                                    defaultValue={selectedAttraction ?? ''}
                                    required
                                    placeholder="Ej. Zona A"
                                    className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                                <datalist id="attractions-list">
                                    {attractions.map((a) => (
                                        <option key={a} value={a} />
                                    ))}
                                </datalist>
                            </label>
                            <div>
                                <p className="mb-1.5 text-xs font-bold text-gray-600">Puesto{newPositionNames.length > 1 ? 's' : ''}</p>
                                <div className="space-y-2">
                                    {newPositionNames.map((value, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                value={value}
                                                onChange={(e) =>
                                                    setNewPositionNames((names) =>
                                                        names.map((n, i) => (i === index ? e.target.value : n)),
                                                    )
                                                }
                                                autoFocus={index === 0}
                                                placeholder={`Ej. Aux${index + 1}`}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                            />
                                            {newPositionNames.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPositionNames((names) => names.filter((_, i) => i !== index))}
                                                    title="Quitar este puesto"
                                                    className="flex-none text-gray-400 hover:text-red-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNewPositionNames((names) => [...names, ''])}
                                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#a81c24] hover:underline"
                                >
                                    <Plus size={12} /> Agregar otro puesto
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCreatingPosition(false)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white">
                                {newPositionNames.filter((n) => n.trim()).length > 1 ? 'Crear puestos' : 'Crear puesto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {toast && (
                <div className="fixed right-6 bottom-6 z-30 flex items-center gap-2 rounded-lg bg-[#5e7a15] px-4 py-3 text-sm text-white shadow-lg">
                    <Check size={16} /> {toast}
                </div>
            )}
            <ConfirmModal
                show={deletingCalendar !== null}
                title="Eliminar turno"
                message={`¿Eliminar "${calendarPendingDeletion ? shiftLabel(calendarPendingDeletion) : 'este turno'}"? Esta acción no se puede deshacer. Si el turno ya tiene programaciones asociadas, no se podrá eliminar.`}
                onConfirm={deleteCalendar}
                onClose={() => setDeletingCalendar(null)}
            />
            <ConfirmModal
                show={discardingDraft}
                title="Descartar borrador"
                message={`Vas a quitar ${pendingCount} empleado${pendingCount === 1 ? '' : 's'} pendientes por subir. Esta acción no se puede deshacer.`}
                onConfirm={discardDraft}
                onClose={() => setDiscardingDraft(false)}
            />
            <ConfirmModal
                show={deletingPosition !== null}
                title="Eliminar puesto"
                message={`¿Eliminar "${positionPendingDeletion ? positionPendingDeletion.name : 'este puesto'}"? Esta acción no se puede deshacer. Si el puesto ya tiene programaciones asociadas, no se podrá eliminar.`}
                onConfirm={deletePosition}
                onClose={() => setDeletingPosition(null)}
            />
        </div>
    );
}
Programaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="programaciones">{page}</MainLayout>;
