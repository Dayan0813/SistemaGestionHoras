import axios from 'axios';
import dayjs from 'dayjs';
import { CalendarDays, Pencil, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

interface WorkPosition {
    id: number;
    name: string;
}

interface Programation {
    id: number;
    calendar_id: number;
    work_position_id: number | null;
    start_date: string;
    end_date: string;
    status: string;
    calendar: Calendar;
}

interface Props {
    employeeUid: string;
    employeeName: string;
    areaId: number;
    calendars: Calendar[];
    programations: Programation[];
    onClose: () => void;
    onChanged: () => void;
    onCalendarCreated?: () => void;
}

const calendarLabel = (calendar: Calendar) => {
    if (!calendar.hora_entrada || !calendar.hora_salida) {
        return 'Horario no definido';
    }
    return `${calendar.hora_entrada.slice(0, 5)} - ${calendar.hora_salida.slice(0, 5)}`;
};

const optionLabel = (calendar: Calendar) => (calendar.is_custom ? `${calendarLabel(calendar)} (personalizado)` : calendarLabel(calendar));

const formatDate = (value: string) => dayjs(value).format('DD/MM/YYYY');
const toISODate = (value: string) => dayjs(value).format('YYYY-MM-DD');

const emptyCalendarForm = { hora_entrada: '', hora_salida: '', shift_type: 'D' as 'D' | 'N' };

interface NewCalendarInlineProps {
    form: typeof emptyCalendarForm;
    setForm: (form: typeof emptyCalendarForm) => void;
    saving: boolean;
    error: string | null;
    onCancel: () => void;
    onSave: () => void;
}

function NewCalendarInline({ form, setForm, saving, error, onCancel, onSave }: NewCalendarInlineProps) {
    return (
        <div className="mt-2 space-y-2 rounded border border-dashed border-gray-300 p-2">
            <div className="flex gap-2">
                <div className="w-1/3">
                    <label className="block text-xs font-semibold text-gray-600">Entrada</label>
                    <input
                        type="time"
                        value={form.hora_entrada}
                        onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-xs font-semibold text-gray-600">Salida</label>
                    <input
                        type="time"
                        value={form.hora_salida}
                        onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-xs font-semibold text-gray-600">Tipo</label>
                    <select
                        value={form.shift_type}
                        onChange={(e) => setForm({ ...form, shift_type: e.target.value as 'D' | 'N' })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                        <option value="D">Diurno</option>
                        <option value="N">Nocturno</option>
                    </select>
                </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
                    Cancelar
                </button>
                <button
                    onClick={onSave}
                    disabled={saving || !form.hora_entrada || !form.hora_salida}
                    className="rounded border border-[#95c020] px-2 py-1 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                >
                    {saving ? 'Creando…' : 'Crear y usar'}
                </button>
            </div>
        </div>
    );
}

export default function ManageProgramationsModal({ employeeUid, employeeName, areaId, calendars, programations, onClose, onChanged, onCalendarCreated }: Props) {
    const [workPositions, setWorkPositions] = useState<WorkPosition[]>([]);
    const [localCalendars, setLocalCalendars] = useState<Calendar[]>(calendars);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<{ calendar_id: number | ''; work_position_id: number | ''; start_date: string; end_date: string }>({
        calendar_id: '',
        work_position_id: '',
        start_date: '',
        end_date: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [applyingId, setApplyingId] = useState<number | null>(null);
    const [applyCalendarId, setApplyCalendarId] = useState<number | ''>('');
    const [applyDates, setApplyDates] = useState<string[]>(['']);
    const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

    const [creatingCalendarFor, setCreatingCalendarFor] = useState<'edit' | 'apply' | null>(null);
    const [newCalForm, setNewCalForm] = useState(emptyCalendarForm);
    const [calendarSaving, setCalendarSaving] = useState(false);
    const [calendarError, setCalendarError] = useState<string | null>(null);

    useEffect(() => {
        axios.get(`/workPositions/area/${areaId}/puestos`).then((res) => setWorkPositions(res.data));
    }, [areaId]);

    useEffect(() => {
        setLocalCalendars(calendars);
    }, [calendars]);

    const saveNewCalendar = async () => {
        setCalendarSaving(true);
        setCalendarError(null);
        try {
            const res = await axios.post('/calendars', {
                ...newCalForm,
                area_id: areaId,
                is_custom: true,
                created_for_employee_uid: employeeUid,
            });
            const created: Calendar = res.data;
            setLocalCalendars((prev) => [...prev, created]);

            if (creatingCalendarFor === 'edit') {
                setForm((prev) => ({ ...prev, calendar_id: created.id }));
            } else if (creatingCalendarFor === 'apply') {
                setApplyCalendarId(created.id);
            }

            setNewCalForm(emptyCalendarForm);
            setCreatingCalendarFor(null);
            onCalendarCreated?.();
        } catch (err: any) {
            setCalendarError(err?.response?.data?.message ?? 'No se pudo crear el turno.');
        } finally {
            setCalendarSaving(false);
        }
    };

    const startEdit = (p: Programation) => {
        setError(null);
        setEditingId(p.id);
        setForm({
            calendar_id: p.calendar_id,
            work_position_id: p.work_position_id ?? '',
            start_date: p.start_date,
            end_date: p.end_date,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setError(null);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        setError(null);
        try {
            await axios.put(`/programations/${editingId}`, {
                calendar_id: Number(form.calendar_id),
                work_position_id: form.work_position_id === '' ? null : Number(form.work_position_id),
                start_date: form.start_date,
                end_date: form.end_date,
            });
            setEditingId(null);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo guardar la programación.');
        } finally {
            setSaving(false);
        }
    };

    const startApplyDays = (p: Programation) => {
        setError(null);
        setApplyFeedback(null);
        setEditingId(null);
        setApplyingId(p.id);
        setApplyCalendarId(p.calendar_id);
        setApplyDates(['']);
    };

    const cancelApplyDays = () => {
        setApplyingId(null);
        setError(null);
        setApplyFeedback(null);
    };

    const updateApplyDate = (index: number, value: string) => {
        setApplyDates((prev) => prev.map((d, i) => (i === index ? value : d)));
    };

    const addApplyDate = () => {
        setApplyDates((prev) => [...prev, '']);
    };

    const removeApplyDate = (index: number) => {
        setApplyDates((prev) => prev.filter((_, i) => i !== index));
    };

    const submitApplyDays = async (programationId: number) => {
        const dates = applyDates.filter((d) => d !== '');

        if (!applyCalendarId) {
            setError('Selecciona un turno.');
            return;
        }
        if (dates.length === 0) {
            setError('Selecciona al menos un día.');
            return;
        }

        setSaving(true);
        setError(null);
        setApplyFeedback(null);
        try {
            for (const date of dates) {
                await axios.patch(`/programations/${programationId}/override`, {
                    date,
                    calendar_id: applyCalendarId,
                });
            }
            setApplyFeedback(`Turno cambiado para ${employeeName} en ${dates.length} día(s).`);
            setApplyDates(['']);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo cambiar el turno en esos días.');
        } finally {
            setSaving(false);
        }
    };

    const cancelProgramation = async (id: number) => {
        if (!confirm('¿Cancelar esta programación? El empleado quedará sin turno asignado en ese rango de fechas.')) {
            return;
        }
        await axios.patch(`/programations/${id}/cancel`);
        onChanged();
    };

    const activeProgramations = programations.filter((p) => p.status !== 'Cancelado');

    // Catálogo general del área + turnos personalizados creados para este empleado (no los de otros empleados)
    const visibleCalendars = localCalendars.filter((cal) => !cal.is_custom || cal.created_for_employee_uid === employeeUid);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-1 flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold text-[#a81c24]">Turnos de {employeeName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-[#a81c24]">
                        <XCircle className="h-6 w-6" />
                    </button>
                </div>
                <p className="mb-4 text-xs text-gray-500">Los cambios que hagas aquí afectan solo a {employeeName}, no al resto del área.</p>

                {activeProgramations.length === 0 && <p className="text-sm text-gray-500">Sin programaciones activas en este mes.</p>}

                <div className="space-y-3">
                    {activeProgramations.map((p) => (
                        <div key={p.id} className="rounded-md border border-gray-200 p-3">
                            {editingId === p.id ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600">Turno</label>
                                        <select
                                            value={form.calendar_id}
                                            onChange={(e) => setForm({ ...form, calendar_id: Number(e.target.value) })}
                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                        >
                                            <option value="">Seleccione un turno</option>
                                            {visibleCalendars.map((cal) => (
                                                <option key={cal.id} value={cal.id}>
                                                    {optionLabel(cal)}
                                                </option>
                                            ))}
                                        </select>

                                        {creatingCalendarFor === 'edit' ? (
                                            <NewCalendarInline
                                                form={newCalForm}
                                                setForm={setNewCalForm}
                                                saving={calendarSaving}
                                                error={calendarError}
                                                onCancel={() => setCreatingCalendarFor(null)}
                                                onSave={saveNewCalendar}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => setCreatingCalendarFor('edit')}
                                                className="mt-1 text-xs font-semibold text-[#a81c24] hover:underline"
                                            >
                                                + Nuevo turno con otro horario
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600">Puesto de trabajo</label>
                                        <select
                                            value={form.work_position_id}
                                            onChange={(e) => setForm({ ...form, work_position_id: Number(e.target.value) || '' })}
                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                        >
                                            <option value="">Sin puesto</option>
                                            {workPositions.map((wp) => (
                                                <option key={wp.id} value={wp.id}>
                                                    {wp.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="w-1/2">
                                            <label className="block text-xs font-semibold text-gray-600">Inicio</label>
                                            <input
                                                type="date"
                                                value={form.start_date}
                                                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div className="w-1/2">
                                            <label className="block text-xs font-semibold text-gray-600">Fin</label>
                                            <input
                                                type="date"
                                                value={form.end_date}
                                                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {error && <p className="text-xs text-red-600">{error}</p>}

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={cancelEdit} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                            Cancelar edición
                                        </button>
                                        <button
                                            onClick={saveEdit}
                                            disabled={saving}
                                            className="rounded border border-[#95c020] px-3 py-1 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                                        >
                                            {saving ? 'Guardando…' : 'Guardar cambios'}
                                        </button>
                                    </div>
                                </div>
                            ) : applyingId === p.id ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-800">Cambiar turno de {employeeName} en días específicos</p>
                                    <p className="text-xs text-gray-500">
                                        Solo afecta a {employeeName} en los días que elijas. El resto de su programación no se toca.
                                    </p>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600">Turno a aplicar</label>
                                        <select
                                            value={applyCalendarId}
                                            onChange={(e) => setApplyCalendarId(Number(e.target.value))}
                                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                        >
                                            {visibleCalendars.map((cal) => (
                                                <option key={cal.id} value={cal.id}>
                                                    {optionLabel(cal)}
                                                </option>
                                            ))}
                                        </select>

                                        {creatingCalendarFor === 'apply' ? (
                                            <NewCalendarInline
                                                form={newCalForm}
                                                setForm={setNewCalForm}
                                                saving={calendarSaving}
                                                error={calendarError}
                                                onCancel={() => setCreatingCalendarFor(null)}
                                                onSave={saveNewCalendar}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => setCreatingCalendarFor('apply')}
                                                className="mt-1 text-xs font-semibold text-[#a81c24] hover:underline"
                                            >
                                                + Nuevo turno con otro horario
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        {applyDates.map((date, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={date}
                                                    min={toISODate(p.start_date)}
                                                    max={toISODate(p.end_date)}
                                                    onChange={(e) => updateApplyDate(index, e.target.value)}
                                                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                                />
                                                {applyDates.length > 1 && (
                                                    <button
                                                        onClick={() => removeApplyDate(index)}
                                                        title="Quitar día"
                                                        className="text-gray-400 hover:text-red-600"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={addApplyDate} className="text-xs font-semibold text-[#a81c24] hover:underline">
                                        + Agregar otro día
                                    </button>

                                    {error && <p className="text-xs text-red-600">{error}</p>}
                                    {applyFeedback && <p className="text-xs text-green-600">{applyFeedback}</p>}

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={cancelApplyDays} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                            Cerrar
                                        </button>
                                        <button
                                            onClick={() => submitApplyDays(p.id)}
                                            disabled={saving}
                                            className="rounded border border-[#95c020] px-3 py-1 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                                        >
                                            {saving ? 'Aplicando…' : 'Aplicar'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">
                                            {formatDate(p.start_date)} → {formatDate(p.end_date)}
                                        </p>
                                        <p className="text-xs text-gray-500">{calendarLabel(p.calendar)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startApplyDays(p)}
                                            title="Cambiar turno en días específicos (solo este empleado)"
                                            className="rounded-md border border-[#a81c24] p-1.5 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(p)}
                                            title="Editar"
                                            className="rounded-md border border-[#a81c24] p-1.5 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => cancelProgramation(p.id)}
                                            title="Cancelar programación"
                                            className="rounded-md border border-gray-400 p-1.5 text-gray-500 hover:bg-red-600 hover:text-white"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
