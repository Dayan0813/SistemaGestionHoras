import { Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface Employee {
    uid: string;
    name: string;
}

export default function Register() {
    const { employees = [], roles = [] } = usePage().props as unknown as {
        employees: Employee[];
        roles: string[];
    };

    /* =========================
       FORM
    ========================= */

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        password_confirmation: '',
        employee_uid: '',
        role: roles.length === 1 ? roles[0] : '',
    });

    /* =========================
       EMPLOYEE SEARCH
    ========================= */

    const [search, setSearch] = useState('');
    const [showList, setShowList] = useState(false);

    const filteredEmployees = employees.filter((emp) => emp.name.toLowerCase().includes(search.toLowerCase()));

    const roleLabels: Record<string, string> = {
        admin: 'Administrador',
        coordinator: 'Coordinador',
        aux_admin_th: 'Aux. TH',
        admin_nomina: 'Adm. Nómina',
        aux_th: 'Aux. TH',
    };

    /* =========================
       SUBMIT
    ========================= */

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        // Primer usuario → /register
        // Usuarios siguientes → /users
        post(roles.length === 1 ? '/register' : '/users');
    };

    /* =========================
       RENDER
    ========================= */

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

                    {/* ROLE SELECT (SOLO ADMIN CREANDO USUARIOS) */}
                    {roles.length > 1 && (
                        <select value={data.role} onChange={(e) => setData('role', e.target.value)} className="mb-3 w-full rounded border p-2">
                            <option value="">Seleccione rol</option>
                            {roles.map((role) => (
                                <option key={role} value={role}>
                                    {roleLabels[role] ?? role}
                                </option>
                            ))}
                        </select>
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
            </div>
        </>
    );
}
