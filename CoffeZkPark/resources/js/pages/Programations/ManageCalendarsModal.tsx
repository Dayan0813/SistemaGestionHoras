import axios from 'axios';
import { CalendarDays, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

interface Props {
    areaId: number;
    calendars: Calendar[];
    onClose: () => void;
    onChanged: () => void;
}

const emptyForm = { hora_entrada: '', hora_salida: '', shift_type: 'D' as 'D' | 'N' };

const toHHMM = (value: string | null) => (value ? value.slice(0, 5) : '');

export default function ManageCalendarsModal({ areaId, calendars, onClose, onChanged }: Props) {
    const [creating, setCreating] = useState(false);
    const [newForm, setNewForm] = useState(emptyForm);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState(emptyForm);

    const [applyingId, setApplyingId] = useState<number | null>(null);
    const [applyDates, setApplyDates] = useState<string[]>(['']);
    const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const startEdit = (cal: Calendar) => {
        setError(null);
        setEditingId(cal.id);
        setEditForm({
            hora_entrada: toHHMM(cal.hora_entrada),
            hora_salida: toHHMM(cal.hora_salida),
            shift_type: cal.shift_type,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setError(null);
    };

    const saveEdit = async (id: number) => {
        setSaving(true);
        setError(null);
        try {
            await axios.put(`/calendars/${id}`, editForm);
            setEditingId(null);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo guardar el turno.');
        } finally {
            setSaving(false);
        }
    };

    const startApply = (cal: Calendar) => {
        setError(null);
        setApplyFeedback(null);
        setEditingId(null);
        setApplyingId(cal.id);
        setApplyDates(['']);
    };

    const cancelApply = () => {
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

    const submitApply = async (calendarId: number) => {
        const dates = applyDates.filter((d) => d !== '');

        if (dates.length === 0) {
            setError('Selecciona al menos un día.');
            return;
        }

        setSaving(true);
        setError(null);
        setApplyFeedback(null);
        try {
            const res = await axios.post('/programations/bulk-override', {
                area_id: areaId,
                calendar_id: calendarId,
                dates,
            });
            setApplyFeedback(`Turno aplicado a ${res.data.empleados_afectados} programación(es) en los días seleccionados.`);
            setApplyDates(['']);
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo aplicar el turno a esos días.');
        } finally {
            setSaving(false);
        }
    };

    const removeCalendar = async (id: number) => {
        if (!confirm('¿Eliminar este turno? Solo se puede eliminar si no está siendo usado en ninguna programación.')) {
            return;
        }
        try {
            await axios.delete(`/calendars/${id}`);
            onChanged();
        } catch (err: any) {
            alert(err?.response?.data?.message ?? 'No se pudo eliminar el turno.');
        }
    };

    const saveNew = async () => {
        setSaving(true);
        setError(null);
        try {
            await axios.post('/calendars', { ...newForm, area_id: areaId });
            setNewForm(emptyForm);
            setCreating(false);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo crear el turno.');
        } finally {
            setSaving(false);
        }
    };

    // Los turnos creados al vuelo para un empleado no se muestran en el catálogo general del área
    const catalogCalendars = calendars.filter((cal) => !cal.is_custom);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-1 flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold text-[#a81c24]">Turnos del área</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-[#a81c24]">
                        <XCircle className="h-6 w-6" />
                    </button>
                </div>
                <p className="mb-4 text-xs text-gray-500">
                    Crear y editar turnos aquí, y aplicarlos a días específicos, afecta a <strong>todos los empleados</strong> del área. Para cambiar
                    el turno de un solo empleado, usa el botón junto a su nombre en la tabla.
                </p>

                {catalogCalendars.length === 0 && !creating && <p className="mb-3 text-sm text-gray-500">Esta área todavía no tiene turnos creados.</p>}

                <div className="space-y-3">
                    {catalogCalendars.map((cal) => (
                        <div key={cal.id} className="rounded-md border border-gray-200 p-3">
                            {editingId === cal.id ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="block text-xs font-semibold text-gray-600">Entrada</label>
                                            <input
                                                type="time"
                                                value={editForm.hora_entrada}
                                                onChange={(e) => setEditForm({ ...editForm, hora_entrada: e.target.value })}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-semibold text-gray-600">Salida</label>
                                            <input
                                                type="time"
                                                value={editForm.hora_salida}
                                                onChange={(e) => setEditForm({ ...editForm, hora_salida: e.target.value })}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-semibold text-gray-600">Tipo</label>
                                            <select
                                                value={editForm.shift_type}
                                                onChange={(e) => setEditForm({ ...editForm, shift_type: e.target.value as 'D' | 'N' })}
                                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                            >
                                                <option value="D">Diurno</option>
                                                <option value="N">Nocturno</option>
                                            </select>
                                        </div>
                                    </div>

                                    {error && <p className="text-xs text-red-600">{error}</p>}

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button onClick={cancelEdit} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => saveEdit(cal.id)}
                                            disabled={saving}
                                            className="rounded border border-[#95c020] px-3 py-1 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                                        >
                                            {saving ? 'Guardando…' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            ) : applyingId === cal.id ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-800">
                                        Aplicar {toHHMM(cal.hora_entrada)} - {toHHMM(cal.hora_salida)} a días específicos
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Se asigna este turno solo en los días que elijas, a todos los empleados que tengan programación activa
                                        ese día en esta área. El resto del mes no se toca.
                                    </p>

                                    <div className="space-y-1">
                                        {applyDates.map((date, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={date}
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
                                        <button onClick={cancelApply} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                            Cerrar
                                        </button>
                                        <button
                                            onClick={() => submitApply(cal.id)}
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
                                            {toHHMM(cal.hora_entrada)} - {toHHMM(cal.hora_salida)}
                                        </p>
                                        <p className="text-xs text-gray-500">{cal.shift_type === 'D' ? 'Diurno' : 'Nocturno'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startApply(cal)}
                                            title="Aplicar a días específicos"
                                            className="rounded-md border border-[#a81c24] p-1.5 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(cal)}
                                            title="Editar"
                                            className="rounded-md border border-[#a81c24] p-1.5 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => removeCalendar(cal.id)}
                                            title="Eliminar"
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

                <div className="mt-4 border-t pt-4">
                    {creating ? (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-600">Entrada</label>
                                    <input
                                        type="time"
                                        value={newForm.hora_entrada}
                                        onChange={(e) => setNewForm({ ...newForm, hora_entrada: e.target.value })}
                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-600">Salida</label>
                                    <input
                                        type="time"
                                        value={newForm.hora_salida}
                                        onChange={(e) => setNewForm({ ...newForm, hora_salida: e.target.value })}
                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-600">Tipo</label>
                                    <select
                                        value={newForm.shift_type}
                                        onChange={(e) => setNewForm({ ...newForm, shift_type: e.target.value as 'D' | 'N' })}
                                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                    >
                                        <option value="D">Diurno</option>
                                        <option value="N">Nocturno</option>
                                    </select>
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-600">{error}</p>}

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    onClick={() => {
                                        setCreating(false);
                                        setError(null);
                                    }}
                                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveNew}
                                    disabled={saving || !newForm.hora_entrada || !newForm.hora_salida}
                                    className="rounded border border-[#95c020] px-3 py-1 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                                >
                                    {saving ? 'Guardando…' : 'Crear turno'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setCreating(true)}
                            className="flex items-center gap-1 rounded border border-[#a81c24] px-3 py-1.5 text-sm font-semibold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                        >
                            <Plus className="h-4 w-4" /> Nuevo turno
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
