export type NewCalendarFormData = {
    hora_entrada: string;
    hora_salida: string;
    shift_type: 'D' | 'N';
};

export const emptyNewCalendarForm: NewCalendarFormData = { hora_entrada: '', hora_salida: '', shift_type: 'D' };

type Props = {
    form: NewCalendarFormData;
    setForm: (form: NewCalendarFormData) => void;
    saving: boolean;
    error: string | null;
    onCancel: () => void;
    onSave: () => void;
};

export default function NewCalendarInline({ form, setForm, saving, error, onCancel, onSave }: Props) {
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
