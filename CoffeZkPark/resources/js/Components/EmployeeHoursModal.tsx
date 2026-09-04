import axios from 'axios';
import dayjs from 'dayjs';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Totals {
    ordinary_day: number;
    ordinary_night: number;
    ordinary_festive_day: number;
    ordinary_festive_night: number;
    extra_day: number;
    extra_night: number;
    extra_festive_day: number;
    extra_festive_night: number;
    unplanned: number;
}

interface Employee {
    uid: string;
    name: string;
}

interface Props {
    employee: Employee | null;
    onClose: () => void;
}

const labels: Record<keyof Totals, string> = {
    ordinary_day: 'Ordinaria diurna',
    ordinary_night: 'Ordinaria nocturna',
    ordinary_festive_day: 'Ordinaria festiva diurna',
    ordinary_festive_night: 'Ordinaria festiva nocturna',
    extra_day: 'Extra diurna',
    extra_night: 'Extra nocturna',
    extra_festive_day: 'Extra festiva diurna',
    extra_festive_night: 'Extra festiva nocturna',
    unplanned: 'No programada',
};

export default function EmployeeHoursModal({ employee, onClose }: Props) {
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTotals = useCallback(() => {
        if (!employee) return;
        setLoading(true);
        setError(null);
        axios
            .get(route('consolidations.monthly', employee.uid), { params: { year, month } })
            .then((res) => setTotals(res.data.totals))
            .catch(() => setError('No se pudieron cargar las horas de este empleado.'))
            .finally(() => setLoading(false));
    }, [employee, year, month]);

    useEffect(() => {
        fetchTotals();
    }, [fetchTotals]);

    if (!employee) return null;

    const total = totals ? Object.entries(totals).reduce((sum, [key, value]) => (key === 'unplanned' ? sum : sum + value), 0) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Horas del mes</h2>
                        <p className="text-sm text-gray-500">{employee.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X />
                    </button>
                </div>

                <div className="mb-4 flex gap-2">
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="flex-1 rounded border px-3 py-2 text-sm">
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i + 1}>
                                {dayjs().month(i).format('MMMM')}
                            </option>
                        ))}
                    </select>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28 rounded border px-3 py-2 text-sm">
                        {[year - 1, year, year + 1].map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>

                {loading && <p className="text-sm text-gray-500">Cargando…</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}

                {!loading && !error && totals && (
                    <div className="space-y-1">
                        {(Object.keys(labels) as (keyof Totals)[]).map((key) => (
                            <div key={key} className="flex items-center justify-between border-b border-gray-100 py-1.5 text-sm">
                                <span className="text-gray-600">{labels[key]}</span>
                                <span className="font-mono font-semibold text-gray-800">{totals[key].toFixed(2)} h</span>
                            </div>
                        ))}
                        <div className="mt-2 flex items-center justify-between rounded bg-[#a81c24]/10 px-2 py-2 text-sm font-bold text-[#a81c24]">
                            <span>Total (sin no programadas)</span>
                            <span className="font-mono">{total.toFixed(2)} h</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
