import ConfirmModal from '@/Components/confirmModal';
import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { AlertTriangle, CalendarOff, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Autocomplete from './WorkConsolidation/EmployeeAutocomplete';

interface EmployeeOption {
    uid: string;
    name: string;
    area_id: number | null;
}

interface ScheduleRange {
    start_date: string;
    end_date: string;
    shift_type: 'D' | 'N' | null;
    hora_entrada: string | null;
    hora_salida: string | null;
}

interface AbsenceRow {
    id: number;
    type: 'vacaciones' | 'incapacidad';
    // null cuando es una reserva de mes del plan de vacaciones sin fechas exactas todavía (ver
    // planned_month) — mismo caso que PlanVacaciones.tsx.
    start_date: string | null;
    end_date: string | null;
    planned_month: string | null;
    status: 'Activa' | 'Cancelada';
    notes: string | null;
    employee: { uid: string; name: string } | null;
    replacement_employee: { uid: string; name: string } | null;
    area: { id: number; nombre: string } | null;
}

interface CurrentProps {
    currentRouteName: string;
}

interface AreaOption {
    id: number;
    nombre: string;
}

// Shape real de las props que entrega EmployeeAbsenceController::index() — tipado explícito en
// vez de "usePage().props as any" para que un futuro cambio de nombre/forma de estas props
// (como ocurrió con la respuesta de dinamicDetails en Programaciones.tsx) lo detecte el
// compilador en vez de romperse en silencio en producción.
interface AusenciasPageProps {
    absences: AbsenceRow[];
    employees: EmployeeOption[];
    areas: AreaOption[] | null;
    selectedArea: number | null;
    auth?: {
        user?: {
            permissions?: string[];
            roles?: string[];
        } | null;
    };
}

const TYPE_LABELS: Record<AbsenceRow['type'], string> = {
    vacaciones: 'Vacaciones',
    incapacidad: 'Incapacidad',
};

// Mismo criterio de formateo (es-CO, día/mes corto) que usa el resto de pantallas de
// programación, sin acoplarse a programaciones.helpers.ts (pensado para otro dominio).
// Laravel serializa start_date/end_date (cast 'date') como datetime ISO completo
// ("2026-09-08T00:00:00.000000Z"), no como solo "YYYY-MM-DD" — se toma únicamente la
// parte de fecha (primeros 10 caracteres) para evitar corrimientos de zona horaria.
const formatIsoDate = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

const formatMonth = (yyyyMm: string) =>
    new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

const Ausencias = ({ currentRouteName }: CurrentProps) => {
    const { absences, areas, employees, auth, selectedArea } = usePage().props as unknown as AusenciasPageProps;
    const canManage = auth?.user?.permissions?.includes('ausencias.crear') ?? false;
    const isAdmin = auth?.user?.roles?.includes('admin') ?? false;
    // aux_admin_th y aux_th no tienen área propia: el backend solo devuelve datos de la área
    // elegida en "?area=" (nunca todas mezcladas), así que el selector es obligatorio para
    // ellos y cambiar de área navega (recarga con el query param), a diferencia de admin que
    // sí puede ver todas las áreas de una.
    const isMultiAreaReadOnly = !isAdmin && !!areas;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [absentEmployee, setAbsentEmployee] = useState<EmployeeOption | null>(null);
    const [replacementEmployee, setReplacementEmployee] = useState<EmployeeOption | null>(null);
    // El plan de vacaciones se gestiona aparte, en PlanVacaciones.tsx (con su propio saldo de
    // días, tandas y temporada alta) — desde este formulario solo se registran incapacidades.
    const type: AbsenceRow['type'] = 'incapacidad';
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [cancelTarget, setCancelTarget] = useState<AbsenceRow | null>(null);

    // Filtro de rango de fechas sobre la lista (en cliente: la lista completa ya llega por
    // props, sin paginación). Se queda una ausencia si su rango [start_date, end_date] se
    // cruza con [filterFrom, filterTo] — mismo criterio que un solapamiento de fechas normal.
    // Una reserva de mes sin fechas exactas (planned_month) se filtra por si ese mes completo
    // cae dentro del rango elegido.
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');

    const filteredAbsences = useMemo(() => {
        if (!filterFrom && !filterTo) return absences as AbsenceRow[];

        return (absences as AbsenceRow[]).filter((a) => {
            if (a.start_date && a.end_date) {
                if (filterFrom && a.end_date.slice(0, 10) < filterFrom) return false;
                if (filterTo && a.start_date.slice(0, 10) > filterTo) return false;
                return true;
            }
            if (a.planned_month) {
                const monthStart = `${a.planned_month}-01`;
                const monthEnd = `${a.planned_month}-31`;
                if (filterFrom && monthEnd < filterFrom) return false;
                if (filterTo && monthStart > filterTo) return false;
                return true;
            }
            return true;
        });
    }, [absences, filterFrom, filterTo]);

    // Rangos de fechas que el empleado ausente elegido tiene programados actualmente — para
    // mostrar de un vistazo qué días sí tiene cobertura y avisar (sin bloquear) si la fecha
    // "Desde" elegida cae fuera de todos ellos.
    const [absentSchedule, setAbsentSchedule] = useState<ScheduleRange[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);

    useEffect(() => {
        if (!absentEmployee) {
            setAbsentSchedule([]);
            return;
        }

        let cancelled = false;
        setLoadingSchedule(true);

        axios
            .get(route('ausencias.schedule'), { params: { employee_uid: absentEmployee.uid } })
            .then(({ data }) => {
                if (!cancelled) setAbsentSchedule(data.ranges ?? []);
            })
            .catch(() => {
                if (!cancelled) setAbsentSchedule([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingSchedule(false);
            });

        return () => {
            cancelled = true;
        };
    }, [absentEmployee]);

    // true si la fecha "Desde" elegida cae dentro de AL MENOS uno de los rangos programados
    // del ausente — si no, no bloquea el envío, solo avisa (puede ser intencional: una
    // ausencia que arranca antes de que el turno haya sido programado, por ejemplo). Solo
    // aplica a incapacidad: ahí interesa saber si hay un turno que el reemplazo puede heredar.
    // Vacaciones no depende de tener programación previa — solo bloquea disponibilidad futura,
    // así que este aviso no tiene sentido para ese tipo.
    const startDateOutsideSchedule = useMemo(() => {
        if (type !== 'incapacidad' || !startDate || absentSchedule.length === 0) return false;
        return !absentSchedule.some((r) => startDate >= r.start_date && startDate <= r.end_date);
    }, [type, startDate, absentSchedule]);

    // Solo incapacidad exige reemplazo (cubrir el puesto suele ser crítico) — vacaciones
    // solo bloquea la disponibilidad del empleado, sin necesidad de que nadie más lo cubra.
    const requiresReplacement = type === 'incapacidad';

    // El reemplazo solo puede salir de la MISMA área que el ausente elegido — y solo se
    // habilita una vez elegido el ausente, para no dejar mezclar áreas por accidente.
    const replacementCandidates = useMemo(() => {
        if (!absentEmployee) return [] as EmployeeOption[];
        return (employees as EmployeeOption[]).filter((e) => e.area_id === absentEmployee.area_id && e.uid !== absentEmployee.uid);
    }, [employees, absentEmployee]);

    const resetForm = () => {
        setAbsentEmployee(null);
        setReplacementEmployee(null);
        setStartDate('');
        setEndDate('');
        setNotes('');
        setFormError(null);
    };

    const closeCreateModal = () => {
        setIsCreateOpen(false);
        resetForm();
    };

    const submitCreate = () => {
        if (!absentEmployee || !startDate || !endDate) {
            setFormError('Completa empleado ausente y el rango de fechas.');
            return;
        }
        if (requiresReplacement && !replacementEmployee) {
            setFormError('Una incapacidad necesita un empleado que la reemplace.');
            return;
        }

        setSubmitting(true);
        setFormError(null);

        router.post(
            route('ausencias.store'),
            {
                employee_uid: absentEmployee.uid,
                type,
                start_date: startDate,
                end_date: endDate,
                replacement_employee_uid: replacementEmployee?.uid ?? null,
                notes: notes || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    closeCreateModal();
                },
                onError: (errors) => {
                    setSubmitting(false);
                    setFormError(Object.values(errors as Record<string, string>)[0] ?? 'No se pudo registrar la ausencia.');
                },
            },
        );
    };

    const confirmCancel = () => {
        if (!cancelTarget) return;
        router.delete(route('ausencias.destroy', cancelTarget.id), {
            preserveScroll: true,
            onFinish: () => setCancelTarget(null),
        });
    };

    return (
        <div>
            <div className="container mx-auto mt-10 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Ausencias</h1>
                {canManage && (!isMultiAreaReadOnly || selectedArea) && (
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2 rounded-lg border border-[#95c020] px-4 py-2 font-bold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <Plus size={18} /> Nueva ausencia
                    </button>
                )}
            </div>

            {isMultiAreaReadOnly && (
                <div className="container mx-auto mt-6">
                    <label className="block text-xs font-semibold text-gray-500">
                        Área
                        <select
                            value={selectedArea ?? ''}
                            onChange={(e) => router.get(route('ausencias'), e.target.value ? { area: e.target.value } : {})}
                            className="mt-1 block w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                        >
                            <option value="">Selecciona un área</option>
                            {areas.map((a: { id: number; nombre: string }) => (
                                <option key={a.id} value={a.id}>
                                    {a.nombre}
                                </option>
                            ))}
                        </select>
                    </label>
                    {!selectedArea && <p className="mt-2 text-xs text-gray-400">Elige un área para consultar sus ausencias.</p>}
                </div>
            )}

            <div className="container mx-auto mt-6 flex flex-wrap items-end gap-3">
                <label className="block text-xs font-semibold text-gray-500">
                    Desde
                    <input
                        type="date"
                        value={filterFrom}
                        max={filterTo || undefined}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                    />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                    Hasta
                    <input
                        type="date"
                        value={filterTo}
                        min={filterFrom || undefined}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                    />
                </label>
                {(filterFrom || filterTo) && (
                    <button
                        onClick={() => {
                            setFilterFrom('');
                            setFilterTo('');
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                        Limpiar filtro
                    </button>
                )}
            </div>

            <div className="container mx-auto mt-6 mb-10">
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full min-w-[900px] border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-left text-[11px] font-bold text-gray-500 uppercase">
                                <th className="px-4 py-3">Empleado ausente</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Rango</th>
                                <th className="px-4 py-3">Reemplazo</th>
                                {isAdmin && <th className="px-4 py-3">Área</th>}
                                <th className="px-4 py-3">Estado</th>
                                {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAbsences.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-gray-400">
                                        <CalendarOff className="mx-auto mb-2" size={28} />
                                        {absences.length === 0 ? 'No hay ausencias registradas.' : 'Ninguna ausencia cae en el rango elegido.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredAbsences.map((a) => (
                                    <tr key={a.id} className="border-t border-gray-100">
                                        <td className="px-4 py-3 font-medium text-gray-900">{a.employee?.name ?? '—'}</td>
                                        <td className="px-4 py-3 text-gray-700">{TYPE_LABELS[a.type]}</td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {a.start_date && a.end_date ? (
                                                <>
                                                    {formatIsoDate(a.start_date)} – {formatIsoDate(a.end_date)}
                                                </>
                                            ) : a.planned_month ? (
                                                <span className="text-gray-400">{formatMonth(a.planned_month)} (sin fechas)</span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{a.replacement_employee?.name ?? '—'}</td>
                                        {isAdmin && <td className="px-4 py-3 text-gray-700">{a.area?.nombre ?? '—'}</td>}
                                        <td className="px-4 py-3">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    a.status === 'Activa' ? 'bg-[#eaf3d3] text-[#5e7a15]' : 'bg-gray-100 text-gray-500'
                                                }`}
                                            >
                                                {a.status}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                {a.status === 'Activa' && (
                                                    <button
                                                        onClick={() => setCancelTarget(a)}
                                                        className="rounded-md border border-[#a81c24] px-3 py-1.5 text-xs font-bold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <h2 className="text-base font-semibold text-gray-900">Nueva ausencia</h2>
                            <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            {formError && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-500">Empleado ausente</label>
                                <Autocomplete<EmployeeOption>
                                    items={employees}
                                    getLabel={(e) => e.name}
                                    value={absentEmployee}
                                    placeholder="Buscar empleado..."
                                    onSelect={(e) => {
                                        setAbsentEmployee(e);
                                        // Si el reemplazo elegido ya no calza con la nueva área, se limpia.
                                        if (replacementEmployee && replacementEmployee.area_id !== e.area_id) {
                                            setReplacementEmployee(null);
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-500">Tipo</label>
                                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                                    Incapacidad
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-500">Desde</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                    {startDateOutsideSchedule && (
                                        <p className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                                            <AlertTriangle size={13} className="mt-0.5 flex-none" />
                                            El empleado no tiene turno programado esa fecha.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-500">Hasta</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        min={startDate || undefined}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-500">
                                    Reemplazo{!requiresReplacement && ' (opcional)'}
                                </label>
                                <Autocomplete<EmployeeOption>
                                    items={replacementCandidates}
                                    getLabel={(e) => e.name}
                                    value={replacementEmployee}
                                    placeholder={absentEmployee ? 'Buscar empleado...' : 'Elige primero al ausente'}
                                    onSelect={(e) => setReplacementEmployee(e)}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-500">Notas (opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-[#a81c24] focus:ring-2 focus:ring-[#a81c24]/30 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                            <button
                                type="button"
                                onClick={closeCreateModal}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={submitCreate}
                                className="rounded-md bg-[#a81c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#c9252d] disabled:opacity-60"
                            >
                                {submitting ? 'Guardando...' : 'Registrar ausencia'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                show={cancelTarget !== null}
                variant="danger"
                title="Cancelar ausencia"
                message={
                    cancelTarget
                        ? cancelTarget.replacement_employee
                            ? `Se revertirán los turnos que ${cancelTarget.replacement_employee.name} heredó de ${cancelTarget.employee?.name ?? 'el empleado'}.`
                            : `${cancelTarget.employee?.name ?? 'El empleado'} quedará disponible de nuevo en ese rango de fechas.`
                        : undefined
                }
                confirmLabel="Cancelar ausencia"
                cancelLabel="Volver"
                onConfirm={confirmCancel}
                onClose={() => setCancelTarget(null)}
            />
        </div>
    );
};

Ausencias.layout = (page: any) => <MainLayout RouteNavbar={page.props.currentRouteName}>{page}</MainLayout>;

export default Ausencias;
