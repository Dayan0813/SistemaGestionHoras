// Rango de fechas [start,end] (ISO 'YYYY-MM-DD', inclusivo) marcado como temporada alta —
// configuración GLOBAL para toda la empresa (ver Areas/Index.tsx y CompanySetting en backend).
export interface HighSeasonRange {
    start: string;
    end: string;
}

export interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
}

export interface Employee {
    uid: string;
    name: string;
    estado: string;
    cargo?: { name: string } | null;
    contrato?: { name: string } | null;
    // Saldo de vacaciones fraccionable (default 15, descontado al registrar una ausencia tipo
    // "vacaciones" — ver EmployeeAbsenceController::store()). Ausente si el endpoint que trajo
    // este empleado no lo incluyó explícitamente.
    dias_vacaciones_disponibles?: number;
}

export interface WorkPosition {
    id: number;
    area_id: number;
    attraction: string;
    name: string;
    active: boolean;
}

export interface ProgramationOverride {
    id: number;
    date: string;
    calendar: Calendar;
    work_position_id: number | null;
}

export interface Programation {
    id: number;
    calendar_id: number;
    work_position_id: number | null;
    status: string;
    start_date: string;
    end_date: string;
    work_days: number[] | null;
    calendar: Calendar;
    overrides: ProgramationOverride[];
}

export interface EmployeeSchedule {
    uid: string;
    programations: Programation[];
}

// Una "intención de asignar" que todavía no se subió al servidor.
export interface DraftBatch {
    id: string;
    calendarId: number;
    workPositionId: number | null;
    employeeUids: string[];
    startDate: string;
    endDate: string;
    workDays?: number[];
}

export interface DraftState {
    startDate: string;
    duration: number;
    selectedWeekdays: number[];
    selectedDates?: string[];
    batches: DraftBatch[];
    selectedAttraction?: string | null;
    selectedWorkPositionId?: number | null;
    positionEmployeeUids?: Record<number, string[]>;
    savedAt?: number;
}

// Rectángulo de anclaje para posicionar un popover flotante (ShiftPickerPopover) relativo
// al botón que lo abrió.
export interface AnchorRect {
    top: number;
    left: number;
    width: number;
    bottom: number;
}
