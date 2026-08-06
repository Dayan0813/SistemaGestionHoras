import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { CalendarFold, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import DateGrid from './DateGrid';

dayjs.locale('es');

/* =======================
   TIPOS
======================= */

type Calendar = {
    id: number;
    area_id: number;
    hora_entrada: string;
    hora_salida: string;
    shift_type: 'D' | 'N';
};

type WorkPosition = {
    id: number;
    name: string;
};

type TimesProgramationsProps = {
    areaId: number | null;
    employeeIds: number[];
    selectedMonth: string;
    onChange: (data: {
        calendar_id: number | '';
        work_position_id: number | '';
        start_date: string;
        end_date: string;
        work_days: string[];
        excluded_dates: string[];
    }) => void;
};

/* =======================
   COMPONENTE
======================= */

export default function TimesProgramations({ areaId, employeeIds, selectedMonth, onChange }: TimesProgramationsProps) {
    /* =======================
       ESTADOS
    ======================= */

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [calendarId, setCalendarId] = useState<number | ''>('');

    const [workPositions, setWorkPositions] = useState<WorkPosition[]>([]);
    const [workPositionId, setWorkPositionId] = useState<number | ''>('');

    const [loadingCalendars, setLoadingCalendars] = useState(false);
    const [loadingPositions, setLoadingPositions] = useState(false);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [workDays] = useState<string[]>([]);
    const [excludedDates, setExcludedDates] = useState<string[]>([]);

    /* =======================
       CALENDARS POR ÁREA
    ======================= */

    useEffect(() => {
        if (!areaId || areaId <= 0 || Number.isNaN(areaId)) {
            setCalendars([]);
            setCalendarId('');
            return;
        }

        setLoadingCalendars(true);
        axios
            .get(`/calendars/area/${areaId}`)
            .then((res) => {
                setCalendars(res.data);
                setCalendarId('');
            })
            .finally(() => setLoadingCalendars(false));
    }, [areaId]);

    /* =======================
       WORK POSITIONS POR ÁREA
    ======================= */

    useEffect(() => {
        if (!areaId || areaId <= 0 || Number.isNaN(areaId)) {
            setWorkPositions([]);
            setWorkPositionId('');
            return;
        }

        setLoadingPositions(true);
        axios
            .get(`/workPositions/area/${areaId}/puestos`)
            .then((res) => {
                setWorkPositions(res.data);
                setWorkPositionId('');
            })
            .finally(() => setLoadingPositions(false));
    }, [areaId]);

    /* =======================
       NOTIFICAR AL PADRE
    ======================= */

    useEffect(() => {
        if (!startDate || !endDate) return;

        onChange({
            calendar_id: calendarId,
            work_position_id: workPositionId,
            start_date: startDate,
            end_date: endDate,
            work_days: workDays,
            excluded_dates: excludedDates,
        });
    }, [calendarId, workPositionId, startDate, endDate, workDays, excludedDates]);

    /* =======================
       RENDER
    ======================= */

    return (
        <div className="mt-6 rounded-2xl border border-[#a81c24] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-2 border-b pb-3">
                <CalendarFold className="text-[#a81c24]" />
                <h2 className="text-lg font-bold text-[#a81c24]">Configuración de Programación</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Inicio */}
                <div>
                    <label className="font-semibold">Fecha Inicio</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded border p-2" />
                </div>

                {/* Fin */}
                <div>
                    <label className="font-semibold">Fecha Fin</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border p-2" />
                </div>

                {/* Calendario */}
                <div>
                    <label className="font-semibold">Turno</label>
                    <select
                        value={calendarId}
                        disabled={!areaId || loadingCalendars}
                        onChange={(e) => setCalendarId(Number(e.target.value) || '')}
                        className="mt-1 w-full rounded border p-2"
                    >
                        <option value="">{loadingCalendars ? 'Cargando...' : 'Seleccione un turno'}</option>
                        {calendars.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.shift_type} ({c.hora_entrada} - {c.hora_salida})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Puesto */}
                <div>
                    <label className="font-semibold">Puesto</label>
                    <select
                        value={workPositionId}
                        disabled={!areaId || loadingPositions}
                        onChange={(e) => setWorkPositionId(Number(e.target.value) || '')}
                        className="mt-1 w-full rounded border p-2"
                    >
                        <option value="">{loadingPositions ? 'Cargando...' : 'Seleccione un puesto'}</option>
                        {workPositions.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <DateGrid startDate={startDate} endDate={endDate} />

            {/* Exclusiones */}
            <div className="mt-3 flex flex-wrap gap-2">
                {excludedDates.map((date) => (
                    <div key={date} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                        <span>{dayjs(date).format('DD MMM')}</span>
                        <button onClick={() => setExcludedDates(excludedDates.filter((d) => d !== date))}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
