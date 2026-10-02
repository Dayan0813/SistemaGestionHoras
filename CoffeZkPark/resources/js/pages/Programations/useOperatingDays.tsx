import axios from 'axios';
import { useEffect, useState } from 'react';

// Tipo de día del calendario operativo (AA, A, B, C...) que define el administrador en
// "Calendario operativo" — ver OperatingCalendarController::days().
export interface OperatingDayType {
    id: number;
    name: string;
    color: string;
    // Solo si se pidió con un área: personas que el área debe tener programadas ese día
    // (null = el administrador no definió mínimo para este tipo de día en esa área).
    min_staff?: number | null;
}

// El administrador puede nombrar los tipos "B" o "Calendario B": para las etiquetas pequeñas se
// quita el prefijo, y para los textos se agrega solo si no lo trae.
export const dayTypeShortName = (name: string) => name.replace(/^calendario\s+/i, '');
export const dayTypeTitle = (name: string) => (/^calendario\b/i.test(name) ? name : `Calendario ${name}`);

// Fecha ISO ('YYYY-MM-DD') => tipo de día, para las fechas de [from, to] que tienen tipo asignado.
// Con areaId, cada día trae también el personal mínimo de esa área.
export function useOperatingDays(from: string | null, to: string | null, areaId?: number | null): Record<string, OperatingDayType> {
    const [days, setDays] = useState<Record<string, OperatingDayType>>({});

    useEffect(() => {
        if (!from || !to) return;
        let cancelled = false;
        axios
            .get(route('operatingCalendar.days'), { params: { from, to, ...(areaId ? { area_id: areaId } : {}) } })
            .then((res) => {
                if (!cancelled) setDays(res.data ?? {});
            })
            .catch(() => {
                if (!cancelled) setDays({});
            });
        return () => {
            cancelled = true;
        };
    }, [from, to, areaId]);

    return days;
}

// Etiqueta de color con el nombre del tipo de día (ej. "B"), para encabezados de día.
export function DayTypeBadge({ type, className = '' }: { type?: OperatingDayType; className?: string }) {
    if (!type) return null;
    return (
        <span
            className={`inline-block rounded px-1.5 py-px text-[10px] leading-tight font-bold text-white ${className}`}
            style={{ backgroundColor: type.color }}
            title={dayTypeTitle(type.name)}
        >
            {dayTypeShortName(type.name)}
        </span>
    );
}

// Versión mínima para las celdas pequeñas de los calendarios mensuales: el tipo en la esquina
// superior derecha de la celda (que debe tener `relative`).
export function DayTypeCorner({ type }: { type?: OperatingDayType }) {
    if (!type) return null;
    return (
        <span
            className="pointer-events-none absolute -top-1 -right-1 rounded px-1 text-[8px] leading-[12px] font-bold text-white shadow-sm"
            style={{ backgroundColor: type.color }}
            title={dayTypeTitle(type.name)}
        >
            {dayTypeShortName(type.name)}
        </span>
    );
}

// "3/4": personas programadas ese día contra las que pide el calendario operativo. Roja si
// faltan, verde si ya se cumple. No pinta nada si el día no tiene mínimo definido.
export function StaffingCount({ type, scheduled, size = 'sm' }: { type?: OperatingDayType; scheduled: number; size?: 'xs' | 'sm' }) {
    const required = type?.min_staff;
    if (!type || !required) return null;
    const ok = scheduled >= required;
    return (
        <span
            className={`inline-flex items-center rounded-full font-bold ${size === 'xs' ? 'px-1 text-[9px] leading-[13px]' : 'px-2 py-0.5 text-[11px]'} ${
                ok ? 'bg-[#eaf3d3] text-[#5e7a15]' : 'bg-[#fdf0f0] text-[#a81c24]'
            }`}
            title={`${dayTypeTitle(type.name)}: ${scheduled} de ${required} personas programadas${ok ? '' : ` — faltan ${required - scheduled}`}`}
        >
            {scheduled}/{required}
        </span>
    );
}

// Aviso dentro de la ventana de un día: cuántas personas pide el calendario operativo ese día
// para el área, cuántas van programadas y cuántas faltan.
export function StaffingRequirementBanner({ type, scheduled }: { type?: OperatingDayType; scheduled: number }) {
    const required = type?.min_staff;
    if (!type || !required) return null;
    const missing = required - scheduled;
    const ok = missing <= 0;
    return (
        <div
            className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${
                ok ? 'border-[#95c020]/40 bg-[#f4faea]' : 'border-[#a81c24]/20 bg-[#fdf0f0]'
            }`}
        >
            <span className="rounded-md px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: type.color }}>
                {dayTypeShortName(type.name)}
            </span>
            <div className="min-w-0 flex-1 text-xs">
                <p className={`font-semibold ${ok ? 'text-[#5e7a15]' : 'text-[#a81c24]'}`}>
                    {ok ? 'Personal completo para este día' : `Faltan ${missing} persona${missing === 1 ? '' : 's'} por programar`}
                </p>
                <p className="text-gray-500">
                    {dayTypeTitle(type.name)}: el área necesita {required} persona{required === 1 ? '' : 's'}; llevas {scheduled}.
                </p>
            </div>
            <span className={`text-lg font-black ${ok ? 'text-[#5e7a15]' : 'text-[#a81c24]'}`}>
                {scheduled}/{required}
            </span>
        </div>
    );
}
