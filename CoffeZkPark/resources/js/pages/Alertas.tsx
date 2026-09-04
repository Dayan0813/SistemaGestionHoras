import MainLayout from '@/Layouts/MainLayout';
import { Bell, Construction } from 'lucide-react';
import React from 'react';

export default function Alertas() {
    return (
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
            <header>
                <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Seguimiento de asistencia</p>
                <h1 className="text-2xl font-semibold text-[#a81c24]">Alertas</h1>
                <p className="mt-1 text-sm text-gray-600">Novedades que requieren la atención del coordinador.</p>
            </header>

            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a81c24]/10 text-[#a81c24]">
                    <Construction size={22} />
                </span>
                <h2 className="text-base font-semibold text-gray-800">Esta funcionalidad todavía no está disponible</h2>
                <p className="max-w-sm text-sm text-gray-500">
                    Las alertas de asistencia (tardanzas, inasistencias, salidas sin marcar) todavía no están conectadas a datos reales. Se
                    habilitarán cuando se definan las reglas que determinan qué situaciones generan una alerta.
                </p>
            </div>

            <div className="mx-auto flex max-w-lg items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 text-gray-300">
                <Bell size={18} />
                <span className="flex-1 text-xs">Enviar recordatorio manual al empleado o supervisor…</span>
            </div>
        </div>
    );
}
Alertas.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="alertas">{page}</MainLayout>;
