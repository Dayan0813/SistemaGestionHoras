import axios from 'axios';

// Festivos oficiales de Colombia (Ley 51 de 1983 y Ley 35 de 1991 — "Ley Emiliani"): los
// festivos marcados como "trasladable" se mueven al lunes siguiente si no caen ya en lunes.
// Solo es referencia visual en el calendario del asistente de Programaciones — no bloquea ni
// desactiva días automáticamente, el coordinador decide si trabaja ese día o no.
//
// colombianHolidayName() es SÍNCRONA (se llama dentro de .map() al pintar celdas de
// calendario), así que no puede esperar una petición HTTP. Por eso: el cálculo local de abajo
// sigue siendo el valor inmediato para cualquier año no visto todavía, y por separado
// fetchHolidaysForYear() trae los festivos REALES de la tabla `holidays` (backend, fuente de
// verdad — ver App\Support\ColombianHolidays) y los reemplaza en el mismo cache una vez
// llegan, sin bloquear el primer render. Quien muestra el calendario debe llamar
// fetchHolidaysForYear(year) al montar/cambiar de año — ver Programaciones.tsx.

const nextMonday = (date: Date): Date => {
    const result = new Date(date.getTime());
    const day = result.getDay(); // 0=domingo ... 6=sábado
    if (day === 1) return result;
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    result.setDate(result.getDate() + daysUntilMonday);
    return result;
};

// Domingo de Pascua (algoritmo de Gauss/Meeus), base para Jueves/Viernes Santo, Ascensión,
// Corpus Christi y Sagrado Corazón — todos móviles año a año.
const easterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
};

const iso = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** Mapa { 'YYYY-MM-DD': nombre del festivo } para todos los festivos de Colombia en un año dado. */
export const colombianHolidaysForYear = (year: number): Map<string, string> => {
    const holidays = new Map<string, string>();
    const set = (date: Date, name: string) => holidays.set(iso(date), name);

    // Fijos (no se trasladan).
    set(new Date(year, 0, 1), 'Año Nuevo');
    set(new Date(year, 4, 1), 'Día del Trabajo');
    set(new Date(year, 6, 20), 'Grito de Independencia');
    set(new Date(year, 7, 7), 'Batalla de Boyacá');
    set(new Date(year, 11, 8), 'Inmaculada Concepción');
    set(new Date(year, 11, 25), 'Navidad');

    // Ley Emiliani: se trasladan al lunes siguiente.
    set(nextMonday(new Date(year, 0, 6)), 'Reyes Magos');
    set(nextMonday(new Date(year, 2, 19)), 'San José');
    set(nextMonday(new Date(year, 5, 29)), 'San Pedro y San Pablo');
    set(nextMonday(new Date(year, 7, 15)), 'Asunción de la Virgen');
    set(nextMonday(new Date(year, 9, 12)), 'Día de la Raza');
    set(nextMonday(new Date(year, 10, 1)), 'Todos los Santos');
    set(nextMonday(new Date(year, 10, 11)), 'Independencia de Cartagena');

    // Basados en Semana Santa / Pascua.
    const easter = easterSunday(year);
    set(addDays(easter, -3), 'Jueves Santo');
    set(addDays(easter, -2), 'Viernes Santo');
    set(nextMonday(addDays(easter, 39)), 'Ascensión del Señor');
    set(nextMonday(addDays(easter, 60)), 'Corpus Christi');
    set(nextMonday(addDays(easter, 68)), 'Sagrado Corazón de Jesús');

    return holidays;
};

// Cache simple por año: el asistente de Programaciones solo muestra 1-2 meses a la vez, así
// que recalcular por año (en vez de por cada render) es más que suficiente. Arranca con el
// cálculo local; fetchHolidaysForYear() lo reemplaza por los festivos reales de la BD cuando
// llegan (ver comentario de arriba).
const cache = new Map<number, Map<string, string>>();
const fetchedYears = new Set<number>();

/** Nombre del festivo en esa fecha ISO ('YYYY-MM-DD'), o null si no es festivo en Colombia. */
export const colombianHolidayName = (dayISO: string): string | null => {
    const year = Number(dayISO.slice(0, 4));
    if (!cache.has(year)) cache.set(year, colombianHolidaysForYear(year));
    return cache.get(year)!.get(dayISO) ?? null;
};

// Trae los festivos reales de la tabla `holidays` (backend) para un año y reemplaza el cache
// local con ellos — silencioso ante error de red (el cálculo local ya sembrado sigue sirviendo
// de respaldo, mismo criterio que el fallback en App\Support\ColombianHolidays::forYear()).
// Cada año se pide una sola vez por carga de página.
export const fetchHolidaysForYear = async (year: number): Promise<void> => {
    if (fetchedYears.has(year)) return;
    fetchedYears.add(year);

    try {
        const { data } = await axios.get<{ holidays: { date: string; name: string }[] }>('/holidays/range', {
            params: { from: `${year}-01-01`, to: `${year}-12-31` },
        });

        if (data.holidays.length === 0) return; // BD sin sembrar ese año: se conserva el cálculo local.

        const fromDb = new Map<string, string>();
        data.holidays.forEach((h) => fromDb.set(h.date, h.name));
        cache.set(year, fromDb);
    } catch {
        // Sin conexión / sin permiso / lo que sea: el cálculo local ya está en cache, no hace falta avisar.
    }
};
