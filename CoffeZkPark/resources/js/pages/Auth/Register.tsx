import { Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { useState } from 'react';

interface Employee {
    uid: string;
    name: string;
    area_id: number | null;
}

interface AreaOption {
    id: number;
    nombre: string;
}

interface CoordinatorRow {
    id: number;
    email: string;
    name: string;
    areas: AreaOption[];
}

export default function Register() {
    const { employees = [], roles = [], areas = [], coordinators = [] } = usePage().props as unknown as {
        employees: Employee[];
        roles: string[];
        areas: AreaOption[];
        coordinators: CoordinatorRow[];
    };

    const { data, setData, post, processing, errors } = useForm<{
        email: string;
        password: string;
        password_confirmation: string;
        employee_uid: string;
        role: string;
        area_ids: number[];
    }>({
        email: '',
        password: '',
        password_confirmation: '',
        employee_uid: '',
        role: roles.length === 1 ? roles[0] : '',
        area_ids: [],
    });

    const [search, setSearch] = useState('');
    const [showList, setShowList] = useState(false);
    const [areaSearch, setAreaSearch] = useState('');
    const [showAreaList, setShowAreaList] = useState(false);

    const filteredEmployees = employees.filter((emp) => {
        if (!emp.name.toLowerCase().includes(search.toLowerCase())) return false;
        // Si es coordinador y ya hay áreas elegidas, solo muestra empleados de esas áreas
        if (data.role === 'coordinator' && data.area_ids.length > 0) {
            return emp.area_id !== null && data.area_ids.includes(emp.area_id);
        }
        return true;
    });

    const filteredAreas = areas.filter(
        (a) => a.nombre.toLowerCase().includes(areaSearch.toLowerCase()) && !data.area_ids.includes(a.id),
    );

    const addArea = (area: AreaOption) => {
        setData('area_ids', [...data.area_ids, area.id]);
        setAreaSearch('');
        setShowAreaList(false);
    };

    const removeArea = (id: number) => {
        const newIds = data.area_ids.filter((a) => a !== id);
        // Si el empleado ya seleccionado no pertenece a ninguna área restante, lo limpia
        const emp = employees.find((e) => e.uid === data.employee_uid);
        if (emp && emp.area_id !== null && !newIds.includes(emp.area_id)) {
            setData({ ...data, area_ids: newIds, employee_uid: '' });
            setSearch('');
        } else {
            setData('area_ids', newIds);
        }
    };

    const selectedAreas = areas.filter((a) => data.area_ids.includes(a.id));

    // Editor de áreas de coordinador existente
    const [editingCoordinator, setEditingCoordinator] = useState<CoordinatorRow | null>(null);
    const [editAreaIds, setEditAreaIds] = useState<number[]>([]);
    const [editAreaSearch, setEditAreaSearch] = useState('');
    const [showEditAreaList, setShowEditAreaList] = useState(false);
    const [editSaving, setEditSaving] = useState(false);

    const openEditCoordinator = (c: CoordinatorRow) => {
        setEditingCoordinator(c);
        setEditAreaIds(c.areas.map((a) => a.id));
        setEditAreaSearch('');
    };

    const addEditArea = (area: AreaOption) => {
        setEditAreaIds((prev) => [...prev, area.id]);
        setEditAreaSearch('');
        setShowEditAreaList(false);
    };

    const removeEditArea = (id: number) => setEditAreaIds((prev) => prev.filter((a) => a !== id));

    const saveEditCoordinator = () => {
        if (!editingCoordinator) return;
        setEditSaving(true);
        router.put(
            route('users.updateCoordinatorAreas', editingCoordinator.id),
            { area_ids: editAreaIds },
            {
                preserveScroll: true,
                onSuccess: () => { setEditingCoordinator(null); setEditSaving(false); },
                onError: () => setEditSaving(false),
            },
        );
    };

    const roleLabels: Record<string, string> = {
        admin: 'Administrador',
        coordinator: 'Coordinador',
        aux_admin_th: 'Aux. TH',
        admin_nomina: 'Adm. Nómina',
        aux_th: 'Aux. TH',
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(roles.length === 1 ? '/register' : '/users');
    };

    return (
        <>
            <div className="relative flex min-h-screen items-center justify-center bg-gray-100 p-4">
                {roles.length > 1 && (
                    <div className="absolute top-4 left-4 md:top-8 md:left-8">
                        <Link
                            href={route('servicios')}
                            className="flex w-fit items-center gap-2 rounded-lg border border-[#a81c24] px-4 py-2 font-bold text-[#a81c24] transition hover:bg-[#a81c24] hover:text-white"
                        >
                            <ArrowLeft size={18} />
                            Volver a Servicios
                        </Link>
                    </div>
                )}
                <form onSubmit={submit} className="w-full max-w-md rounded bg-white p-6 shadow">
                    <h1 className="mb-4 text-center text-xl font-bold">Registro de Usuario</h1>

                    {/* EMAIL */}
                    <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="mb-2 w-full rounded border p-2"
                    />

                    {/* PASSWORD */}
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="mb-2 w-full rounded border p-2"
                    />

                    {/* CONFIRM PASSWORD */}
                    <input
                        type="password"
                        placeholder="Confirmar contraseña"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        className="mb-3 w-full rounded border p-2"
                    />

                    {/* EMPLOYEE SEARCH SELECT */}
                    <div className="relative mb-3">
                        <input
                            type="text"
                            placeholder="Buscar empleado..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setShowList(true);
                            }}
                            onFocus={() => setShowList(true)}
                            className="w-full rounded border p-2"
                        />
                        {showList && filteredEmployees.length > 0 && (
                            <ul className="absolute z-20 max-h-60 w-full overflow-y-auto rounded border bg-white shadow">
                                {filteredEmployees.slice(0, 50).map((emp) => (
                                    <li
                                        key={emp.uid}
                                        className="cursor-pointer px-3 py-2 hover:bg-[#95c020] hover:text-white"
                                        onClick={() => {
                                            setData('employee_uid', emp.uid);
                                            setSearch(emp.name);
                                            setShowList(false);
                                        }}
                                    >
                                        {emp.name}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {data.employee_uid && <p className="mt-1 text-xs text-green-700">Empleado seleccionado ✔</p>}
                    </div>

                    {/* ROLE SELECT */}
                    {roles.length > 1 && (
                        <select
                            value={data.role}
                            onChange={(e) => {
                                setData('role', e.target.value);
                                if (e.target.value !== 'coordinator') setData('area_ids', []);
                            }}
                            className="mb-3 w-full rounded border p-2"
                        >
                            <option value="">Seleccione rol</option>
                            {roles.map((role) => (
                                <option key={role} value={role}>
                                    {roleLabels[role] ?? role}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* ÁREAS — solo para coordinador */}
                    {data.role === 'coordinator' && areas.length > 0 && (
                        <div className="mb-3">
                            <label className="mb-1 block text-xs font-semibold text-gray-600">
                                Áreas asignadas <span className="font-normal text-gray-400">(puede elegir varias)</span>
                            </label>

                            {/* Chips de áreas seleccionadas */}
                            {selectedAreas.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {selectedAreas.map((a) => (
                                        <span
                                            key={a.id}
                                            className="flex items-center gap-1 rounded-full bg-[#a81c24]/10 px-2.5 py-1 text-xs font-semibold text-[#a81c24]"
                                        >
                                            {a.nombre}
                                            <button type="button" onClick={() => removeArea(a.id)} className="hover:text-[#c9252d]">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Buscador de áreas */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar área..."
                                    value={areaSearch}
                                    onChange={(e) => {
                                        setAreaSearch(e.target.value);
                                        setShowAreaList(true);
                                    }}
                                    onFocus={() => setShowAreaList(true)}
                                    className="w-full rounded border p-2 text-sm"
                                />
                                {showAreaList && filteredAreas.length > 0 && (
                                    <ul className="absolute z-20 max-h-48 w-full overflow-y-auto rounded border bg-white shadow">
                                        {filteredAreas.map((a) => (
                                            <li
                                                key={a.id}
                                                className="cursor-pointer px-3 py-2 text-sm hover:bg-[#95c020] hover:text-white"
                                                onClick={() => addArea(a)}
                                            >
                                                {a.nombre}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SUBMIT */}
                    <button disabled={processing} className="w-full rounded bg-[#95c020] py-2 font-bold text-white hover:bg-[#7da81a]">
                        {processing ? 'Creando...' : 'Crear Usuario'}
                    </button>

                    {/* ERRORS */}
                    {Object.values(errors).map((err, i) => (
                        <p key={i} className="mt-1 text-sm text-red-600">
                            {err}
                        </p>
                    ))}
                </form>

                {/* LISTA DE COORDINADORES */}
                {coordinators.length > 0 && (
                    <div className="mt-8 w-full max-w-md rounded bg-white p-6 shadow">
                        <h2 className="mb-4 text-base font-bold text-gray-800">Coordinadores registrados</h2>
                        <ul className="space-y-3">
                            {coordinators.map((c) => (
                                <li key={c.id} className="rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                                            <p className="text-xs text-gray-400">{c.email}</p>
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {c.areas.length === 0 ? (
                                                    <span className="text-xs text-gray-400">Sin áreas asignadas</span>
                                                ) : (
                                                    c.areas.map((a) => (
                                                        <span key={a.id} className="rounded-full bg-[#a81c24]/10 px-2 py-0.5 text-xs font-semibold text-[#a81c24]">
                                                            {a.nombre}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openEditCoordinator(c)}
                                            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                        >
                                            <Pencil size={12} /> Editar áreas
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* MODAL EDITAR ÁREAS */}
            {editingCoordinator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-base font-bold text-gray-900">
                                Áreas de {editingCoordinator.name}
                            </h2>
                            <button onClick={() => setEditingCoordinator(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Chips seleccionados */}
                        <div className="mb-3 flex flex-wrap gap-1.5 min-h-[28px]">
                            {editAreaIds.length === 0 ? (
                                <span className="text-xs text-gray-400">Sin áreas asignadas</span>
                            ) : (
                                areas.filter((a) => editAreaIds.includes(a.id)).map((a) => (
                                    <span key={a.id} className="flex items-center gap-1 rounded-full bg-[#a81c24]/10 px-2.5 py-1 text-xs font-semibold text-[#a81c24]">
                                        {a.nombre}
                                        <button type="button" onClick={() => removeEditArea(a.id)} className="hover:text-[#c9252d]">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))
                            )}
                        </div>

                        {/* Buscador */}
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Buscar área para agregar..."
                                value={editAreaSearch}
                                onChange={(e) => { setEditAreaSearch(e.target.value); setShowEditAreaList(true); }}
                                onFocus={() => setShowEditAreaList(true)}
                                className="w-full rounded border p-2 text-sm"
                            />
                            {showEditAreaList && (
                                <ul className="absolute z-20 max-h-48 w-full overflow-y-auto rounded border bg-white shadow">
                                    {areas
                                        .filter((a) => !editAreaIds.includes(a.id) && a.nombre.toLowerCase().includes(editAreaSearch.toLowerCase()))
                                        .map((a) => (
                                            <li
                                                key={a.id}
                                                className="cursor-pointer px-3 py-2 text-sm hover:bg-[#95c020] hover:text-white"
                                                onClick={() => addEditArea(a)}
                                            >
                                                {a.nombre}
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditingCoordinator(null)}
                                className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={editSaving}
                                onClick={saveEditCoordinator}
                                className="rounded bg-[#a81c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#c9252d] disabled:opacity-60"
                            >
                                {editSaving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
