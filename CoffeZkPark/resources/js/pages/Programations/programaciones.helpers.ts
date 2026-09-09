import type { Calendar, DraftBatch, EmployeeSchedule, HighSeasonRange, Programation } from './programaciones.types';

// true si dayISO (ISO 'YYYY-MM-DD') cae dentro de alguno de los rangos de temporada alta.
export const isHighSeasonDate = (dayISO: string, ranges: HighSeasonRange[]): boolean =>
    ranges.some((range) => dayISO >= range.start && dayISO <= range.end);

// Política de la empresa SOLO para áreas de jornada fija: el lunes se trabaja máximo hasta el
// medio día y el martes hasta las 4:00pm, sin importar el turno asignado — si el turno termina
// después de ese tope ese día puntual, las horas se cuentan solo hasta el tope (no se cambia el
// turno guardado, solo el cálculo de horas efectivas). Mismo criterio que
// AreaScheduleExport::hoursForEmployeeDay() en el backend (constantes replicadas allá porque
// PHP y TS no pueden compartir código; aquí unificado para no tener dos copias TS a mano).
const FIXED_AREA_MONDAY_CUTOFF_MINUTES = 12 * 60;
const FIXED_AREA_TUESDAY_CUTOFF_MINUTES = 16 * 60;

export const applyFixedAreaCutoff = (hours: number, horaEntrada: string | null | undefined, dayISO: string): number => {
    if (!horaEntrada) return hours;

    const weekday = isoWeekday(toDate(dayISO));
    const cutoffMinutes = weekday === 1 ? FIXED_AREA_MONDAY_CUTOFF_MINUTES : weekday === 2 ? FIXED_AREA_TUESDAY_CUTOFF_MINUTES : null;
    if (cutoffMinutes === null) return hours;

    const [inH, inM] = horaEntrada.split(':').map(Number);
    const entradaMinutes = inH * 60 + inM;
    if (entradaMinutes >= cutoffMinutes) return hours; // turno nocturno u otro caso raro: no recortar a negativo.
    return Math.min(hours * 60, cutoffMinutes - entradaMinutes) / 60;
};

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

// El puesto normalmente es del rango completo (programation.work_position_id), pero un día que
// choca con una programación existente se reemplaza vía excepción puntual (ver
// ProgramationsController::store) y esa excepción puede traer su propio puesto. Una excepción
// que solo cambió el turno (creada por bulkOverride/applyDayOverrides) no trae puesto propio
// (queda null) — en ese caso hay que seguir usando el puesto de la fila, no perderlo.
export const getWorkPositionIdForDay = (programation: Programation, dayISO: string) => {
    const override = programation.overrides?.find((o) => o.date.slice(0, 10) === dayISO);
    return override?.work_position_id ?? programation.work_position_id;
};

export const formatHours = (calendar: Calendar) =>
    calendar.hora_entrada && calendar.hora_salida
        ? `${calendar.hora_entrada.slice(0, 5)} – ${calendar.hora_salida.slice(0, 5)}`
        : 'Horario no definido';

// Duración de un turno en horas decimales, saltando a la medianoche del día siguiente si la
// salida es antes o igual que la entrada (turno nocturno) — mismo criterio que
// AreaScheduleGrid.tsx y AreaScheduleExport.php.
export const shiftHours = (calendar: Calendar): number => {
    if (!calendar.hora_entrada || !calendar.hora_salida) return 0;
    const [inH, inM] = calendar.hora_entrada.split(':').map(Number);
    const [outH, outM] = calendar.hora_salida.split(':').map(Number);
    let minutes = outH * 60 + outM - (inH * 60 + inM);
    if (minutes <= 0) minutes += 24 * 60;
    return minutes / 60;
};

// Clave año-semana ISO (lunes a domingo) de una fecha, para agrupar horas por semana calendario
// igual que weekGroups() en AreaScheduleExport.php.
export const isoWeekKey = (date: Date): string => {
    const target = new Date(date.getTime());
    target.setHours(0, 0, 0, 0);
    // Jueves de esa semana ISO determina el año-semana.
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return `${target.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};
export const shiftColor = (type: 'D' | 'N') =>
    type === 'D'
        ? {
              badge: 'bg-[#95c020]',
              text: 'text-[#5e7a15]',
              soft: 'bg-[#eaf3d3]',
              softText: 'text-[#5e7a15]',
              border: 'border-[#95c020]',
              dot: 'bg-[#95c020]',
          }
        : {
              badge: 'bg-slate-700',
              text: 'text-slate-700',
              soft: 'bg-slate-100',
              softText: 'text-slate-700',
              border: 'border-slate-700',
              dot: 'bg-slate-700',
          };
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
export const contractTextColor = (name?: string | null) =>
    name?.toLowerCase().includes('temporal') ? 'font-medium text-amber-600' : 'text-gray-600';
