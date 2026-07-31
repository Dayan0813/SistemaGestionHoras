import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { useEffect, useMemo, useState } from 'react';

dayjs.extend(isSameOrBefore);
dayjs.locale('es');

type Holiday = {
    date: string;
    name: string;
};

type Props = {
    startDate: string;
    endDate: string;
};

export default function DateGrid({ startDate, endDate }: Props) {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(false);

    const showGrid = startDate && endDate && dayjs(startDate).isSameOrBefore(endDate);

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
        let current = dayjs(startDate);

        while (current.isSameOrBefore(endDate)) {
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

    const isHoliday = (date: string) => holidays.some((h) => dayjs(h.date).format('YYYY-MM-DD') === date);

    if (!showGrid) return null;

    return (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow">
            <h3 className="mb-3 font-semibold text-gray-700">Rango de fechas seleccionado</h3>

            {loading ? (
                <p className="text-sm text-gray-500">Cargando festivos…</p>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {days.map((d) => {
                        const holiday = isHoliday(d.date);
                        const isSunday = d.weekday === 0;

                        let bg = 'bg-green-100 text-green-800';
                        if (holiday) bg = 'bg-red-200 text-red-800';
                        else if (isSunday) bg = 'bg-yellow-200 text-yellow-800';

                        return (
                            <div
                                key={d.date}
                                className={`rounded-lg p-2 text-center text-sm font-semibold ${bg}`}
                                title={holiday ? 'Festivo' : isSunday ? 'Domingo' : 'Día laboral'}
                            >
                                <div>{d.day}</div>
                                <div className="text-xs capitalize">{d.label}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
