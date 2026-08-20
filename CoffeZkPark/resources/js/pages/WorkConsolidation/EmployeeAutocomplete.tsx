import { useEffect, useRef, useState } from 'react';

interface AutocompleteProps<T> {
    items: T[];
    getLabel: (item: T) => string;
    getSubLabel?: (item: T) => string;
    onSelect: (item: T) => void;
    placeholder?: string;
    value?: T | null;
}

export default function Autocomplete<T>({
    items,
    getLabel,
    getSubLabel,
    onSelect,
    placeholder = 'Buscar...',
    value,
}: AutocompleteProps<T>) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = items.filter((item) =>
        getLabel(item).toLowerCase().includes(query.toLowerCase())
    );

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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:ring-gray-500"
            />

            {open && (
                <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                    {filtered.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                            Sin resultados
                        </div>
                    )}

                    {filtered.map((item, index) => (
                        <div
                            key={index}
                            onClick={() => {
                                onSelect(item);
                                setQuery('');
                                setOpen(false);
                            }}
                            className="cursor-pointer px-3 py-2 hover:bg-gray-100"
                        >
                            <div className="text-sm font-medium text-gray-900">
                                {getLabel(item)}
                            </div>

                            {getSubLabel && (
                                <div className="text-xs text-gray-500">
                                    {getSubLabel(item)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
