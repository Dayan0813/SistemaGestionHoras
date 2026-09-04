// resources/js/Pages/Inicio.tsx
import MainLayout from '@/Layouts/MainLayout';
import { Link } from '@inertiajs/react';
import { BrainCircuit, ClipboardMinus, Hourglass, UserRoundPlus } from 'lucide-react';
import React from 'react';

interface CurrentProps {
    currentRouteName: string;
}

const Servicios = ({ currentRouteName }: CurrentProps) => {
    return (
        <div className="p-6">
            <h1 className="mb-4 text-center text-2xl font-bold">Servicios</h1>
            <div className="mx-auto p-4">
                <div className="mx-auto grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/*Bloque 1*/}
                    <Link href={route('devices.index')}>
                        <div className="rounded-lg border border-[#a81c24] p-6 text-[#a81c24] shadow-md">
                            <h3 className="mb-3 flex items-center text-xl font-semibold">
                                Dispositivos ZKTeco <BrainCircuit className="ml-2" />
                            </h3>
                            <p className="text-[#a81c24]">Vistas e Informacion de los dispositivos ZKTECO</p>
                        </div>
                    </Link>

                    {/*Bloque 2*/}
                    <Link href={route('consolidations.index')}>
                        <div className="rounded-lg border border-[#a81c24] p-6 text-[#a81c24] shadow-md">
                            <h3 className="mb-3 flex items-center text-xl font-semibold">
                                Consolidados <ClipboardMinus className="ml-2" />
                            </h3>
                            <p className="text-[#a81c24]">Genera los Consolidados de horas generales</p>
                        </div>
                    </Link>

                    {/*Bloque 3*/}
                    <Link href={route('users.create')}>
                        <div className="rounded-lg border border-[#a81c24] p-6 text-[#a81c24] shadow-md">
                            <h3 className="mb-3 flex items-center text-xl font-semibold">
                                Crear Usuario <UserRoundPlus className="ml-2" />
                            </h3>
                            <p className="text-[#a81c24]">Crea Usuarios Admin o Cordinador</p>
                        </div>
                    </Link>

                    {/*Bloque 4*/}
                    <div className="rounded-lg border border-[#a81c24] p-6 text-[#a81c24] shadow-md">
                        <h3 className="mb-3 flex items-center text-xl font-semibold">
                            En produccion... <Hourglass className="ml-2" />
                        </h3>
                        <p className="text-[#a81c24]">Pronto Tendremos Una nueva Vista</p>
                    </div>
                </div>
            </div>
        </div>
    );
}; 
Servicios.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default Servicios;
