import { useEffect, useRef, useState } from 'react';

interface AutocompleteProps<T> {
    items: T[];
    getLabel: (item: T) => string;
    getSubLabel?: (item: T) => string;
    onSelect: (item: T) => void;
    placeholder?: string;
    value?: T | null;
}

export default function Autocomplete<T>({ items, getLabel, getSubLabel, onSelect, placeholder = 'Buscar...', value }: AutocompleteProps<T>) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = items.filter((item) => getLabel(item).toLowerCase().includes(query.toLowerCase()));

    // cerrar al hacer click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <input
                type="text"
                value={value ? getLabel(value) : query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
            />

            {open && (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="max-h-80 space-y-0.5 overflow-y-auto p-2">
                        {filtered.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-400">Sin resultados</div>}

                        {filtered.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    onSelect(item);
                                    setQuery('');
                                    setOpen(false);
                                }}
                                className="cursor-pointer rounded-lg px-3.5 py-2.5 transition-colors hover:bg-[#eaf3d3]"
                            >
                                <div className="text-sm font-semibold text-gray-900">{getLabel(item)}</div>

                                {getSubLabel && <div className="mt-0.5 text-xs text-gray-500">{getSubLabel(item)}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
