import logoWhite from '@/Assets/LogoWhite.png';
import { Link, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import React from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
    RouteNavbar: string;
}

export default function MainLayout({ children, RouteNavbar }: MainLayoutProps) {
    const { auth } = usePage().props as any;
    const roles: string[] = auth?.user?.roles ?? [];
    const permissions: string[] = auth?.user?.permissions ?? [];

    const isAdmin = roles.includes('admin');
    const canProgram = permissions.includes('programaciones.crear');
    // Roles de solo lectura (aux_th) tienen "programaciones.ver" pero no
    // "programaciones.crear" — sin esto no tenían forma de llegar a ver
    // programaciones desde el menú.
    const canViewProgram = permissions.includes('programaciones.ver');
    const canEmployees = permissions.includes('empleados.ver');
    const canMarkings = permissions.includes('marcaciones.ver');
    const canManageDevices = permissions.includes('dispositivos.gestionar');

    return (
        <div>
            {/* Zona Superior Fija */}
            <div className="flex w-full items-center bg-[#a81c24] px-10 py-4">
                <div className="flex flex-1 flex-col items-start">
                    <img src={logoWhite} className="w-[40%]" />
                    <p className="mt-[-10px] ml-5 text-lg font-black text-white">Sistema Gestor de Tiempos</p>
                </div>
                <div className="flex flex-1 justify-end space-x-3">
                    {/*Boton Salir*/}
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="flex items-center justify-center rounded-sm border border-white px-3 text-center text-white hover:bg-white hover:text-[#a81c24]"
                    >
                        <LogOut className="m-1" />
                        <span className="m-1 ml-2 px-1 font-bold">Salir</span>
                    </Link>
                </div>
            </div>

            {/* Barra de Navegación del Menú */}
            <div className="mx-auto mt-5 flex w-[95%] items-center space-x-1 rounded-lg bg-[#95c020] px-1 py-1 text-white">
                {isAdmin && (
                    <Link href={route('inicio')} className="flex-1">
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

                {isAdmin && (
                    <Link href={route('servicios')} className="flex-1">
                        <button
                            className={`w-full rounded-lg px-1 py-1 transition-all duration-300 ${
                                RouteNavbar === 'servicios'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Servicios
                        </button>
                    </Link>
                )}

                {canViewProgram && <Link href={route('programaciones')} className="flex-1">
                    <button
                        className={`300ms w-full rounded-lg px-1 py-1 transition-all ${
                            RouteNavbar === 'programaciones'
                                ? 'bg-white font-bold text-[#95c020] shadow-md'
                                : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                        }`}
                    >
                        {canProgram ? 'Programación Mensual' : 'Ver Programaciones'}
                    </button>
                </Link>}
                {canProgram && <Link href={route('areas')} className="flex-1">
                    <button
                        className={`300ms w-full rounded-lg px-1 py-1 transition-all ${
                            RouteNavbar === 'areas'
                                ? 'bg-white font-bold text-[#95c020] shadow-md'
                                : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                        }`}
                    >
                        Por Áreas
                    </button>
                </Link>}
                {canEmployees && (
                    <Link href={route('empleados')} className="flex-1">
                        <button
                            className={`300ms w-full rounded-lg px-1 py-1 transition-all ${
                                RouteNavbar === 'empleados'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Empleados
                        </button>
                    </Link>
                )}
                {canMarkings && (
                    
                    <Link href={route('markinglogs')} className="flex-1">
                        <button
                            className={`w-full rounded-lg px-1 py-1 ${
                                RouteNavbar === 'markingslogs'
                                    ? 'bg-white font-bold text-[#95c020] shadow-md'
                                    : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'
                            }`}
                        >
                            Marcaciones
                        </button>
                    </Link>
                )}
                {canMarkings && <Link href={route('calendario.marcaciones')} className="flex-1">
                    <button className={`w-full rounded-lg px-1 py-1 ${RouteNavbar === 'calendario-marcaciones' ? 'bg-white font-bold text-[#95c020] shadow-md' : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'}`}>
                        Calendario vs. Marcaciones
                    </button>
                </Link>}
                {canMarkings && <Link href={route('alertas')} className="flex-1">
                    <button className={`w-full rounded-lg px-1 py-1 ${RouteNavbar === 'alertas' ? 'bg-white font-bold text-[#95c020] shadow-md' : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'}`}>
                        Alertas
                    </button>
                </Link>}
                {canManageDevices && (
                    <Link href={route('devices.index')} className="flex-1">
                        <button
                            className={`w-full rounded-lg px-1 py-1 ${RouteNavbar === 'devices' ? 'bg-white font-bold text-[#95c020] shadow-md' : 'bg-[#95c020] hover:bg-white hover:text-[#95c020]'}`}
                        >
                            Dispositivos
                        </button>
                    </Link>
                )}
            </div>

            {/* Zona de contenido que cambia */}
            <main>{children}</main>
        </div>
    );
}
