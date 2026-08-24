import MainLayout from '@/Layouts/MainLayout';
import { AlertCircle, Bell, CheckCircle2, Clock3, Send, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

const alerts = [
    { id: 1, date: 'Hoy · 21 de agosto', time: '19:12', type: 'salida', name: 'Juan Pablo Osorio', text: 'no ha marcado su salida. El turno finalizó hace 2h 10m y la última marcación registrada fue de entrada a las 08:02.', action: 'Notificar al empleado' },
    { id: 2, date: 'Hoy · 21 de agosto', time: '18:05', type: 'inasistencia', name: 'Daniela Cortés', text: 'estaba programada para asistir hoy en el turno 08:00–17:00 y no registró ninguna marcación de entrada.', action: 'Contactar supervisor' },
    { id: 3, date: 'Hoy · 21 de agosto', time: '08:11', type: 'tardanza', name: 'Camila Restrepo', text: 'registró entrada con 11 minutos de retraso respecto al turno programado (08:00).', action: 'Ver detalle' },
    { id: 4, date: 'Ayer · 20 de agosto', time: '17:31', type: 'salida', name: 'Andrés Molina', text: 'no ha marcado su salida. El turno finalizó a las 17:00 y no hay una marcación posterior.', action: 'Marcar como revisada' },
    { id: 5, date: 'Ayer · 20 de agosto', time: '09:02', type: 'inasistencia', name: 'Laura Méndez', text: 'estaba programada para asistir hoy en el turno 08:00–17:00 y no registró ninguna marcación de entrada.', action: 'Contactar supervisor' },
    { id: 6, date: 'Ayer · 20 de agosto', time: '08:16', type: 'tardanza', name: 'Mateo Gil', text: 'registró entrada con 16 minutos de retraso respecto al turno programado (08:00).', action: 'Ver detalle' },
    { id: 7, date: '19 de agosto', time: '20:14', type: 'resuelta', name: 'Sofía Herrera', text: 'incidencia resuelta: salida corregida manualmente por el coordinador.', action: 'Resuelta · salida corregida manualmente' },
    { id: 8, date: '19 de agosto', time: '18:00', type: 'resuelta', name: 'Carlos Ramírez', text: 'incidencia resuelta: el supervisor confirmó la asistencia del empleado.', action: 'Resuelta · asistencia confirmada' },
];
const filterOptions = [
    { id: 'all', label: 'Todas' },
    { id: 'salida', label: 'Falta marcar salida' },
    { id: 'inasistencia', label: 'Inasistencias' },
    { id: 'tardanza', label: 'Tardanzas' },
    { id: 'resuelta', label: 'Resueltas' },
];
const iconFor = (type: string) =>
    type === 'tardanza' ? <Clock3 size={17} /> : type === 'resuelta' ? <CheckCircle2 size={17} /> : type === 'inasistencia' ? <X size={18} /> : <AlertCircle size={17} />;
const alertColors: Record<string, string> = {
    salida: 'bg-red-100 text-red-600',
    inasistencia: 'bg-red-100 text-red-600',
    tardanza: 'bg-amber-100 text-amber-600',
    resuelta: 'bg-green-100 text-green-700',
};

export default function Alertas() {
    const [filter, setFilter] = useState('all');
    const visible = useMemo(() => (filter === 'all' ? alerts : alerts.filter((alert) => alert.type === filter)), [filter]);
    const pending = alerts.filter((alert) => alert.type !== 'resuelta').length;

    return (
        <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Seguimiento de asistencia</p>
                    <h1 className="text-2xl font-semibold text-[#a81c24]">Alertas</h1>
                    <p className="mt-1 text-sm text-gray-600">Novedades que requieren la atención del coordinador.</p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-[#a81c24]/10 px-3 py-1.5 text-xs font-semibold text-[#a81c24]">
                    <Bell size={15} /> {pending} pendientes
                </span>
            </header>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-5">
                {filterOptions.map((option) => {
                    const active = filter === option.id;
                    const count = option.id === 'all' ? alerts.length : alerts.filter((alert) => alert.type === option.id).length;
                    return (
                        <button
                            key={option.id}
                            onClick={() => setFilter(option.id)}
                            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                active ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {option.label} <b className="ml-1 font-mono">{count}</b>
                        </button>
                    );
                })}
            </div>

            <section>
                {visible.map((alert, index) => (
                    <React.Fragment key={alert.id}>
                        {(index === 0 || visible[index - 1].date !== alert.date) && (
                            <div className="mt-6 mb-4 text-center text-[11px] font-bold tracking-widest text-gray-400 uppercase">{alert.date}</div>
                        )}
                        <article className="mx-auto mb-4 flex max-w-2xl gap-3">
                            <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${alertColors[alert.type]}`}>
                                {iconFor(alert.type)}
                            </span>
                            <div className="flex-1">
                                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
                                    <strong className="text-gray-900">{alert.name}</strong> {alert.text}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-3 px-1 text-gray-400">
                                    <code className="font-mono text-[11px]">{alert.time}</code>
                                    {alert.type === 'resuelta' ? (
                                        <span className="text-[11px] font-semibold text-green-700">{alert.action}</span>
                                    ) : (
                                        <>
                                            <button className="text-[11px] font-semibold text-[#a81c24] hover:underline">{alert.action}</button>
                                            <button className="text-[11px] font-semibold text-[#a81c24] hover:underline">Marcar como revisada</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </article>
                    </React.Fragment>
                ))}
            </section>

            <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-gray-300 bg-white px-4 py-2 text-[#a81c24]">
                <Bell size={18} />
                <input
                    disabled
                    placeholder="Enviar recordatorio manual al empleado o supervisor…"
                    className="flex-1 border-0 bg-transparent text-xs text-gray-400 outline-none"
                />
                <button aria-label="Enviar" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#95c020] text-white">
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
Alertas.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="alertas">{page}</MainLayout>;
