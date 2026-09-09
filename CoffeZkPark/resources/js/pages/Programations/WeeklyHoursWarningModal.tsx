import ConfirmModal from '@/Components/confirmModal';

export interface WeeklyHourOverage {
    employeeName: string;
    weekKey: string;
    hours: number;
}

interface Props {
    overages: WeeklyHourOverage[];
    maxWeeklyHours: number;
    onConfirm: () => void;
    onCancel: () => void;
}

// Formatea "2026-W32" como "Semana 32 de 2026" para que se lea igual de claro que el resto
// de la app (nadie sabe de memoria qué semana ISO es la 32).
const formatWeekLabel = (weekKey: string) => {
    const [year, week] = weekKey.split('-W');
    return `Semana ${Number(week)} · ${year}`;
};

// Advertencia (no bloqueo) de que una programación deja a uno o más empleados por encima de
// las horas semanales legales permitidas. Se apoya en el ConfirmModal genérico (variant
// "warning") para mantener un solo componente de confirmación en toda la app; la lista de
// empleados afectados va en el slot `children`.
export default function WeeklyHoursWarningModal({ overages, maxWeeklyHours, onConfirm, onCancel }: Props) {
    if (overages.length === 0) return null;

    return (
        <ConfirmModal
            show
            variant="warning"
            title="Horas semanales por encima de lo permitido"
            message={`${
                overages.length === 1 ? 'Esta programación deja a 1 empleado' : `Esta programación deja a ${overages.length} empleados`
            } por encima de ${maxWeeklyHours}h semanales permitidas.`}
            confirmLabel="Subir de todas formas"
            onConfirm={onConfirm}
            onClose={onCancel}
        >
            <ul className="divide-y divide-gray-100">
                {overages.map((o, index) => (
                    <li key={`${o.employeeName}-${o.weekKey}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">{o.employeeName}</p>
                            <p className="text-xs text-gray-500">{formatWeekLabel(o.weekKey)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#fdecea] px-2.5 py-1 text-xs font-bold text-[#a81c24]">{o.hours.toFixed(1)}h</span>
                    </li>
                ))}
            </ul>
        </ConfirmModal>
    );
}
