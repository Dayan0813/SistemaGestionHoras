import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import NewCalendarInline, { emptyNewCalendarForm, type NewCalendarFormData } from './NewCalendarInline';

dayjs.extend(isSameOrBefore);
dayjs.locale('es');

/**
 * Parsea un string "YYYY-MM-DD" como fecha local. dayjs(string) delega en el
 * parser nativo de Date, que interpreta fechas sin hora como medianoche UTC;
 * en zonas horarias detrás de UTC (ej. Colombia, UTC-5) eso corre el día
 * mostrado un puesto hacia atrás (el 30 se ve como 29).
 */
const parseLocalDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return dayjs(new Date(year, month - 1, day));
};

type Holiday = {
    date: string;
    name: string;
};

type Calendar = {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom?: boolean;
    created_for_employee_uid?: string | null;
};

/** Forma del turno tal como lo devuelve POST /calendars (siempre con horario definido). */
type CreatedCalendar = {
    id: number;
    area_id: number;
    hora_entrada: string;
    hora_salida: string;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
};

type Props = {
    startDate: string;
    endDate: string;
    /** Turnos disponibles para asignar a un día puntual. Si se omite, la grilla es solo informativa. */
    calendars?: Calendar[];
    /** Turno asignado a días puntuales (fecha ISO -> id del turno). */
    dayOverrides?: Record<string, number>;
    /** Se llama al asignar (o quitar, con null) el turno de un día. Habilita el click en los días. */
    onDayOverrideChange?: (date: string, calendarId: number | null) => void;
    /** Área a la que pertenece el turno a crear. Requerido para poder crear turnos personalizados. */
    areaId?: number;
    /** UID del único empleado de este lote. Un turno personalizado necesita un dueño, así que solo se puede crear con exactamente un empleado seleccionado. */
    employeeUid?: string;
    /** Se llama cuando se crea un turno personalizado nuevo, para que el padre lo agregue a su lista de turnos. */
    onCalendarCreated?: (calendar: CreatedCalendar) => void;
};

export default function DateGrid({ startDate, endDate, calendars, dayOverrides, onDayOverrideChange, areaId, employeeUid, onCalendarCreated }: Props) {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeDay, setActiveDay] = useState<string | null>(null);

    const [creatingCustom, setCreatingCustom] = useState(false);
    const [newCalForm, setNewCalForm] = useState<NewCalendarFormData>(emptyNewCalendarForm);
    const [calendarSaving, setCalendarSaving] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);

    const interactive = !!onDayOverrideChange;

    const showGrid = startDate && endDate && parseLocalDate(startDate).isSameOrBefore(parseLocalDate(endDate));

    // =========================
    // Fetch festivos por rango
    // =========================
    useEffect(() => {
        if (!showGrid) return;

        setLoading(true);

        axios
            .get('/holidays/range', {
                params: { from: startDate, to: endDate },
            })
            .then((res) => {
                setHolidays(res.data.holidays || []);
            })
            .finally(() => setLoading(false));
    }, [startDate, endDate]);

    // =========================
    // Construir rango de días
    // =========================
    const days = useMemo(() => {
        if (!showGrid) return [];

        const list = [];
        let current = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);

        while (current.isSameOrBefore(end)) {
            list.push({
                date: current.format('YYYY-MM-DD'),
                day: current.format('DD'),
                weekday: current.day(), // 0 = domingo
                label: current.format('ddd'),
            });
            current = current.add(1, 'day');
        }

        return list;
    }, [startDate, endDate]);

    const isHoliday = (date: string) => holidays.some((h) => h.date === date);

    const handleDayClick = (date: string) => {
        if (!interactive) return;
        setActiveDay((prev) => (prev === date ? null : date));
    };

    const calendarLabel = (cal: Calendar) =>
        `${cal.shift_type} (${cal.hora_entrada?.slice(0, 5) ?? '--:--'} - ${cal.hora_salida?.slice(0, 5) ?? '--:--'})${cal.is_custom ? ' (personalizado)' : ''}`;

    const saveCustomCalendar = async () => {
        if (!areaId || !employeeUid || !activeDay) return;

        setCalendarSaving(true);
        setCalendarError(null);
        try {
            const res = await axios.post('/calendars', {
                ...newCalForm,
                area_id: areaId,
                is_custom: true,
                created_for_employee_uid: employeeUid,
            });
            const created: CreatedCalendar = res.data;

            onCalendarCreated?.(created);
            onDayOverrideChange?.(activeDay, created.id);
            setNewCalForm(emptyNewCalendarForm);
            setCreatingCustom(false);
        } catch (err: any) {
            setCalendarError(err?.response?.data?.message ?? 'No se pudo crear el turno.');
        } finally {
            setCalendarSaving(false);
        }
    };

    if (!showGrid) return null;

    return (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow">
            <h3 className="mb-3 font-semibold text-gray-700">
                Rango de fechas seleccionado
                {interactive && <span className="ml-2 text-xs font-normal text-gray-400">(click en un día para asignarle un turno específico)</span>}
            </h3>

            {loading ? (
                <p className="text-sm text-gray-500">Cargando festivos…</p>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {days.map((d) => {
                        const holiday = isHoliday(d.date);
                        const isSunday = d.weekday === 0;
                        const overrideCalendarId = dayOverrides?.[d.date];
                        const hasOverride = !!overrideCalendarId;

                        let bg = 'bg-green-100 text-green-800';
                        if (holiday) bg = 'bg-red-200 text-red-800';
                        else if (isSunday) bg = 'bg-yellow-200 text-yellow-800';
                        if (hasOverride) bg = 'bg-blue-200 text-blue-800';

                        return (
                            <div
                                key={d.date}
                                onClick={() => handleDayClick(d.date)}
                                className={`rounded-lg p-2 text-center text-sm font-semibold ${bg} ${interactive ? 'cursor-pointer hover:opacity-80' : ''} ${
                                    activeDay === d.date ? 'ring-2 ring-[#a81c24] ring-offset-1' : ''
                                }`}
                                title={
                                    hasOverride
                                        ? 'Turno específico asignado (click para cambiar)'
                                        : holiday
                                          ? 'Festivo'
                                          : isSunday
                                            ? 'Domingo'
                                            : interactive
                                              ? 'Click para asignar un turno específico'
                                              : 'Día laboral'
                                }
                            >
                                <div>{d.day}</div>
                                <div className="text-xs capitalize">{d.label}</div>
                                {hasOverride && <div className="mt-0.5 text-[10px]">✓ turno</div>}
                            </div>
                        );
                    })}
                </div>
            )}

            {interactive && activeDay && (
                <div className="mt-3 rounded-lg border border-[#a81c24] bg-[#fff7f0] p-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap text-gray-700">{parseLocalDate(activeDay).format('DD MMM')}:</span>

                        <select
                            className="flex-1 rounded border border-gray-300 px-2 py-1"
                            value={dayOverrides?.[activeDay] ?? ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                onDayOverrideChange?.(activeDay, value ? Number(value) : null);
                            }}
                        >
                            <option value="">Turno normal (sin cambio)</option>
                            {calendars?.map((cal) => (
                                <option key={cal.id} value={cal.id}>
                                    {calendarLabel(cal)}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveDay(null);
                                setCreatingCustom(false);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                            title="Cerrar"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </div>

                    {areaId && employeeUid ? (
                        creatingCustom ? (
                            <NewCalendarInline
                                form={newCalForm}
                                setForm={setNewCalForm}
                                saving={calendarSaving}
                                error={calendarError}
                                onCancel={() => setCreatingCustom(false)}
                                onSave={saveCustomCalendar}
                            />
                        ) : (
                            <button type="button" onClick={() => setCreatingCustom(true)} className="mt-1 text-xs font-semibold text-[#a81c24] hover:underline">
                                + Nuevo turno personalizado para este empleado
                            </button>
                        )
                    ) : (
                        !employeeUid && (
                            <p className="mt-1 text-xs text-gray-400">Selecciona un solo empleado para poder crear un turno personalizado.</p>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
