import { CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatHours, initials, shiftColor, toDate } from './programaciones.helpers';
import type { Calendar } from './programaciones.types';
import { DayTypeBadge, type OperatingDayType } from './useOperatingDays';

export interface SavedAssignment {
    uid: string;
    name: string;
    position: string | null;
    calendar: Calendar;
    isDraft: boolean; // programación subida desde plantilla, aún sin confirmar
}

interface Props {
    // Días (ISO) del período elegido que ya tienen turnos guardados, en orden.
    savedByDay: [string, SavedAssignment[]][];
    totalDays: number;
    operatingDays: Record<string, OperatingDayType>;
}

/**
 * Aviso + vista previa de lo que ya está guardado en el período que se va a programar, para que
 * el coordinador vea que esas fechas ya tienen turnos antes de volver a asignarlas (lo nuevo
 * reemplaza lo guardado en los días que choquen).
 */
export default function AlreadyScheduledPanel({ savedByDay, totalDays, operatingDays }: Props) {
    const [open, setOpen] = useState(true);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const firstDay = savedByDay[0]?.[0] ?? null;

    // Al cambiar el período, vuelve a mostrar el primer día con turnos.
    useEffect(() => {
        if (!selectedDay || !savedByDay.some(([iso]) => iso === selectedDay)) setSelectedDay(firstDay);
    }, [savedByDay, selectedDay, firstDay]);

    if (savedByDay.length === 0) return null;

    const employeeCount = new Set(savedByDay.flatMap(([, rows]) => rows.map((r) => r.uid))).size;
    const rows = savedByDay.find(([iso]) => iso === selectedDay)?.[1] ?? [];
    const dayLabel = (iso: string, options: Intl.DateTimeFormatOptions) => toDate(iso).toLocaleDateString('es-CO', options);

    return (
        <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
            <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <CalendarCheck size={18} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-gray-900">Estas fechas ya tienen programación</h2>
                    <p className="mt-0.5 text-xs text-gray-600">
                        <strong>{savedByDay.length}</strong> de {totalDays} días del período ya tienen turnos guardados (
                        {employeeCount} empleado{employeeCount === 1 ? '' : 's'}). Si los vuelves a programar, lo nuevo reemplaza lo que hay
                        ese día.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                    {open ? (
                        <>
                            Ocultar <ChevronUp size={14} />
                        </>
                    ) : (
                        <>
                            Ver lo programado <ChevronDown size={14} />
                        </>
                    )}
                </button>
            </div>

            {open && (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                        {savedByDay.map(([iso, dayRows]) => {
                            const active = iso === selectedDay;
                            return (
                                <button
                                    key={iso}
                                    type="button"
                                    onClick={() => setSelectedDay(iso)}
                                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                        active
                                            ? 'border-[#a81c24] bg-[#a81c24] text-white'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#a81c24]/40'
                                    }`}
                                >
                                    <span className="capitalize">{dayLabel(iso, { weekday: 'short', day: 'numeric' })}</span>
                                    <DayTypeBadge type={operatingDays[iso]} />
                                    <span
                                        className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}
                                    >
                                        {dayRows.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {selectedDay && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-900 capitalize">
                                {dayLabel(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h3>
                            <div className="divide-y divide-gray-100">
                                {rows.map((row) => (
                                    <div key={row.uid} className="flex items-center gap-3 py-2">
                                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                                            {initials(row.name)}
                                        </span>
                                        <div className="flex min-w-0 flex-1 items-baseline gap-2">
                                            <strong className="flex-none text-sm text-gray-900">{row.name}</strong>
                                            <span className="min-w-0 truncate text-xs text-gray-500">{row.position ?? '—'}</span>
                                        </div>
                                        {row.isDraft && (
                                            <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                                Borrador
                                            </span>
                                        )}
                                        <span
                                            className={`flex-none rounded px-2 py-1 font-mono text-[10px] text-white ${shiftColor(row.calendar.shift_type).badge}`}
                                        >
                                            {formatHours(row.calendar)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
