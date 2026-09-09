import { colombianHolidayName } from './Programations/colombianHolidays';
// toDate/toIsoDate/isoWeekday/isHighSeasonDate ya existen en programaciones.helpers.ts — se
// reutilizan aquí en vez de redefinirlos, para no mantener dos copias del mismo cálculo (fecha
// sin corrimiento de zona horaria, convención de día ISO, regla de "dentro de un rango") que
// puedan desincronizarse con una futura corrección aplicada solo a una de las dos.
import { isHighSeasonDate, isoWeekday, toDate, toIsoDate } from './Programations/programaciones.helpers';
import type { HighSeasonRange } from './Programations/programaciones.types';

export type { HighSeasonRange };
export { toIsoDate };
export const isHighSeasonDay = isHighSeasonDate;

// Mismo criterio que ColombianHolidays::isBusinessDay() en el backend: sin fin de semana ni
// festivo colombiano — reutiliza el mismo cálculo de festivos que ya usa el asistente de
// Programaciones (colombianHolidays.ts), solo para no duplicar el algoritmo de Ley Emiliani.
export const isBusinessDay = (dayISO: string): boolean => {
    const weekday = isoWeekday(toDate(dayISO));
    if (weekday === 6 || weekday === 7) return false;
    return colombianHolidayName(dayISO) === null;
};

// Días hábiles ('YYYY-MM-DD') dentro de un rango inclusivo — para el contador en vivo del
// modal de planificación anual. El backend vuelve a calcular esto de forma autoritativa en
// EmployeeAbsenceController::storePlan(); esto es solo feedback inmediato en cliente.
export const businessDaysInRange = (startISO: string, endISO: string): string[] => {
    if (!startISO || !endISO || startISO > endISO) return [];
    const days: string[] = [];
    const cursor = toDate(startISO);
    const end = toDate(endISO);
    while (cursor <= end) {
        const dayISO = toIsoDate(cursor);
        if (isBusinessDay(dayISO)) days.push(dayISO);
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
};

// Fecha fin (ISO) tal que el rango [startISO, fin] contenga EXACTAMENTE targetBusinessDays
// días hábiles — avanza día a día saltando sáb/dom/festivos. Para el atajo rápido "Vac." de
// Programaciones.tsx, donde el coordinador elige "7 días" o "15 días" (hábiles) en vez de un
// rango de fechas manual.
export const endDateForBusinessDays = (startISO: string, targetBusinessDays: number): string => {
    if (!startISO || targetBusinessDays < 1) return '';
    const cursor = toDate(startISO);
    let counted = 0;
    let last = startISO;
    while (counted < targetBusinessDays) {
        const dayISO = toIsoDate(cursor);
        last = dayISO;
        if (isBusinessDay(dayISO)) counted++;
        if (counted < targetBusinessDays) cursor.setDate(cursor.getDate() + 1);
    }
    return last;
};

// Todas las fechas ('YYYY-MM-DD') del rango inclusivo, sin filtrar — para la vista previa del
// modal, que marca visualmente cuáles de esas fechas son hábiles y cuáles no.
export const allDatesInRange = (startISO: string, endISO: string): string[] => {
    if (!startISO || !endISO || startISO > endISO) return [];
    const days: string[] = [];
    const cursor = toDate(startISO);
    const end = toDate(endISO);
    while (cursor <= end) {
        days.push(toIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
};

// true si a plannedMonth ('YYYY-MM', una reserva de vacaciones sin fechas exactas todavía) le
// faltan <= reminderMonths meses para llegar (o ya pasó) — momento en que se avisa al
// coordinador que ya debería definir las fechas reales. Mismo criterio en Programaciones.tsx
// y PlanVacaciones.tsx.
export const isReservationDue = (plannedMonth: string, reminderMonths: number, today: Date = new Date()): boolean => {
    const [y, m] = plannedMonth.split('-').map(Number);
    const monthsUntil = (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
    return monthsUntil <= reminderMonths;
};
