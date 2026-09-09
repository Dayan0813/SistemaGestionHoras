import MainLayout from '@/Layouts/MainLayout';
import { Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { CalendarCog } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import AreaScheduleGrid from './AreaScheduleGrid';
import ManageCalendarsModal from './ManageCalendarsModal';

/* =========================
   TIPOS
========================= */

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

/* =========================
   COMPONENT
========================= */

export default function DetailsProgramations() {
    const { areaId, areaName } = usePage().props as unknown as { areaId: number; areaName: string };

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [managingCalendars, setManagingCalendars] = useState(false);

    const fetchCalendars = useCallback(() => {
        axios.get(route('calendars.byArea', areaId)).then((res) => setCalendars(res.data));
    }, [areaId]);

    useEffect(() => {
        fetchCalendars();
    }, [fetchCalendars]);

    /* =========================
       RENDER
    ========================= */

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <Link href={route('areas.show', areaId)} className="text-sm font-semibold text-[#a81c24] hover:underline">
                        ← Volver a {areaName}
                    </Link>
                    <h1 className="mt-1 text-xl font-bold text-gray-900">Programación de {areaName}</h1>
                </div>
            </div>

            <AreaScheduleGrid
                areaId={areaId}
                rightSlot={
                    <button
                        onClick={() => setManagingCalendars(true)}
                        title="Cambios que afectan a todos los empleados del área"
                        className="flex items-center gap-1 rounded-md border border-[#a81c24] px-3 py-2 text-sm font-semibold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                    >
                        <CalendarCog className="h-4 w-4" /> Turnos del área (todos)
                    </button>
                }
            />

            {managingCalendars && (
                <ManageCalendarsModal areaId={areaId} calendars={calendars} onClose={() => setManagingCalendars(false)} onChanged={fetchCalendars} />
            )}
        </div>
    );
}

DetailsProgramations.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
