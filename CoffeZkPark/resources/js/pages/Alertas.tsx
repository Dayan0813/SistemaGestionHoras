import MainLayout from '@/Layouts/MainLayout';
import {
    AlertCircle,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    Clock3,
    MessageSquare,
    Phone,
    RefreshCw,
    Search,
    Sparkles,
    UserRoundX,
    XCircle,
} from 'lucide-react';
import axios from 'axios';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

type AlertType =
    | 'salida'
    | 'inasistencia'
    | 'tardanza'
    | 'resuelta';

type Area = {
    id: number;
    nombre: string;
    alertas?: number;
};

type AlertItem = {
    id: string | number;

    date: string;
    time: string;

    type: AlertType;

    name: string;

    employee_uid?: string | null;

    dni?: string | null;

    area_name?: string | null;

    text: string;

    action?: string | null;

    programmed_entry?: string | null;

    programmed_exit?: string | null;

    marking_entry?: string | null;

    marking_exit?: string | null;

    generated_at?: string | null;
};

const alertTypeLabels: Record<AlertType, string> = {
    salida: 'Falta marcar salida',
    inasistencia: 'Inasistencia',
    tardanza: 'Tardanza',
    resuelta: 'Resuelta',
};

const alertTypeStyles: Record<
    AlertType,
    {
        icon: React.ReactNode;
        iconBackground: string;
        iconColor: string;
        badgeBackground: string;
        badgeColor: string;
    }
> = {
    salida: {
        icon: <AlertCircle size={19} />,
        iconBackground: 'bg-red-50',
        iconColor: 'text-red-500',
        badgeBackground: 'bg-red-50',
        badgeColor: 'text-red-600',
    },

    inasistencia: {
        icon: <XCircle size={19} />,
        iconBackground: 'bg-red-50',
        iconColor: 'text-red-500',
        badgeBackground: 'bg-red-50',
        badgeColor: 'text-red-600',
    },

    tardanza: {
        icon: <Clock3 size={19} />,
        iconBackground: 'bg-amber-50',
        iconColor: 'text-amber-500',
        badgeBackground: 'bg-amber-50',
        badgeColor: 'text-amber-600',
    },

    resuelta: {
        icon: <CheckCircle2 size={19} />,
        iconBackground: 'bg-green-50',
        iconColor: 'text-green-500',
        badgeBackground: 'bg-green-50',
        badgeColor: 'text-green-600',
    },
};

function formatDate(date: string) {
    const parsed = new Date(`${date}T12:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return date;
    }

    return parsed.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function formatShortDate(date: string) {
    const parsed = new Date(`${date}T12:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return date;
    }

    return parsed.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function getDefaultStartDate() {
    const date = new Date();

    date.setDate(date.getDate() - 1);

    return date.toISOString().split('T')[0];
}

function formatTime(time?: string | null) {
    if (!time) {
        return '--:--';
    }

    if (time.length >= 16 && time.includes('T')) {
        return new Date(time).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }

    return time.substring(0, 5);
}

export default function Alertas() {
    const [areas, setAreas] = useState<Area[]>([]);

    const [selectedArea, setSelectedArea] =
        useState<string>('all');

    const [startDate, setStartDate] =
        useState<string>(getDefaultStartDate());

    const [endDate, setEndDate] =
        useState<string>(today());

    const [search, setSearch] =
        useState<string>('');

    const [alerts, setAlerts] =
        useState<AlertItem[]>([]);

    const [loading, setLoading] =
        useState<boolean>(false);

    const [areasLoading, setAreasLoading] =
        useState<boolean>(true);

    const [error, setError] =
        useState<string | null>(null);

    const [lastUpdate, setLastUpdate] =
        useState<Date | null>(null);

    const [filter, setFilter] =
        useState<'all' | AlertType>('all');

    const [reviewed, setReviewed] =
        useState<(string | number)[]>([]);

    /*
    |--------------------------------------------------------------------------
    | CARGAR ÁREAS
    |--------------------------------------------------------------------------
    */

    const loadAreas = useCallback(async () => {
        try {
            setAreasLoading(true);

            const response =
                await axios.get('/api/alertas/areas');

            if (response.data?.success) {
                setAreas(
                    response.data.areas ?? []
                );
            }
        } catch (error) {
            console.error(
                'Error cargando áreas:',
                error
            );
        } finally {
            setAreasLoading(false);
        }
    }, []);

    /*
    |--------------------------------------------------------------------------
    | CONSULTAR ALERTAS
    |--------------------------------------------------------------------------
    */

    const loadAlerts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(
                '/api/alertas',
                {
                    params: {
                        area_id:
                            selectedArea === 'all'
                                ? ''
                                : selectedArea,

                        start_date: startDate,

                        end_date: endDate,

                        search: search,
                    },
                }
            );

            if (response.data?.success) {
                setAlerts(
                    response.data.alerts ?? []
                );

                setLastUpdate(new Date());
            } else {
                setAlerts([]);
            }
        } catch (error) {
            console.error(
                'Error consultando alertas:',
                error
            );

            setError(
                'No fue posible consultar las alertas. Verifica que el servidor esté funcionando.'
            );
        } finally {
            setLoading(false);
        }
    }, [
        selectedArea,
        startDate,
        endDate,
        search,
    ]);

    /*
    |--------------------------------------------------------------------------
    | CARGA INICIAL
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        loadAreas();
        loadAlerts();
    }, [loadAreas, loadAlerts]);

    /*
    |--------------------------------------------------------------------------
    | ACTUALIZACIÓN AUTOMÁTICA
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const interval = setInterval(() => {
            loadAlerts();
        }, 15000);

        return () => {
            clearInterval(interval);
        };
    }, [loadAlerts]);

    /*
    |--------------------------------------------------------------------------
    | FILTRAR
    |--------------------------------------------------------------------------
    */

    const visibleAlerts = useMemo(() => {
        let result = [...alerts];

        if (filter !== 'all') {
            result = result.filter(
                (alert) =>
                    alert.type === filter
            );
        }

        if (search.trim() !== '') {
            const value =
                search.toLowerCase().trim();

            result = result.filter((alert) =>
                [
                    alert.name,
                    alert.employee_uid,
                    alert.dni,
                    alert.area_name,
                ]
                    .filter(Boolean)
                    .some((item) =>
                        String(item)
                            .toLowerCase()
                            .includes(value)
                    )
            );
        }

        return result;
    }, [alerts, filter, search]);

    /*
    |--------------------------------------------------------------------------
    | CONTADORES
    |--------------------------------------------------------------------------
    */

    const totalAlerts =
        alerts.length;

    const exitAlerts =
        alerts.filter(
            (alert) =>
                alert.type === 'salida'
        ).length;

    const absenceAlerts =
        alerts.filter(
            (alert) =>
                alert.type === 'inasistencia'
        ).length;

    const lateAlerts =
        alerts.filter(
            (alert) =>
                alert.type === 'tardanza'
        ).length;

    const pendingAlerts =
        alerts.filter(
            (alert) =>
                alert.type !== 'resuelta' &&
                !reviewed.includes(alert.id)
        ).length;

    /*
    |--------------------------------------------------------------------------
    | AGRUPAR POR FECHA
    |--------------------------------------------------------------------------
    */

    const groupedAlerts = useMemo(() => {
        const groups: Record<
            string,
            AlertItem[]
        > = {};

        visibleAlerts.forEach((alert) => {
            if (!groups[alert.date]) {
                groups[alert.date] = [];
            }

            groups[alert.date].push(alert);
        });

        return Object.entries(groups).sort(
            ([dateA], [dateB]) =>
                dateB.localeCompare(dateA)
        );
    }, [visibleAlerts]);

    /*
    |--------------------------------------------------------------------------
    | MARCAR REVISADA
    |--------------------------------------------------------------------------
    */

    const markReviewed = (
        id: string | number
    ) => {
        setReviewed((previous) => {
            if (previous.includes(id)) {
                return previous;
            }

            return [...previous, id];
        });
    };

    /*
    |--------------------------------------------------------------------------
    | CONSULTAR
    |--------------------------------------------------------------------------
    */

    const handleConsult = () => {
        loadAlerts();
    };

    return (
        <div className="min-h-screen bg-white">

            {/* =========================================================
                CONTENIDO
            ========================================================== */}

            <div className="mx-auto w-full max-w-[1180px] px-8 py-12">

                {/* =====================================================
                    CABECERA
                ====================================================== */}

                <div className="mb-10">

                    <div className="flex items-center justify-between">

                        <div>

                            <h1 className="text-[28px] font-bold tracking-tight text-[#a71920]">
                                Alertas
                            </h1>

                            <p className="mt-1 text-sm text-gray-500">
                                Seguimiento de novedades de
                                asistencia y marcaciones.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={loadAlerts}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >

                            <RefreshCw
                                size={16}
                                className={
                                    loading
                                        ? 'animate-spin'
                                        : ''
                                }
                            />

                            Sincronizar

                        </button>

                    </div>

                </div>

                {/* =====================================================
                    PANEL DE CONSULTA
                ====================================================== */}

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">

                    <div className="grid w-full grid-cols-[1.2fr_1fr_1fr_1.15fr_auto] items-end gap-3">

                        {/* ÁREA */}

                        <div>

                            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gray-600 uppercase">

                                <Building2
                                    size={14}
                                    className="text-[#a71920]"
                                />

                                Seleccionar área

                            </label>

                            <div className="relative">

                                <select
                                    value={selectedArea}
                                    onChange={(event) =>
                                        setSelectedArea(
                                            event.target.value
                                        )
                                    }
                                    className="h-[40px] w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 pr-10 text-xs text-gray-600 outline-none focus:border-[#a71920] focus:ring-1 focus:ring-[#a71920]"
                                >

                                    <option value="all">
                                        Todas las áreas
                                    </option>

                                    {areas.map(
                                        (area) => (
                                            <option
                                                key={
                                                    area.id
                                                }
                                                value={
                                                    area.id
                                                }
                                            >
                                                {
                                                    area.nombre
                                                }

                                                {typeof area.alertas ===
                                                    'number' &&
                                                    ` (${area.alertas} alertas)`}
                                            </option>
                                        )
                                    )}

                                </select>

                                <ChevronDown
                                    size={15}
                                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
                                />

                            </div>

                        </div>

                        {/* FECHA INICIAL */}

                        <div>

                            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gray-600 uppercase">

                                <CalendarDays
                                    size={14}
                                    className="text-[#a71920]"
                                />

                                Desde

                            </label>

                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    setStartDate(
                                        event.target.value
                                    )
                                }
                                className="h-[40px] w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-600 outline-none focus:border-[#a71920] focus:ring-1 focus:ring-[#a71920]"
                            />

                        </div>

                        {/* FECHA FINAL */}

                        <div>

                            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gray-600 uppercase">

                                <CalendarDays
                                    size={14}
                                    className="text-[#a71920]"
                                />

                                Hasta

                            </label>

                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) =>
                                    setEndDate(
                                        event.target.value
                                    )
                                }
                                className="h-[40px] w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs text-gray-600 outline-none focus:border-[#a71920] focus:ring-1 focus:ring-[#a71920]"
                            />

                        </div>

                        {/* BUSCAR */}

                        <div>

                            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wide text-gray-600 uppercase">

                                <Search
                                    size={14}
                                    className="text-[#a71920]"
                                />

                                Buscar empleado

                            </label>

                            <div className="relative">

                                <Search
                                    size={16}
                                    className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                                />

                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Nombre, DNI o UID..."
                                    className="h-[40px] w-full rounded-lg border border-gray-200 bg-gray-50 pr-3 pl-9 text-xs text-gray-600 outline-none placeholder:text-gray-400 focus:border-[#a71920] focus:ring-1 focus:ring-[#a71920]"
                                />

                            </div>

                        </div>

                        {/* CONSULTAR */}

                        <div className="flex items-end">

                            <button
                                type="button"
                                onClick={handleConsult}
                                disabled={loading}
                                className="flex h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-[#a71920] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#8f151b] disabled:opacity-60"
                            >

                                <Sparkles size={15} />

                                Consultar Alertas

                            </button>

                        </div>

                    </div>

                </div>

                {/* =====================================================
                    INFORMACIÓN DE CONSULTA
                ====================================================== */}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

                    <div className="text-xs text-gray-400">

                        Período consultado:{' '}

                        <strong className="font-semibold text-gray-600">
                            {formatShortDate(startDate)}
                        </strong>

                        {' - '}

                        <strong className="font-semibold text-gray-600">
                            {formatShortDate(endDate)}
                        </strong>

                    </div>

                    {lastUpdate && (
                        <div className="text-[11px] text-gray-400">

                            Actualizado a las{' '}

                            {lastUpdate.toLocaleTimeString(
                                'es-CO',
                                {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                }
                            )}

                        </div>
                    )}

                </div>

                {/* =====================================================
                    ERROR
                ====================================================== */}

                {error && (

                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                        <div className="flex items-center gap-2">

                            <XCircle size={17} />

                            {error}

                        </div>

                    </div>

                )}

                {/* =====================================================
                    FILTROS
                ====================================================== */}

                <div className="mt-10 flex flex-wrap items-center justify-center gap-2">

                    <FilterButton
                        active={filter === 'all'}
                        onClick={() =>
                            setFilter('all')
                        }
                        label="Todas"
                        count={totalAlerts}
                    />

                    <FilterButton
                        active={
                            filter === 'salida'
                        }
                        onClick={() =>
                            setFilter('salida')
                        }
                        label="Falta marcar salida"
                        count={exitAlerts}
                    />

                    <FilterButton
                        active={
                            filter === 'inasistencia'
                        }
                        onClick={() =>
                            setFilter(
                                'inasistencia'
                            )
                        }
                        label="Inasistencias"
                        count={absenceAlerts}
                    />

                    <FilterButton
                        active={
                            filter === 'tardanza'
                        }
                        onClick={() =>
                            setFilter('tardanza')
                        }
                        label="Tardanzas"
                        count={lateAlerts}
                    />

                </div>

                {/* =====================================================
                    RESUMEN
                ====================================================== */}

                <div className="mt-4 text-center text-[11px] text-gray-400">

                    {loading ? (
                        <span>
                            Consultando marcaciones...
                        </span>
                    ) : (
                        <span>
                            {visibleAlerts.length}{' '}
                            novedades encontradas
                        </span>
                    )}

                    <span className="mx-2">
                        •
                    </span>

                    <span>
                        {pendingAlerts}{' '}
                        pendientes
                    </span>

                </div>

                {/* =====================================================
                    LOADING
                ====================================================== */}

                {loading &&
                    alerts.length === 0 && (

                        <div className="py-20 text-center">

                            <RefreshCw
                                size={30}
                                className="mx-auto animate-spin text-[#a71920]"
                            />

                            <p className="mt-3 text-sm text-gray-500">
                                Consultando las
                                marcaciones del
                                huellero...
                            </p>

                        </div>
                    )}

                {/* =====================================================
                    SIN ALERTAS
                ====================================================== */}

                {!loading &&
                    visibleAlerts.length ===
                        0 && (

                        <div className="mt-8 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">

                            <CheckCircle2
                                size={42}
                                className="mx-auto text-green-500"
                            />

                            <h2 className="mt-4 text-base font-bold text-gray-700">
                                No hay alertas
                            </h2>

                            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">
                                No se encontraron
                                novedades para
                                los filtros y
                                período
                                seleccionados.
                            </p>

                        </div>
                    )}

                {/* =====================================================
                    LISTADO DE ALERTAS
                ====================================================== */}

                <div className="mt-8">

                    {groupedAlerts.map(
                        ([date, dateAlerts]) => (

                            <div
                                key={date}
                                className="mb-9"
                            >

                                {/* FECHA */}

                                <div className="mb-4 flex items-center gap-3">

                                    <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-gray-500 uppercase">

                                        <CalendarDays
                                            size={14}
                                            className="text-gray-400"
                                        />

                                        {date ===
                                        today()
                                            ? `Hoy · ${formatDate(date)}`
                                            : formatDate(
                                                  date
                                              )}

                                    </div>

                                    <div className="h-px flex-1 bg-gray-100" />

                                    <span className="text-[10px] text-gray-400">

                                        {
                                            dateAlerts.length
                                        }{' '}

                                        {dateAlerts.length ===
                                        1
                                            ? 'novedad'
                                            : 'novedades'}{' '}
                                        registradas

                                    </span>

                                </div>

                                {/* TARJETAS */}

                                <div className="space-y-3">

                                    {dateAlerts.map(
                                        (alert) => {

                                            const style =
                                                alertTypeStyles[
                                                    alert
                                                        .type
                                                ];

                                            const isReviewed =
                                                reviewed.includes(
                                                    alert.id
                                                );

                                            return (

                                                <div
                                                    key={
                                                        alert.id
                                                    }
                                                    className={`rounded-xl border bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition ${
                                                        isReviewed
                                                            ? 'border-green-100 opacity-70'
                                                            : 'border-gray-100 hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]'
                                                    }`}
                                                >

                                                    <div className="flex gap-4">

                                                        {/* ICONO */}

                                                        <div
                                                            className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${style.iconBackground} ${style.iconColor}`}
                                                        >
                                                            {
                                                                style.icon
                                                            }
                                                        </div>

                                                        {/* CONTENIDO */}

                                                        <div className="min-w-0 flex-1">

                                                            <div className="flex flex-wrap items-center gap-2">

                                                                <h3 className="text-sm font-bold text-gray-800">

                                                                    {
                                                                        alert.name
                                                                    }

                                                                </h3>

                                                                <span
                                                                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${style.badgeBackground} ${style.badgeColor}`}
                                                                >

                                                                    {
                                                                        alertTypeLabels[
                                                                            alert
                                                                                .type
                                                                        ]
                                                                    }

                                                                </span>

                                                                {alert.area_name && (

                                                                    <span className="text-[10px] text-gray-400">

                                                                        •{' '}

                                                                        {
                                                                            alert.area_name
                                                                        }

                                                                    </span>
                                                                )}

                                                            </div>

                                                            {/* TEXTO */}

                                                            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">

                                                                {
                                                                    alert.text
                                                                }

                                                            </p>

                                                            {/* INFORMACIÓN */}

                                                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400">

                                                                <span className="flex items-center gap-1">

                                                                    <Clock3
                                                                        size={
                                                                            12
                                                                        }
                                                                    />

                                                                    Horario:{' '}

                                                                    <strong className="font-semibold text-gray-500">

                                                                        {
                                                                            alert.programmed_entry ??
                                                                            '--:--'
                                                                        }

                                                                        {' - '}

                                                                        {
                                                                            alert.programmed_exit ??
                                                                            '--:--'
                                                                        }

                                                                    </strong>

                                                                </span>

                                                                {alert.marking_entry && (

                                                                    <span>

                                                                        Marcación
                                                                        de
                                                                        entrada:{' '}

                                                                        <strong className="text-gray-500">

                                                                            {
                                                                                formatTime(
                                                                                    alert.marking_entry
                                                                                )
                                                                            }

                                                                        </strong>

                                                                    </span>
                                                                )}

                                                                {alert.marking_exit && (

                                                                    <span>

                                                                        Última
                                                                        marcación:{' '}

                                                                        <strong className="text-gray-500">

                                                                            {
                                                                                formatTime(
                                                                                    alert.marking_exit
                                                                                )
                                                                            }

                                                                        </strong>

                                                                    </span>
                                                                )}

                                                                {alert.employee_uid && (

                                                                    <span>

                                                                        UID:{' '}

                                                                        <strong className="font-mono text-gray-500">

                                                                            {
                                                                                alert.employee_uid
                                                                            }

                                                                        </strong>

                                                                    </span>
                                                                )}

                                                                <span>

                                                                    Alerta
                                                                    generada:{' '}

                                                                    <strong className="text-gray-500">

                                                                        {
                                                                            formatTime(
                                                                                alert.generated_at ??
                                                                                    alert.time
                                                                            )
                                                                        }

                                                                    </strong>

                                                                </span>

                                                            </div>

                                                        </div>

                                                        {/* ACCIONES */}

                                                        <div className="flex flex-none flex-col justify-center gap-2">

                                                            {alert.type ===
                                                                'salida' && (

                                                                <button
                                                                    type="button"
                                                                    className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-100"
                                                                    onClick={() => {
                                                                        console.log(
                                                                            'Notificar empleado:',
                                                                            alert
                                                                        );
                                                                    }}
                                                                >

                                                                    <MessageSquare
                                                                        size={
                                                                            13
                                                                        }
                                                                    />

                                                                    Notificar
                                                                    al
                                                                    empleado

                                                                </button>
                                                            )}

                                                            {alert.type ===
                                                                'inasistencia' && (

                                                                <button
                                                                    type="button"
                                                                    className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-100"
                                                                    onClick={() => {
                                                                        console.log(
                                                                            'Contactar supervisor:',
                                                                            alert
                                                                        );
                                                                    }}
                                                                >

                                                                    <Phone
                                                                        size={
                                                                            13
                                                                        }
                                                                    />

                                                                    Contactar
                                                                    supervisor

                                                                </button>
                                                            )}

                                                            {alert.type ===
                                                                'tardanza' && (

                                                                <button
                                                                    type="button"
                                                                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-600 transition hover:bg-gray-100"
                                                                    onClick={() => {
                                                                        console.log(
                                                                            'Ver detalle:',
                                                                            alert
                                                                        );
                                                                    }}
                                                                >

                                                                    <Search
                                                                        size={
                                                                            13
                                                                        }
                                                                    />

                                                                    Ver
                                                                    detalle

                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    isReviewed
                                                                }
                                                                onClick={() =>
                                                                    markReviewed(
                                                                        alert.id
                                                                    )
                                                                }
                                                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold transition ${
                                                                    isReviewed
                                                                        ? 'border-green-100 bg-green-50 text-green-600'
                                                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                            >

                                                                <Check
                                                                    size={
                                                                        13
                                                                    }
                                                                />

                                                                {isReviewed
                                                                    ? 'Revisada'
                                                                    : 'Marcar revisada'}

                                                            </button>

                                                        </div>

                                                    </div>

                                                </div>

                                            );
                                        }
                                    )}

                                </div>

                            </div>
                        )
                    )}

                </div>

                {/* =====================================================
                    PIE
                ====================================================== */}

                {visibleAlerts.length >
                    0 && (

                    <div className="mt-8 flex flex-wrap items-center justify-between border-t border-gray-100 pt-5 text-[10px] text-gray-400">

                        <span>
                            Mostrando{' '}
                            <strong className="text-gray-500">
                                {
                                    visibleAlerts.length
                                }
                            </strong>{' '}
                            de{' '}
                            <strong className="text-gray-500">
                                {alerts.length}
                            </strong>{' '}
                            alertas
                        </span>

                        <span className="flex items-center gap-1 text-green-600">

                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />

                            Datos sincronizados
                            con el sistema de
                            marcaciones

                        </span>

                    </div>
                )}

            </div>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| BOTÓN DE FILTRO
|--------------------------------------------------------------------------
*/

function FilterButton({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                active
                    ? 'border-[#8f171d] bg-[#8f171d] text-white shadow-sm'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
        >
            {label}

            <span
                className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold ${
                    active
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-500'
                }`}
            >
                {count}
            </span>
        </button>
    );
}

Alertas.layout = (page: React.ReactNode) => (
    <MainLayout RouteNavbar="alertas">
        {page}
    </MainLayout>
);