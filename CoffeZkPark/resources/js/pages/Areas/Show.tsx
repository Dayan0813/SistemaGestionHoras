import { Link } from '@inertiajs/react';

/* =========================
   TIPOS LOCALES
========================= */

interface Area {
    id: number;
    nombre: string;
    descripcion: string | null;
    centro_costo: string;
}

interface Cargo {
    id: number;
    name: string;
}

interface Employee {
    id: number;
    uid: string;
    name: string;
    estado: 'Activo' | 'Inactivo';
    empresa?: string;
    cargo?: Cargo | null;
}

interface Stats {
    total: number;
    activos: number;
    inactivos: number;
}

interface Props {
    area: Area;
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
}

function EmployeeCard({ e, active }: EmployeeCardProps) {
    return (
        <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="font-semibold">{e.name}</p>

                    <p className="text-sm text-gray-500">{e.cargo?.name || 'Sin cargo'}</p>

                    <p className="text-xs text-gray-400">{e.empresa || '—'}</p>
                </div>

                <span className={`rounded-full px-2 py-1 text-xs ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {e.estado}
                </span>
            </div>
        </div>
    );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */

export default function Show({ area, stats, activos, inactivos }: Props) {
    return (
        <div className="mx-auto max-w-7xl p-6">
            <Link href={route('areas')} className="flex w-fit items-center gap-2 rounded-lg border border-[#a81c24] px-4 py-2 font-bold text-[#a81c24] transition hover:bg-[#a81c24] hover:text-white">
                ← Volver
            </Link>

            <h1 className="mt-4 text-2xl font-bold">{area.nombre}</h1>

            <p className="text-gray-500">{area.descripcion}</p>

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
                    <EmployeeCard key={e.id} e={e} active={true} />
                ))}
            </div>

            {/* =====================
               INACTIVOS
            ===================== */}
            <h2 className="mt-8 font-bold">Empleados Inactivos</h2>

            <div className="mt-2 grid gap-4 md:grid-cols-2">
                {inactivos.map((e) => (
                    <EmployeeCard key={e.id} e={e} active={false} />
                ))}
            </div>
        </div>
    );
}
