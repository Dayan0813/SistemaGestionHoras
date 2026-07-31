import MainLayout from '@/Layouts/MainLayout';
import { Link, usePage } from '@inertiajs/react';
import Generator from './Generator';

export default function Index() {
    const { employees, areas, consolidado } = usePage().props as any;

    return (
        <>
            {/* TÍTULO */}
            <h1 className="mt-8 mb-10 text-center text-2xl font-semibold text-gray-900">Generador de Consolidado</h1>

            <div className="mx-auto max-w-7xl space-y-10 px-6">
                {/* =============================
                    GENERADOR
                ============================== */}
                <Generator employees={employees} areas={areas} />

                {/* =============================
                    RESULTADOS
                ============================== */}
                <div className="overflow-hidden rounded-xl border border-gray-200/60 bg-white shadow-sm">
                    {/* HEADER TABLA */}
                    <div className="flex items-center justify-between border-b border-gray-200/60 px-6 py-4">
                        <h2 className="font-semibold text-gray-900">Resultados del Consolidado</h2>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{consolidado.total} registros</span>
                    </div>

                    {/* TABLA */}
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    {[
                                        'UID',
                                        'ORD. DÍA',
                                        'ORD. NOCHE',
                                        'O.F. DÍA',
                                        'O.F. NOCHE',
                                        'EXT. DÍA',
                                        'EXT. NOCHE',
                                        'E.F. DÍA',
                                        'E.F. NOCHE',
                                        'NO PROG.',
                                        'TOTAL',
                                    ].map((h) => (
                                        <th key={h} className="border-b border-gray-200/60 px-3 py-3 text-left font-medium">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {consolidado.data.map((row: any) => (
                                    <tr key={row.id} className="transition hover:bg-gray-50">
                                        {/* UID */}
                                        <td className="border-b border-gray-200/40 px-3 py-3">
                                            <span className="rounded-full text-[#a81c24] font-bold px-2 py-1 text-md">{row.employee_uid}</span>
                                        </td>

                                        {/* HORAS */}
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.ordinary_day}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.ordinary_night}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.ordinary_festive_day}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.ordinary_festive_night}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.extra_day}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.extra_night}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.extra_festive_day}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.extra_festive_night}</td>
                                        <td className="border-b border-gray-200/40 px-3 py-3">{row.hours.unplanned}</td>

                                        {/* TOTAL */}
                                        <td className="border-b border-gray-200/40 px-3 py-3">
                                            <span className="inline-flex items-center justify-center rounded-full bg-[#de242f] px-3 py-1 text-xs font-semibold text-white">
                                                {Number(row.total_hours).toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINACIÓN */}
                    <div className="flex items-center justify-between border-t border-gray-200/60 px-6 py-4">
                        <span className="text-xs text-gray-500">
                            Mostrando {consolidado.from}–{consolidado.to} de {consolidado.total}
                        </span>

                        <div className="flex gap-2">
                            {consolidado.links
                                .filter((link: any) => !isNaN(Number(link.label)))
                                .map((link: any, index: number) => (
                                    <Link
                                        key={index}
                                        href={link.url || ''}
                                        preserveScroll
                                        preserveState
                                        className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                                            link.active ? 'border-gray-900 bg-[#95c020] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                                        } ${!link.url && 'cursor-not-allowed opacity-40'} `}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
