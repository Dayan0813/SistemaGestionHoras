import MainLayout from '@/Layouts/MainLayout';
import { AlertTriangle, ChevronLeft, ChevronRight, Fingerprint, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

const employees = ['Juan Pablo Osorio', 'Daniela Cortés', 'Camila Restrepo'];
const records = [
    { day: 'Lunes', date: '17 ago', scheduled: ['08:00', '17:00'], entry: '07:58', exit: '17:04', status: 'Coincide' },
    { day: 'Martes', date: '18 ago', scheduled: ['08:00', '17:00'], entry: '08:02', exit: '18:12', status: 'Coincide', extra: true },
    { day: 'Miércoles', date: '19 ago', scheduled: ['08:00', '17:00'], entry: '08:11', exit: '17:03', status: 'Entrada tardía' },
    { day: 'Jueves', date: '20 ago', scheduled: ['08:00', '17:00'], entry: '08:00', exit: null, status: 'Falta salida' },
    { day: 'Viernes', date: '21 ago', scheduled: ['08:00', '17:00'], entry: null, exit: null, status: 'Ausente' },
    { day: 'Sábado', date: '22 ago', scheduled: ['08:00', '13:00'], entry: '08:00', exit: '13:01', status: 'Coincide' },
    { day: 'Domingo', date: '23 ago', scheduled: ['08:00', '13:00'], entry: null, exit: null, status: 'Descanso' },
];
const minutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
};
const position = (value: string) => `${Math.max(0, Math.min(100, ((minutes(value) - 360) / 960) * 100))}%`;
const width = (start: string, end: string) => `${Math.max(5, ((minutes(end) - minutes(start)) / 960) * 100)}%`;

const statusBadge = (status: string) => {
    if (status === 'Coincide') return 'bg-green-100 text-green-700';
    if (status === 'Descanso') return 'bg-gray-100 text-gray-600';
    return 'bg-red-100 text-red-700';
};

export default function CalendarioVsMarcaciones() {
    const [employee, setEmployee] = useState(employees[0]);
    const [weekOffset, setWeekOffset] = useState(0);
    const weekLabel = weekOffset ? '24 – 30 de agosto, 2026' : '17 – 23 de agosto, 2026';
    const visibleRecords = useMemo(
        () => records.map((record) => ({ ...record, day: weekOffset ? `${record.day} · siguiente` : record.day })),
        [weekOffset],
    );

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
            {/* Contexto: empleado + semana */}
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[#a81c24] bg-white p-6 shadow-sm">
                <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    Empleado
                    <select
                        value={employee}
                        onChange={(event) => setEmployee(event.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 normal-case focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                    >
                        {employees.map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </select>
                </label>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                    >
                        <ChevronLeft size={17} />
                    </button>
                    <strong className="text-sm text-gray-800">{weekLabel}</strong>
                    <button
                        onClick={() => setWeekOffset((value) => Math.min(1, value + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded border border-[#a81c24] text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                    >
                        <ChevronRight size={17} />
                    </button>
                </div>
            </div>

            {/* Encabezado de comparación + leyenda */}
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                    <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Semana activa</p>
                    <h2 className="text-xl font-semibold text-gray-900">{weekLabel}</h2>
                </div>
                <div className="flex flex-wrap gap-5 text-xs text-gray-600">
                    <span className="flex items-center gap-2">
                        <i className="inline-block h-2 w-4 rounded-sm border border-dashed border-[#95c020] bg-[#eaf3d3]" /> Programado
                    </span>
                    <span className="flex items-center gap-2">
                        <i className="inline-block h-2 w-4 rounded-sm bg-[#95c020]" /> Marcado
                    </span>
                    <span className="flex items-center gap-2">
                        <i className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-[#a81c24]" /> Falta
                    </span>
                </div>
            </div>

            {/* Lista de comparación */}
            <section className="space-y-3">
                {visibleRecords.map((record) => (
                    <article
                        key={record.day}
                        className={`grid grid-cols-1 items-center gap-4 rounded-lg border p-4 shadow-sm md:grid-cols-[125px_minmax(280px,1fr)_200px] ${
                            record.status === 'Descanso' ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                        }`}
                    >
                        <div>
                            <strong className="block text-sm text-gray-900">{record.day}</strong>
                            <small className="text-xs text-gray-500">{record.date}</small>
                        </div>
                        <div className="relative py-4">
                            <span className="absolute -top-1 left-0 text-[10px] text-gray-400">06:00</span>
                            <span className="absolute -top-1 right-0 text-[10px] text-gray-400">22:00</span>
                            <div
                                className="relative h-6 border-b border-gray-300"
                                style={{
                                    backgroundImage:
                                        'repeating-linear-gradient(90deg, #f1f1f1 0, #f1f1f1 1px, transparent 1px, transparent 12.5%)',
                                }}
                            >
                                <span
                                    className="absolute top-[5px] h-[15px] rounded border border-dashed border-[#95c020] bg-[#eaf3d3]"
                                    style={{ left: position(record.scheduled[0]), width: width(record.scheduled[0], record.scheduled[1]) }}
                                />
                                {record.entry && (
                                    <span
                                        className={`absolute top-[9px] h-[7px] rounded-full ${
                                            record.status === 'Entrada tardía' ? 'bg-amber-500' : record.extra ? 'bg-[#5e7a15]' : 'bg-[#95c020]'
                                        }`}
                                        style={{ left: position(record.entry), width: record.exit ? width(record.entry, record.exit) : '7%' }}
                                    />
                                )}
                                {record.status !== 'Descanso' && (
                                    <>
                                        <span
                                            className={`absolute top-0.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-white ${
                                                record.entry
                                                    ? 'border-[#95c020] text-[#5e7a15]'
                                                    : 'border-dashed border-[#a81c24] bg-red-50 text-[#a81c24]'
                                            }`}
                                            style={{ left: record.entry ? position(record.entry) : position(record.scheduled[0]) }}
                                        >
                                            {record.entry ? <Fingerprint size={12} /> : <X size={12} />}
                                        </span>
                                        <span
                                            className={`absolute top-0.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-white ${
                                                record.exit
                                                    ? 'border-[#95c020] text-[#5e7a15]'
                                                    : 'border-dashed border-[#a81c24] bg-red-50 text-[#a81c24]'
                                            }`}
                                            style={{ left: record.exit ? position(record.exit) : position(record.scheduled[1]) }}
                                        >
                                            {record.exit ? <Fingerprint size={12} /> : <X size={12} />}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-start gap-1.5">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge(record.status)}`}>
                                {record.status}
                            </span>
                            <code className="font-mono text-[11px] text-gray-500">
                                {record.status === 'Ausente'
                                    ? 'Sin marcaciones'
                                    : record.status === 'Falta salida'
                                      ? `${record.entry} → sin registro`
                                      : record.status === 'Descanso'
                                        ? 'Día libre'
                                        : `${record.entry} → ${record.exit}`}
                            </code>
                        </div>
                    </article>
                ))}
            </section>

            {/* Discrepancias */}
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <AlertTriangle size={18} />
                </span>
                <p className="m-0 leading-relaxed">
                    <strong>2 discrepancias requieren revisión.</strong> El miércoles hubo una entrada tardía de 11 minutos y el jueves no se
                    registró la marcación de salida. El viernes estaba programado, pero no hubo marcaciones.
                </p>
            </div>
        </div>
    );
}
CalendarioVsMarcaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="calendario-marcaciones">{page}</MainLayout>;
