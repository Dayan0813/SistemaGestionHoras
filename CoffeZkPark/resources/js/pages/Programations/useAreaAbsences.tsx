import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

export type AbsenceType = 'vacaciones' | 'incapacidad';

export interface AreaAbsence {
    employee_uid: string;
    employee_name: string | null;
    type: AbsenceType;
    start_date: string; // 'YYYY-MM-DD'
    end_date: string;
}

// Ausencias activas (vacaciones e incapacidades con fechas) de un área, para que las pantallas
// de programación muestren "Incapacidad"/"Vacaciones" en vez de dejar el día en blanco: al
// crear la ausencia, el turno de esos días se quita de la programación (ver
// EmployeeAbsenceController::hideEmployeeDays()). Si el usuario no puede consultar ausencias,
// simplemente no se muestran.
export function useAreaAbsences(areaId: number | null | undefined) {
    const [absences, setAbsences] = useState<AreaAbsence[]>([]);

    useEffect(() => {
        if (!areaId) {
            setAbsences([]);
            return;
        }
        let cancelled = false;
        axios
            .get(route('ausencias.activeByArea'), { params: { area_id: areaId } })
            .then((res) => !cancelled && setAbsences(res.data.absences ?? []))
            .catch(() => !cancelled && setAbsences([]));
        return () => {
            cancelled = true;
        };
    }, [areaId]);

    // Tipo de ausencia de un empleado un día (ISO 'YYYY-MM-DD'), o null si ese día no está ausente.
    const absenceFor = useCallback(
        (uid: string, dayISO: string): AbsenceType | null =>
            absences.find((a) => a.employee_uid === uid && dayISO >= a.start_date && dayISO <= a.end_date)?.type ?? null,
        [absences],
    );

    // Ausencias que caen ese día (ISO), con el nombre del empleado.
    const absencesOn = useCallback(
        (dayISO: string): AreaAbsence[] => absences.filter((a) => dayISO >= a.start_date && dayISO <= a.end_date),
        [absences],
    );

    return { absenceFor, absencesOn };
}

const ABSENCE_STYLES: Record<AbsenceType, { label: string; short: string; className: string }> = {
    incapacidad: { label: 'Incapacidad', short: 'INC', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    vacaciones: { label: 'Vacaciones', short: 'VAC', className: 'bg-sky-100 text-sky-700 border-sky-200' },
};

// Etiqueta de ausencia: "Incapacidad"/"Vacaciones", o "INC"/"VAC" en celdas angostas.
export function AbsenceBadge({ type, short = false, className = '' }: { type: AbsenceType; short?: boolean; className?: string }) {
    const style = ABSENCE_STYLES[type];
    return (
        <span
            title={`${style.label}: no trabaja este día`}
            className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${style.className} ${className}`}
        >
            {short ? style.short : style.label}
        </span>
    );
}
