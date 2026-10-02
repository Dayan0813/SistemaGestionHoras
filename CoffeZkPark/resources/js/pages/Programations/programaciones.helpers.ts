import type { Calendar, DraftBatch, EmployeeSchedule, HighSeasonRange, Programation } from './programaciones.types';

// true si dayISO (ISO 'YYYY-MM-DD') cae dentro de alguno de los rangos de temporada alta.
export const isHighSeasonDate = (dayISO: string, ranges: HighSeasonRange[]): boolean =>
    ranges.some((range) => dayISO >= range.start && dayISO <= range.end);

// Hora de salida de las áreas fijas los días de parque cerrado, por día de la semana
// (isoWeekday => 'HH:MM'). La configura el administrador en el Calendario operativo y llega
// compartida en auth.user.park_closed_exit_times — estos son solo los valores por defecto.
export type ClosedDayExitTimes = Record<number, string>;
export const DEFAULT_CLOSED_DAY_EXIT_TIMES: ClosedDayExitTimes = { 1: '13:00', 2: '16:00' };

// El parque cierra los lunes y martes salvo en temporada alta: esos días las áreas fijas salen
// temprano y las áreas variables (Operaciones) descansan. Mismo criterio que
// OperatingCalendar::isParkClosed() en el backend.
export const isParkClosed = (dayISO: string, highSeasonRanges: HighSeasonRange[], exitTimes: ClosedDayExitTimes = DEFAULT_CLOSED_DAY_EXIT_TIMES): boolean =>
    isoWeekday(toDate(dayISO)) in exitTimes && !isHighSeasonDate(dayISO, highSeasonRanges);

// Política SOLO para áreas de jornada fija, en un día de parque cerrado: se sale a la hora
// configurada sin importar el turno asignado — las horas se cuentan solo hasta ese tope (no se
// cambia el turno guardado). Quien llama decide si el día está cerrado (isParkClosed()); mismo
// cálculo que ShiftHours::forDay() en el backend.
export const applyFixedAreaCutoff = (
    hours: number,
    horaEntrada: string | null | undefined,
    dayISO: string,
    exitTimes: ClosedDayExitTimes = DEFAULT_CLOSED_DAY_EXIT_TIMES,
): number => {
    if (!horaEntrada) return hours;

    const exit = exitTimes[isoWeekday(toDate(dayISO))];
    if (!exit) return hours;
    const [exitH, exitM] = exit.split(':').map(Number);
    const cutoffMinutes = exitH * 60 + exitM;

    const [inH, inM] = horaEntrada.split(':').map(Number);
    const entradaMinutes = inH * 60 + inM;
    if (entradaMinutes >= cutoffMinutes) return hours; // turno nocturno u otro caso raro: no recortar a negativo.
    return Math.min(hours * 60, cutoffMinutes - entradaMinutes) / 60;
};

// El período a programar va siempre en semanas completas de lunes a domingo, para que cuadre con
// las vistas y exportaciones por semana.
export const durationOptions = [
    { days: 7, label: '1 semana' },
    { days: 14, label: '2 semanas' },
    { days: 28, label: '4 semanas' },
    { days: 56, label: '8 semanas' },
];
// Una duración guardada de antes (15, 30, 60 días...) pasa a la opción en semanas más cercana.
export const normalizeDuration = (days: number) =>
    durationOptions.reduce((best, option) => (Math.abs(option.days - days) < Math.abs(best.days - days) ? option : best)).days;

export const toDate = (value: string) => new Date(`${value}T00:00:00`);
export const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
// Lunes de la semana del día dado (ISO 'YYYY-MM-DD').
export const mondayOf = (dayISO: string) => {
    const date = toDate(dayISO);
    date.setDate(date.getDate() - (isoWeekday(date) - 1));
    return toIsoDate(date);
};
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

// Semanas (lunes a domingo) que tocan un mes, para exportar la programación por semana —
// la primera y la última pueden cruzar al mes anterior/siguiente, igual que en el backend
// (ProgramationsController::normalizeWeekStart()). month es 1-12; start va en 'YYYY-MM-DD'.
export const weeksOfMonth = (year: number, month: number): { start: string; label: string }[] => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const lastDay = new Date(year, month, 0);
    const monday = new Date(year, month - 1, 1);
    monday.setDate(monday.getDate() - (isoWeekday(monday) - 1));

    const weeks: { start: string; label: string }[] = [];
    while (monday <= lastDay) {
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        weeks.push({ start: iso(monday), label: `Semana ${weeks.length + 1} (${formatDay(monday)} - ${formatDay(sunday)})` });
        monday.setDate(monday.getDate() + 7);
    }
    return weeks;
};
