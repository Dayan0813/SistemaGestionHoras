import MainLayout from '@/Layouts/MainLayout';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import {
    CalendarDays,
    Search,
    RefreshCcw,
} from 'lucide-react';

interface Area {
    id: number;
    nombre: string;
}

interface Registro {
    employee_uid: string;
    employee_name: string;
    area_id: number;
    area_name: string | null;

    programmed_entry: string | null;
    programmed_exit: string | null;

    marking_entry: string | null;
    marking_exit: string | null;

    marking_count: number;

    status: string;
}

interface Props {
    currentRouteName: string;
}

export default function CalendarioVsMarcaciones({
    currentRouteName,
}: Props) {
    const [fecha, setFecha] = useState(
        new Date().toISOString().split('T')[0]
    );

    const [search, setSearch] = useState('');

    const [areaId, setAreaId] = useState('all');

    const [areas, setAreas] = useState<Area[]>([]);

    const [registros, setRegistros] = useState<Registro[]>([]);

    const [loading, setLoading] = useState(false);

    const consultar = async () => {
        try {
            setLoading(true);

            const response = await axios.get(
                '/api/calendario-marcaciones',
                {
                    params: {
                        fecha,
                        search,
                        area_id:
                            areaId === 'all'
                                ? ''
                                : areaId,
                    },
                }
            );

            if (response.data?.success) {
                setRegistros(
                    response.data.data ?? []
                );

                setAreas(
                    response.data.areas ?? []
                );
            }
        } catch (error) {
            console.error(
                'Error consultando calendario:',
                error
            );

            setRegistros([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        consultar();
    }, []);

    const estadoClase = (estado: string) => {
        switch (estado) {
            case 'Completa':
                return 'bg-green-100 text-green-700';

            case 'Entrada tardía':
                return 'bg-yellow-100 text-yellow-700';

            case 'Falta salida':
                return 'bg-orange-100 text-orange-700';

            case 'Sin marcación':
                return 'bg-red-100 text-red-700';

            case 'En jornada':
                return 'bg-blue-100 text-blue-700';

            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto w-[95%] py-8">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#a81c24]">
                        Calendario vs Marcaciones
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                        Compara el horario programado con
                        las marcaciones reales.
                    </p>
                </div>

                {/* FILTROS */}
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

                        <div>
                            <label className="mb-2 block text-sm font-semibold">
                                Fecha
                            </label>

                            <div className="relative">
                                <CalendarDays
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />

                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) =>
                                        setFecha(
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">
                                Área
                            </label>

                            <select
                                value={areaId}
                                onChange={(e) =>
                                    setAreaId(
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-lg border border-gray-300 p-2"
                            >
                                <option value="all">
                                    Todas las áreas
                                </option>

                                {areas.map((area) => (
                                    <option
                                        key={area.id}
                                        value={area.id}
                                    >
                                        {area.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">
                                Empleado
                            </label>

                            <input
                                type="text"
                                value={search}
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Nombre o UID..."
                                className="w-full rounded-lg border border-gray-300 p-2"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={consultar}
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#a81c24] px-4 py-2 font-bold text-white disabled:opacity-50"
                            >
                                <Search size={18} />

                                {loading
                                    ? 'Consultando...'
                                    : 'Consultar'}
                            </button>
                        </div>

                    </div>
                </div>

                {/* TABLA */}
                <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">

                    <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-4">

                        <div>
                            <h2 className="font-bold text-gray-700">
                                Comparación de jornada
                            </h2>

                            <p className="text-xs text-gray-500">
                                {fecha}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={consultar}
                            className="rounded-lg border p-2 hover:bg-gray-100"
                        >
                            <RefreshCcw size={18} />
                        </button>

                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">

                            <thead className="bg-[#95c020] text-white">
                                <tr>
                                    <th className="px-4 py-3">
                                        Empleado
                                    </th>

                                    <th className="px-4 py-3">
                                        Área
                                    </th>

                                    <th className="px-4 py-3">
                                        Programado
                                    </th>

                                    <th className="px-4 py-3">
                                        Entrada
                                    </th>

                                    <th className="px-4 py-3">
                                        Salida
                                    </th>

                                    <th className="px-4 py-3">
                                        Marcaciones
                                    </th>

                                    <th className="px-4 py-3">
                                        Estado
                                    </th>
                                </tr>
                            </thead>

                            <tbody>

                                {registros.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-gray-400"
                                        >
                                            No hay información
                                            para la fecha
                                            seleccionada.
                                        </td>
                                    </tr>
                                )}

                                {registros.map(
                                    (registro, index) => (
                                        <tr
                                            key={`${registro.employee_uid}-${index}`}
                                            className="border-b hover:bg-gray-50"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-semibold">
                                                    {
                                                        registro.employee_name
                                                    }
                                                </div>

                                                <div className="text-xs text-gray-400">
                                                    {
                                                        registro.employee_uid
                                                    }
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                {
                                                    registro.area_name ??
                                                    'Sin área'
                                                }
                                            </td>

                                            <td className="px-4 py-3">
                                                {registro.programmed_entry ??
                                                    '--:--'}
                                                {' - '}
                                                {registro.programmed_exit ??
                                                    '--:--'}
                                            </td>

                                            <td className="px-4 py-3">
                                                {registro.marking_entry ??
                                                    '--:--'}
                                            </td>

                                            <td className="px-4 py-3">
                                                {registro.marking_exit ??
                                                    '--:--'}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {
                                                    registro.marking_count
                                                }
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoClase(
                                                        registro.status
                                                    )}`}
                                                >
                                                    {
                                                        registro.status
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                )}

                            </tbody>

                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}

CalendarioVsMarcaciones.layout = (
    page: React.ReactNode
) => (
    <MainLayout
        RouteNavbar={
            (page as any).props.currentRouteName
        }
    >
        {page}
    </MainLayout>
);