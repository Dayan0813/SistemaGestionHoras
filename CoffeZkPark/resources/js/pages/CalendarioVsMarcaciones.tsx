import MainLayout from '@/Layouts/MainLayout';
import { CalendarClock, Construction } from 'lucide-react';
import React from 'react';

export default function CalendarioVsMarcaciones() {
    return (
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
            <header>
                <p className="mb-1 text-xs font-bold tracking-widest text-[#5e7a15] uppercase">Comparación de asistencia</p>
                <h1 className="text-2xl font-semibold text-[#a81c24]">Calendario vs. Marcaciones</h1>
                <p className="mt-1 text-sm text-gray-600">Compara el turno programado de un empleado contra lo que realmente marcó.</p>
            </header>

            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a81c24]/10 text-[#a81c24]">
                    <Construction size={22} />
                </span>
                <h2 className="text-base font-semibold text-gray-800">Esta funcionalidad todavía no está disponible</h2>
                <p className="max-w-sm text-sm text-gray-500">
                    La comparación día a día contra datos reales todavía no está conectada. Falta definir, por ejemplo, cuántos minutos de
                    diferencia cuentan como una entrada tardía antes de habilitarla.
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                    <CalendarClock size={14} /> El motor de horarios y marcaciones ya existe — falta esa definición y conectar la vista.
                </p>
            </div>
        </div>
    );
}
CalendarioVsMarcaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar="calendario-marcaciones">{page}</MainLayout>;
