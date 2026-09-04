import { router } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

interface Props {
    label: string;
    value: string;
    onChange: (id: string) => void;
    options: Record<number, string>;
    placeholder: string;
    storeRouteName: string;
    reloadProp: string;
}

const NEW_OPTION = '__new__';

export default function CatalogSelectWithAdd({ label, value, onChange, options, placeholder, storeRouteName, reloadProp }: Props) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Se muestra de inmediato apenas se crea, sin esperar a que termine el
    // reload en segundo plano que sincroniza el catálogo para el resto de la página.
    const [localOptions, setLocalOptions] = useState<Record<number, string>>({});
    const mergedOptions = { ...options, ...localOptions };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === NEW_OPTION) {
            setAdding(true);
            setError(null);
            return;
        }
        onChange(e.target.value);
    };

    const cancelAdd = () => {
        setAdding(false);
        setNewName('');
        setError(null);
    };

    const saveNew = async () => {
        const name = newName.trim();
        if (!name) return;
        setSaving(true);
        setError(null);
        try {
            const res = await axios.post(route(storeRouteName), { name });
            setLocalOptions((prev) => ({ ...prev, [res.data.id]: res.data.name }));
            onChange(String(res.data.id));
            setAdding(false);
            setNewName('');
            router.reload({ only: [reloadProp] });
        } catch (err: any) {
            setError(err?.response?.data?.message ?? 'No se pudo crear.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium">{label}</label>
            {!adding ? (
                <select value={value} onChange={handleSelectChange} className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]">
                    <option value="">{placeholder}</option>
                    {Object.entries(mergedOptions).map(([id, name]) => (
                        <option key={id} value={id}>
                            {String(name)}
                        </option>
                    ))}
                    <option value={NEW_OPTION}>+ Agregar nuevo…</option>
                </select>
            ) : (
                <div className="flex gap-1">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                saveNew();
                            }
                        }}
                        placeholder="Nombre"
                        autoFocus
                        className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-[#a81c24]"
                    />
                    <button
                        type="button"
                        onClick={saveNew}
                        disabled={saving || !newName.trim()}
                        className="rounded border border-[#95c020] px-2 text-xs font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white disabled:opacity-50"
                    >
                        {saving ? '…' : 'Guardar'}
                    </button>
                    <button type="button" onClick={cancelAdd} className="rounded border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-100">
                        Cancelar
                    </button>
                </div>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
