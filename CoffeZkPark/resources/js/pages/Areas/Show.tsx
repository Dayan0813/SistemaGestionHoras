import EmployeeProfileModal from '@/Components/EmployeeProfileModal';
import MainLayout from '@/Layouts/MainLayout';
import { Link, usePage } from '@inertiajs/react';
import { CalendarDays, Pencil } from 'lucide-react';
import React, { useState } from 'react';
import EditAreaModal from './EditAreaModal';

/* =========================
   TIPOS LOCALES
========================= */

interface Area {
    id: number;
    nombre: string;
    descripcion: string | null;
    centro_costo: string;
    scheduling_mode: 'fijo' | 'variable';
}

interface Cargo {
    id: number;
    name: string;
}

interface Contrato {
    id: number;
    name: string;
}

interface TodayCalendar {
    label: string;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
}

interface Employee {
    id: number;
    uid: string;
    name: string;
    estado: 'Activo' | 'Inactivo';
    cargo?: Cargo | null;
    contrato?: Contrato | null;
    today_calendar?: TodayCalendar | null;
}

interface Stats {
    total: number;
    activos: number;
    inactivos: number;
}

interface Props {
    area: Area;
    coordinator_name: string | null;
    stats: Stats;
    activos: Employee[];
    inactivos: Employee[];
}

/* =========================
   EMPLOYEE CARD
========================= */

interface EmployeeCardProps {
    e: Employee;
    active: boolean;
    onOpenProfile: (uid: string) => void;
}

// Tarjeta compacta — el detalle completo (cédula, documento, empresa, dependencia, centro de
// costo) vive en EmployeeProfileModal, que se abre al hacer clic en el nombre.
function EmployeeCard({ e, active, onOpenProfile }: EmployeeCardProps) {
    const today = e.today_calendar;
    const todayColor = today?.shift_type === 'N' ? 'bg-slate-100 text-slate-700' : 'bg-[#eaf3d3] text-[#5e7a15]';

    return (
        <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => onOpenProfile(e.uid)}
                        className="truncate text-left font-semibold text-gray-900 hover:text-[#a81c24] hover:underline"
                    >
                        {e.name}
                    </button>

                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
                        {e.cargo?.name || 'Sin cargo'}
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                today ? todayColor : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            <CalendarDays size={11} />
                            {today
                                ? `${today.label}${today.hora_entrada && today.hora_salida ? ` · ${today.hora_entrada.slice(0, 5)}-${today.hora_salida.slice(0, 5)}` : ''}`
                                : 'Sin turno hoy'}
                        </span>
                    </p>

                    <p className="text-xs text-gray-400">{e.contrato?.name || '—'}</p>
                </div>

                <span className={`flex-none rounded-full px-2 py-1 text-xs ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {e.estado}
                </span>
            </div>
        </div>
    );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */

export default function Show({ area, coordinator_name, stats, activos, inactivos }: Props) {
    const [editing, setEditing] = useState(false);
    const [profileUid, setProfileUid] = useState<string | null>(null);
    const { auth } = usePage().props as unknown as { auth?: { user?: { permissions?: string[] } } };
    const canManageAreas = auth?.user?.permissions?.includes('areas.gestionar') ?? false;
    const canViewProgram = auth?.user?.permissions?.includes('programaciones.ver') ?? false;

    return (
        <div className="mx-auto max-w-7xl p-6">
            <div className="flex items-center justify-between">
                <Link
                    href={route('areas')}
                    className="flex w-fit items-center gap-2 rounded-lg border border-[#a81c24] px-4 py-2 font-bold text-[#a81c24] transition hover:bg-[#a81c24] hover:text-white"
                >
                    ← Volver
                </Link>

                <div className="flex items-center gap-3">
                    {canViewProgram && (
                        <Link
                            href={route('programations.details', area.id)}
                            className="flex items-center gap-2 rounded-lg border border-[#95c020] px-4 py-2 text-sm font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                        >
                            <CalendarDays size={16} /> Ver programación
                        </Link>
                    )}
                    {canManageAreas && (
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                            <Pencil size={16} /> Editar área
                        </button>
                    )}
                </div>
            </div>

            <h1 className="mt-4 text-2xl font-bold">{area.nombre}</h1>

            <p className="text-gray-500">{area.descripcion}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        area.scheduling_mode === 'variable' ? 'bg-blue-100 text-blue-700' : 'bg-[#eaf3d3] text-[#5e7a15]'
                    }`}
                >
                    {area.scheduling_mode === 'variable' ? 'Horario variable (según demanda)' : 'Horario fijo (Lunes a Viernes)'}
                </span>
                <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        coordinator_name ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                    }`}
                >
                    Coordinador: {coordinator_name ?? 'Sin asignar'}
                </span>
            </div>

            <EditAreaModal show={editing} area={area} onClose={() => setEditing(false)} />

            {/* =====================
               STATS
            ===================== */}
            <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded bg-white p-4 shadow">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                </div>

                <div className="rounded bg-white p-4 text-green-600 shadow">
                    <p className="text-sm">Activos</p>
                    <p className="text-xl font-bold">{stats.activos}</p>
                </div>

                <div className="rounded bg-white p-4 text-red-600 shadow">
                    <p className="text-sm">Inactivos</p>
                    <p className="text-xl font-bold">{stats.inactivos}</p>
                </div>
            </div>

            {/* =====================
               ACTIVOS
            ===================== */}
            <h2 className="mt-8 font-bold">Empleados Activos</h2>

            <div className="mt-2 grid gap-4 md:grid-cols-2">
                {activos.map((e) => (
                    <EmployeeCard key={e.id} e={e} active={true} onOpenProfile={setProfileUid} />
                ))}
            </div>

            {/* =====================
               INACTIVOS
            ===================== */}
            <h2 className="mt-8 font-bold">Empleados Inactivos</h2>

            <div className="mt-2 grid gap-4 md:grid-cols-2">
                {inactivos.map((e) => (
                    <EmployeeCard key={e.id} e={e} active={false} onOpenProfile={setProfileUid} />
                ))}
            </div>

            <EmployeeProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />
        </div>
    );
}

Show.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
