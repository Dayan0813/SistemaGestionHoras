import logoWhite from '@/Assets/LogoWhite.png';
import { Link, usePage } from '@inertiajs/react';
import { Cog, LogOut, Plus } from 'lucide-react';
import React from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
    RouteNavbar: string;
}

export default function MainLayout({
    children,
    RouteNavbar,
}: MainLayoutProps) {
    const { auth } = usePage().props as any;
    console.log('AUTH:', auth);
    console.log('ROLES:', auth?.user?.roles);
    console.log('PERMISSIONS:', auth?.user?.permissions);

    const roles: string[] = auth?.user?.roles ?? [];
    const permissions: string[] = auth?.user?.permissions ?? [];

    const isAdmin = roles.includes('admin');

    // Permisos
    const canProgramaciones =
        permissions.includes('programaciones.ver');

    const canAreas =
        permissions.includes('areas.ver');

    const canEmpleados =
        permissions.includes('empleados.ver');

    const canMarcaciones =
        permissions.includes('marcaciones.ver');

    const canCalendarioMarcaciones =
        permissions.includes('marcaciones.ver');

    const canAlertas =
        permissions.includes('marcaciones.ver');

    return (
        <div className="min-h-screen bg-white">

            {/* =========================
                ZONA SUPERIOR
            ========================== */}
            <div className="flex w-full items-center bg-[#a81c24] px-10 py-4">

                <div className="flex flex-1 flex-col items-start">
                    <img
                        src={logoWhite}
                        className="w-[40%]"
                        alt="Logo"
                    />

                    <p className="mt-[-10px] ml-5 text-lg font-black text-white">
                        Sistema Gestor de Tiempos
                    </p>
                </div>

                <div className="flex flex-1 justify-end space-x-3">

                    {/* SALIR */}
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="flex items-center justify-center rounded-sm border border-white px-3 text-center text-white hover:bg-white hover:text-[#a81c24]"
                    >
                        <LogOut className="m-1" />

                        <span className="m-1 ml-2 px-1 font-bold">
                            Salir
                        </span>
                    </Link>

                    {/* CONFIGURACIÓN */}
                    {isAdmin && (
                        <div className="flex items-center justify-center rounded-sm border border-white px-3 text-center text-white hover:bg-white hover:text-[#a81c24]">
                            <Cog className="m-1" />

                            <button className="m-1 ml-2 px-1 font-bold">
                                Configuración
                            </button>
                        </div>
                    )}

                    {/* NUEVA PROGRAMACIÓN */}
                    {permissions.includes('programaciones.crear') && (
                        <Link
                            href={route('newprogramations')}
                            className="flex items-center justify-center rounded-sm border border-white px-3 text-center text-white hover:bg-white hover:text-[#a81c24]"
                        >
                            <Plus className="m-1" />

                            <span className="m-1 ml-2 px-1 font-bold">
                                Nueva Programación
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* =========================
                BARRA DE NAVEGACIÓN
            ========================== */}
            <div className="mx-auto mt-5 flex w-[95%] items-center space-x-1 rounded-lg bg-[#95c020] px-1 py-1 text-white">

                {/* INICIO */}
                {isAdmin && (
                    <Link
                        href={route('inicio')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'inicio'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Inicio
                        </button>
                    </Link>
                )}

                {/* PROGRAMACIÓN */}
                {canProgramaciones && (
                    <Link
                        href={route('programaciones')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'programaciones'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Programación Mensual
                        </button>
                    </Link>
                )}

                {/* ÁREAS */}
                {canAreas && (
                    <Link
                        href={route('areas')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'areas'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Por Áreas
                        </button>
                    </Link>
                )}

                {/* EMPLEADOS */}
                {canEmpleados && (
                    <Link
                        href={route('empleados')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'empleados'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Empleados
                        </button>
                    </Link>
                )}

                {/* MARCACIONES */}
                {canMarcaciones && (
                    <Link
                        href={route('markinglogs')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'markinglogs'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Marcaciones
                        </button>
                    </Link>
                )}

                {/* CALENDARIO VS MARCACIONES */}
                {canCalendarioMarcaciones && (
                    <Link
                        href={route('calendario.marcaciones')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'calendario-marcaciones'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Calendario vs Marcaciones
                        </button>
                    </Link>
                )}

                {/* ALERTAS */}
                {canAlertas && (
                    <Link
                        href={route('alertas')}
                        className="flex-1"
                    >
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'alertas'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Alertas
                        </button>
                    </Link>
                )}
            </div>

            {/* =========================
                CONTENIDO
            ========================== */}
            <main>
                {children}
            </main>
        </div>
    );
}