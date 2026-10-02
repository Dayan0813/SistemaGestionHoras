import { AlertTriangle, CalendarX2, Clock, DoorClosed, Users, X } from 'lucide-react';
import { useMemo } from 'react';
import { initials, toDate } from './programaciones.helpers';
import { dayTypeShortName, dayTypeTitle } from './useOperatingDays';

// Problemas de contrato que devuelve el backend (WeeklyStaffingValidator::validate()), tanto al
// subir la plantilla Excel como al validar el borrador de la pantalla.
export type StaffingIssue =
    | { kind: 'fijo_hours'; employee: string; week_start: string; week_end: string; hours: number; required: number; message: string }
    | { kind: 'temporal_day'; employee: string; date: string; message: string }
    | { kind: 'min_staff'; date: string; day_type: string; color: string; scheduled: number; required: number; message: string }
    | { kind: 'park_closed'; employee: string; date: string; message: string };

interface Props {
    issues: StaffingIssue[];
    onClose?: () => void;
}

const shortDate = (iso: string) => toDate(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
const weekdayDate = (iso: string) =>
    toDate(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
const hoursLabel = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`;

// "Diego (34567876)" -> nombre y cédula por separado, para mostrar la cédula en gris.
const splitLabel = (label: string) => {
    const match = label.match(/^(.*?)\s*\(([^()]+)\)$/);
    return match ? { name: match[1], doc: match[2] } : { name: label, doc: null };
};

function EmployeeHeader({ label, badge, badgeClass, right }: { label: string; badge: string; badgeClass: string; right: string }) {
    const { name, doc } = splitLabel(label);
    return (
        <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a81c24]/10 text-xs font-bold text-[#a81c24]">
                {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                    {name} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase ${badgeClass}`}>{badge}</span>
                </p>
                {doc && <p className="text-[11px] text-gray-400">C.C. {doc}</p>}
            </div>
            <span className="shrink-0 text-xs font-semibold text-[#a81c24]">{right}</span>
        </div>
    );
}

// Panel de "no se guardó" agrupado por empleado: los fijos con una barra de horas por semana
// (programadas vs. mínimo) y los temporales con los días en que no había ningún fijo faltando.
export default function StaffingIssuesPanel({ issues, onClose }: Props) {
    const { fijos, temporales, shortDays, closedDays } = useMemo(() => {
        const fijos = new Map<string, Extract<StaffingIssue, { kind: 'fijo_hours' }>[]>();
        const temporales = new Map<string, string[]>();
        const shortDays: Extract<StaffingIssue, { kind: 'min_staff' }>[] = [];
        // Fecha de parque cerrado => empleados programados ese día (área variable).
        const closedDays = new Map<string, string[]>();
        for (const issue of issues) {
            if (issue.kind === 'fijo_hours') {
                fijos.set(issue.employee, [...(fijos.get(issue.employee) ?? []), issue]);
            } else if (issue.kind === 'temporal_day') {
                temporales.set(issue.employee, [...(temporales.get(issue.employee) ?? []), issue.date]);
            } else if (issue.kind === 'park_closed') {
                closedDays.set(issue.date, [...(closedDays.get(issue.date) ?? []), issue.employee]);
            } else {
                shortDays.push(issue);
            }
        }
        shortDays.sort((a, b) => a.date.localeCompare(b.date));
        return {
            fijos: [...fijos.entries()],
            temporales: [...temporales.entries()],
            shortDays,
            closedDays: [...closedDays.entries()].sort(([a], [b]) => a.localeCompare(b)),
        };
    }, [issues]);

    if (issues.length === 0) return null;

    const summary = [
        fijos.length > 0 && `${fijos.length} fijo${fijos.length > 1 ? 's' : ''} sin las horas mínimas`,
        temporales.length > 0 && `${temporales.length} temporal${temporales.length > 1 ? 'es' : ''} en días sin faltantes`,
        shortDays.length > 0 && `${shortDays.length} día${shortDays.length > 1 ? 's' : ''} sin el personal mínimo`,
        closedDays.length > 0 && `${closedDays.length} día${closedDays.length > 1 ? 's' : ''} programado${closedDays.length > 1 ? 's' : ''} con el parque cerrado`,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className="overflow-hidden rounded-2xl border border-[#a81c24]/20 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-[#a81c24]/10 bg-[#fdf0f0] px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#a81c24]/10">
                    <AlertTriangle className="h-5 w-5 text-[#a81c24]" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#a81c24]">No se guardó la programación</h3>
                    <p className="mt-0.5 text-xs text-gray-600">{summary}. Corrige y vuelve a subirla; no se creó nada.</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-600" title="Cerrar">
                        <X size={16} />
                    </button>
                )}
            </div>

            <div className="max-h-[28rem] space-y-6 overflow-y-auto px-5 py-5">
                {closedDays.length > 0 && (
                    <section>
                        <h4 className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
                            <DoorClosed size={14} /> Turnos con el parque cerrado
                        </h4>
                        <p className="mb-3 text-xs text-gray-500">
                            Los lunes y martes fuera de temporada alta el parque está cerrado y el área descansa. Quita estos turnos.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {closedDays.map(([date, employees]) => (
                                <div key={date} className="rounded-xl border border-gray-200 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-gray-800 capitalize">{weekdayDate(date)}</span>
                                        <span className="rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Cerrado</span>
                                    </div>
                                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                                        {employees.map((employee) => (
                                            <li key={employee} className="truncate">
                                                {splitLabel(employee).name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {shortDays.length > 0 && (
                    <section>
                        <h4 className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
                            <Users size={14} /> Días sin el personal mínimo del calendario operativo
                        </h4>
                        <p className="mb-3 text-xs text-gray-500">El administrador define cuántas personas necesita el área según el tipo de día.</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {shortDays.map((day) => (
                                <div key={day.date} className="rounded-xl border border-gray-200 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-gray-800 capitalize">{weekdayDate(day.date)}</span>
                                        <span
                                            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                                            style={{ backgroundColor: day.color }}
                                            title={dayTypeTitle(day.day_type)}
                                        >
                                            {dayTypeShortName(day.day_type)}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-lg leading-none font-bold text-[#a81c24]">
                                        {day.scheduled}
                                        <span className="text-xs font-medium text-gray-400"> / {day.required} personas</span>
                                    </p>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                        <div
                                            className="h-full rounded-full bg-[#a81c24]"
                                            style={{ width: `${Math.max((day.scheduled / day.required) * 100, 2)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {fijos.length > 0 && (
                    <section>
                        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
                            <Clock size={14} /> Fijos que no completan las 42 horas semanales
                        </h4>
                        <div className="grid gap-3 md:grid-cols-2">
                            {fijos.map(([employee, weeks]) => {
                                const missing = weeks.reduce((sum, w) => sum + Math.max(0, w.required - w.hours), 0);
                                return (
                                    <div key={employee} className="rounded-xl border border-gray-200 p-4">
                                        <EmployeeHeader
                                            label={employee}
                                            badge="Fijo"
                                            badgeClass="bg-[#eaf3d3] text-[#5e7a15]"
                                            right={`Faltan ${hoursLabel(missing)}`}
                                        />
                                        <ul className="mt-3 space-y-2.5">
                                            {weeks.map((w) => {
                                                const ratio = w.required > 0 ? Math.min(1, w.hours / w.required) : 0;
                                                return (
                                                    <li key={w.week_start}>
                                                        <div className="mb-1 flex justify-between text-[11px]">
                                                            <span className="text-gray-600">
                                                                {shortDate(w.week_start)} – {shortDate(w.week_end)}
                                                            </span>
                                                            <span className="font-semibold text-gray-800">
                                                                {hoursLabel(w.hours)} <span className="font-normal text-gray-400">/ {hoursLabel(w.required)}</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                                                            <div
                                                                className={`h-full rounded-full ${ratio >= 0.75 ? 'bg-[#f0b429]' : 'bg-[#a81c24]'}`}
                                                                style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                                                            />
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {temporales.length > 0 && (
                    <section>
                        <h4 className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
                            <CalendarX2 size={14} /> Temporales en días en que trabajan todos los fijos
                        </h4>
                        <p className="mb-3 text-xs text-gray-500">Un temporal solo puede cubrir un día en que falte algún fijo (descanso, VAC o INC).</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            {temporales.map(([employee, dates]) => (
                                <div key={employee} className="rounded-xl border border-gray-200 p-4">
                                    <EmployeeHeader
                                        label={employee}
                                        badge="Temporal"
                                        badgeClass="bg-amber-100 text-amber-700"
                                        right={`${dates.length} día${dates.length > 1 ? 's' : ''}`}
                                    />
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {[...dates].sort().map((date) => (
                                            <span key={date} className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 capitalize">
                                                {weekdayDate(date)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <p className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-[11px] text-gray-500">
                Cada día de VAC o INC cuenta como 7h. En la plantilla, la primera y la última semana del mes se exigen en proporción a sus días.
            </p>
        </div>
    );
}
