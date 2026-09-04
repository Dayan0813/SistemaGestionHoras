import ConfirmModal from '@/Components/confirmModal';
import CreateEmployeeModal from '@/Components/CreateEmployeeModal';
import EditEmployeeModal from '@/Components/EditarEmpleado';
import EmployeeHoursModal from '@/Components/EmployeeHoursModal';
import MainLayout from '@/Layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import { ChevronDown, Clock, Funnel, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import React, { useState } from 'react';

interface CurrentProps {
    currentRouteName: string;
}

const Empleados = ({ currentRouteName }: CurrentProps) => {
    // 🔧 LÓGICA: ahora cargos y contratos vienen desde BD
    const { employees, stats, filters, areas, contrato, cargo, auth } = usePage().props as any;
    const canCreate = auth?.user?.permissions?.includes('empleados.crear') ?? false;
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // =========================
    // MODAL CONFIRMAR DELETE
    // =========================
    const [showConfirm, setShowConfrim] = useState<boolean>(false);
    const [employeeDelete, setEmployeeDelete] = useState<number | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteClick = (id: number) => {
        setEmployeeDelete(id);
        setDeleteError(null);
        setShowConfrim(true);
    };

    const confirmDelete = React.useCallback(() => {
        if (employeeDelete !== null) {
            router.delete(route('empleados.destroy', employeeDelete), {
                preserveScroll: true,
                onSuccess: () => {
                    setShowConfrim(false);
                    setEmployeeDelete(null);
                },
                onError: (errors) => {
                    setShowConfrim(false);
                    setDeleteError((errors as Record<string, string>).delete ?? 'No se pudo eliminar el empleado.');
                },
            });
        }
    }, [employeeDelete]);

    // =========================
    // MODAL EDIT
    // =========================
    const [isOpenModal, setIsOpenModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [hoursEmployee, setHoursEmployee] = useState<{ uid: string; name: string } | null>(null);

    const OpenEditModal = (emp: any) => {
        setSelectedEmployee(emp);
        setIsOpenModal(true);
    };

    const CloseEditModal = () => {
        setIsOpenModal(false);
        setSelectedEmployee(null);
    };

    // =========================
    // FILTROS (IDs, no texto)
    // =========================
    const [searchText, setSearchText] = useState(filters.search || '');
    const [filterArea, setFilterArea] = useState(filters.area || '');
    const [filterContrato, setFilterContrato] = useState(filters.contrato_id || '');
    const [filterEstado, setFilterEstado] = useState(filters.estado || '');

    const handleFilterChange = (newFilters: any) => {
        router.get('/empleados', newFilters, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // =========================
    // STATS (sin tocar estilos)
    // =========================
    const allStats = [
        { label: 'Total', value: stats.total },
        { label: 'Activos', value: stats.Activos },
        { label: 'Inactivos', value: stats.Inactivos },
    ];

    return (
        <div>
            {deleteError && (
                <div className="container mx-auto mt-10">
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                        <span>{deleteError}</span>
                        <button onClick={() => setDeleteError(null)} className="font-bold text-red-700 hover:text-red-900">
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className={`container mx-auto flex items-center justify-between ${deleteError ? 'mt-4' : 'mt-10'}`}>
                <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
                {canCreate && (
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2 rounded-lg border border-[#95c020] px-4 py-2 font-bold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        <Plus size={18} /> Nuevo empleado
                    </button>
                )}
            </div>

            {/* =========================
                ESTADÍSTICAS
            ========================= */}
            <div className="container mx-auto mt-4 mb-8">
                <div className="rounded-xl border border-[#95c020] bg-white p-6 shadow-sm">
                    {/* KPIs */}
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* TOTAL */}
                        <div className="rounded-lg border border-gray-200 p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase">Total</p>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-gray-900">{stats.total}</span>
                                <span className="rounded-full bg-[#a81c24]/10 px-3 py-1 text-xs font-semibold text-[#a81c24]">Global</span>
                            </div>
                        </div>

                        {/* ACTIVOS */}
                        <div className="rounded-lg border border-gray-200 p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase">Activos</p>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-green-700">{stats.Activos}</span>
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Activos</span>
                            </div>
                        </div>

                        {/* INACTIVOS */}
                        <div className="rounded-lg border border-gray-200 p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase">Inactivos</p>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-red-700">{stats.Inactivos}</span>
                                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Inactivos</span>
                            </div>
                        </div>
                    </div>

                    {/* CONTRATOS */}
                    <div>
                        <h4 className="mb-3 text-sm font-semibold text-gray-700">Distribución por tipo de contrato</h4>

                        <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.Contratos).map(([nombre, cantidad]) => (
                                <div
                                    key={nombre}
                                    className="flex items-center gap-2 rounded-md border border-[#a81c24] bg-[#a81c24] px-3 py-1.5 text-xs font-medium text-white"
                                    title={String(nombre)}
                                >
                                    <span className="max-w-[200px] truncate">{String(nombre)}</span>
                                    <span className="rounded-full bg-[#95c020] px-2 py-0.5 text-[13px] font-extrabold text-white">
                                        {String(cantidad)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================
                FILTROS
            ========================= */}
            <div className="mx-auto mt-5 w-[95%] rounded-xl border border-[#a81c24] p-6 shadow-lg">
                <div className="mb-6 flex items-center">
                    <Funnel className="mr-2 h-6 w-6 text-[#a81c24]" />
                    <h2 className="text-xl font-bold text-[#a81c24]">Filtros de Búsqueda</h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Área */}
                    <div className="relative min-w-[200px] flex-grow">
                        <select
                            value={filterArea}
                            onChange={(e) => {
                                setFilterArea(e.target.value);
                                handleFilterChange({
                                    search: searchText,
                                    area: e.target.value,
                                    contrato_id: filterContrato,
                                    estado: filterEstado,
                                });
                            }}
                            className="w-full cursor-pointer appearance-none rounded-md border border-[#a81c24] bg-white px-4 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        >
                            <option value="">Selecciona un área</option>
                            {areas.map((area: any) => (
                                <option key={area.id} value={area.id}>
                                    {area.nombre}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown className="h-4 w-4 text-[#a81c24]" />
                        </div>
                    </div>

                    {/* Contrato */}
                    <div className="relative min-w-[200px] flex-grow">
                        <select
                            value={filterContrato}
                            onChange={(e) => {
                                setFilterContrato(e.target.value);
                                handleFilterChange({
                                    search: searchText,
                                    area: filterArea,
                                    contrato_id: e.target.value,
                                    estado: filterEstado,
                                });
                            }}
                            className="w-full cursor-pointer appearance-none rounded-md border border-[#a81c24] bg-white px-4 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        >
                            <option value="">Todos los Contratos</option>
                            {Object.entries(contrato).map(([id, name]) => (
                                <option key={id} value={id}>
                                    {String(name)}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown className="h-4 w-4 text-[#a81c24]" />
                        </div>
                    </div>

                    {/* Estado */}
                    <div className="relative min-w-[200px] flex-grow">
                        <select
                            value={filterEstado}
                            onChange={(e) => {
                                setFilterEstado(e.target.value);
                                handleFilterChange({
                                    search: searchText,
                                    area: filterArea,
                                    contrato_id: filterContrato,
                                    estado: e.target.value,
                                });
                            }}
                            className="w-full cursor-pointer appearance-none rounded-md border border-[#a81c24] bg-white px-4 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                        >
                            <option value="">Todos los Estados</option>
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown className="h-4 w-4 text-[#a81c24]" />
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="min-w-[200px] flex-grow">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => {
                                setSearchText(e.target.value);
                                handleFilterChange({
                                    search: e.target.value,
                                    area: filterArea,
                                    contrato_id: filterContrato,
                                    estado: filterEstado,
                                });
                            }}
                            className="w-full rounded-md border border-[#a81c24] px-4 py-2 focus:ring-2 focus:ring-[#a81c24] focus:outline-none"
                            placeholder="Buscar por nombre o UID..."
                        />
                    </div>
                </div>
            </div>

            {/* =========================
                LISTA
            ========================= */}
            <div className="container mx-auto mt-8 mb-10 max-h-96 overflow-y-auto rounded-xl border border-[#95c020]">
                <div className="grid gap-4">
                    {employees.data.length > 0 ? (
                        employees.data.map((emp: any) => (
                            <div key={emp.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 shadow-sm">
                                {/* Avatar + Info */}
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                        <UserRound />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-800">{emp.name}</h2>
                                        <p className="text-sm text-gray-600">
                                            {emp.uid} | {emp.area?.nombre} | {emp.empresa}
                                        </p>
                                        <p className="text-xs text-gray-500">Cargo: {emp.cargo?.name ?? 'Sin cargo'}</p>
                                    </div>
                                </div>

                                {/* Badges + Acciones */}
                                <div className="flex items-center gap-2">
                                    <span className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-white">
                                        {emp.contrato?.name ?? 'Sin Contrato'}
                                    </span>

                                    <span
                                        className={`rounded px-2 py-1 text-xs font-semibold ${
                                            emp.estado === 'Activo' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'
                                        }`}
                                    >
                                        {emp.estado}
                                    </span>

                                    <button
                                        onClick={() => setHoursEmployee({ uid: emp.uid, name: emp.name })}
                                        className="flex items-center rounded border border-blue-600 px-3 py-1 text-sm font-semibold text-blue-600 hover:bg-blue-600 hover:text-white"
                                    >
                                        <Clock size={20} className="mr-1" /> Horas
                                    </button>

                                    <button
                                        onClick={() => OpenEditModal(emp)}
                                        className="-py-1 flex items-center rounded border border-yellow-500 p-1 px-3 text-yellow-500 hover:bg-yellow-500 hover:text-white"
                                    >
                                        <Pencil size={20} />
                                    </button>

                                    <button
                                        onClick={() => handleDeleteClick(emp.id)}
                                        className="flex items-center rounded border border-red-600 p-1 text-red-600 hover:bg-red-600 hover:text-white"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="p-4 text-center text-gray-500">No se encontraron empleados</p>
                    )}
                </div>
            </div>

            {/* =========================
                PAGINACIÓN
            ========================= */}
            {employees.last_page > 1 && (
                <div className="container mx-auto mb-10 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Mostrando {employees.from}–{employees.to} de {employees.total}
                    </span>
                    <div className="flex gap-2">
                        {employees.links
                            .filter((link: any) => !isNaN(Number(link.label)))
                            .map((link: any, index: number) => (
                                <button
                                    key={index}
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                                        link.active ? 'border-[#a81c24] bg-[#a81c24] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                                    } ${!link.url && 'cursor-not-allowed opacity-40'}`}
                                >
                                    {link.label}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            <EmployeeHoursModal employee={hoursEmployee} onClose={() => setHoursEmployee(null)} />

            <CreateEmployeeModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} areas={areas} contrato={contrato} cargo={cargo} />

            {/* MODALES */}
            <EditEmployeeModal
                isOpen={isOpenModal}
                onClose={CloseEditModal}
                employee={selectedEmployee}
                areas={areas}
                contrato={contrato}
                cargo={cargo}
            />

            <ConfirmModal
                show={showConfirm}
                title="Eliminar empleado"
                message="¿Estás seguro de que deseas eliminar este empleado?"
                onConfirm={confirmDelete}
                onClose={() => {
                    setEmployeeDelete(null);
                    setShowConfrim(false);
                }}
            />
        </div>
    );
};

// Layout
Empleados.layout = (page: any) => <MainLayout RouteNavbar={page.props.currentRouteName}>{page}</MainLayout>;

export default Empleados;
