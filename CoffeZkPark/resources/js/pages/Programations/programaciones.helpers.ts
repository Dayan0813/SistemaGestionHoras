import type { Calendar, DraftBatch, EmployeeSchedule, Programation } from './programaciones.types';

export const durationOptions = [
    { days: 7, label: '1 semana' },
    { days: 15, label: '15 días' },
    { days: 30, label: '1 mes' },
    { days: 60, label: '2 meses' },
];

export const toDate = (value: string) => new Date(`${value}T00:00:00`);
export const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
export const allIsoDatesInRange = (start: string, days: number) =>
    Array.from({ length: days }, (_, index) => {
        const date = toDate(start);
        date.setDate(date.getDate() + index);
        return toIsoDate(date);
    });
export const formatDay = (value: Date) => value.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
export const formatRangeLabel = (datesInRange: Date[]) => {
    const first = datesInRange[0];
    const last = datesInRange[datesInRange.length - 1];
    return `${first.toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })} – ${last.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`;
};
export const monthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
export const monthCalendar = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const totalDays = new Date(year, month, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    return [...Array(blanks).fill(null), ...Array.from({ length: totalDays }, (_, index) => new Date(year, month - 1, index + 1))];
};

// Agrupa fechas ISO sueltas en bloques de días consecutivos (el backend solo acepta un rango continuo por petición).
export const toContiguousRanges = (isoDates: string[]) => {
    const sorted = [...isoDates].sort();
    const ranges: { start: string; end: string }[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const expectedNext = toDate(prev);
        expectedNext.setDate(expectedNext.getDate() + 1);
        if (current === toIsoDate(expectedNext)) {
            prev = current;
            continue;
        }
        ranges.push({ start, end: prev });
        start = current;
        prev = current;
    }
    ranges.push({ start, end: prev });
    return ranges;
};

export const newBatchId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 1=Lunes ... 7=Domingo, igual convención que Carbon::dayOfWeekIso en el backend.
export const isoWeekday = (date: Date) => (date.getDay() === 0 ? 7 : date.getDay());

// Misma comparación por string ISO (recortado a 10 caracteres) que usa DetailsProgramations.tsx,
// para evitar el corrimiento de día por timezone al re-parsear fechas del backend. Si la
// programación tiene work_days (modo "fijo"), además exige que el día de la semana esté incluido.
export const coversDay = (p: Programation, dayISO: string) => {
    if (dayISO < p.start_date.slice(0, 10) || dayISO > p.end_date.slice(0, 10)) return false;
    if (!p.work_days || p.work_days.length === 0) return true;
    return p.work_days.includes(isoWeekday(toDate(dayISO)));
};
export const getProgramationForDay = (schedule: EmployeeSchedule | undefined, dayISO: string) =>
    schedule?.programations.find((p) => coversDay(p, dayISO)) ?? null;

// Misma lógica que coversDay, pero para un batch del borrador todavía sin subir (fechas
// sin timestamp, así que se comparan directo sin recortar).
export const batchCoversDay = (batch: DraftBatch, dayISO: string) => {
    if (dayISO < batch.startDate || dayISO > batch.endDate) return false;
    if (!batch.workDays || batch.workDays.length === 0) return true;
    return batch.workDays.includes(isoWeekday(toDate(dayISO)));
};

export const getCalendarForDay = (programation: Programation, dayISO: string) =>
    programation.overrides?.find((o) => o.date.slice(0, 10) === dayISO)?.calendar ?? programation.calendar;

export const formatHours = (calendar: Calendar) =>
    calendar.hora_entrada && calendar.hora_salida ? `${calendar.hora_entrada.slice(0, 5)} – ${calendar.hora_salida.slice(0, 5)}` : 'Horario no definido';
export const shiftColor = (type: 'D' | 'N') =>
    type === 'D'
        ? { badge: 'bg-[#95c020]', text: 'text-[#5e7a15]', soft: 'bg-[#eaf3d3]', softText: 'text-[#5e7a15]', border: 'border-[#95c020]', dot: 'bg-[#95c020]' }
        : { badge: 'bg-slate-700', text: 'text-slate-700', soft: 'bg-slate-100', softText: 'text-slate-700', border: 'border-slate-700', dot: 'bg-slate-700' };
export const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
// Los tipos de contrato son texto libre (se gestionan desde el catálogo), así
// que solo se resalta en ámbar cuando el nombre sugiere "temporal"; cualquier
// otro (Fijo, Indefinido, etc.) se ve en el tono neutro/verde del resto de la UI.
export const contractTextColor = (name?: string | null) => (name?.toLowerCase().includes('temporal') ? 'font-medium text-amber-600' : 'text-gray-600');
