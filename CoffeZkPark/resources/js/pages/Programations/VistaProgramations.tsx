import { EmptyProgramations } from '@/Components/EmptyProgramations';
import CoffeLoader from '@/Components/Loaders/CoffeLoader';
import { ProgramationCard } from '@/Components/ProgramationCard';
import axios from 'axios';
import { useEffect, useState } from 'react';
import ManageCalendarsModal from './ManageCalendarsModal';

interface AreaData {
    area_id: number;
    area_name: string;
    employees_count: number;
    statues: string;
}

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string | null;
    hora_salida: string | null;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

export default function VistaProgramations() {
    const [areas, setAreas] = useState<AreaData[]>([]);
    const [loading, setLoading] = useState(true);

    const [managingAreaId, setManagingAreaId] = useState<number | null>(null);
    const [managingCalendars, setManagingCalendars] = useState<Calendar[]>([]);

    const openTurnos = (areaId: number) => {
        setManagingAreaId(areaId);
        axios.get(`/calendars/area/${areaId}`).then((res) => setManagingCalendars(res.data));
    };

    const refreshTurnos = () => {
        if (managingAreaId) {
            axios.get(`/calendars/area/${managingAreaId}`).then((res) => setManagingCalendars(res.data));
        }
    };

    // Puedes hacer estos valores dinámicos con un selector de mes/año más adelante
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    useEffect(() => {
        const fetchProgramations = async () => {
            try {
                const response = await axios.get('/programations/getCard', {
                    params: { year, month },
                });
                setAreas(response.data);
            } catch (err) {
                console.error('Error fetching programations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProgramations();
    }, [year, month]); // Puedes agregar más dependencias si cambias año/mes dinámicamente

    if (loading) {
        return (
            <div className='m-8 py-2'>
                <CoffeLoader />
            </div>
        )
    }

    return (
        <div className=" m-8 justify-center py-2">
            {areas.length === 0 ? (
                <EmptyProgramations />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                    {areas.map((area) => (
                        <ProgramationCard key={area.area_id} areas={area} onManageTurnos={openTurnos} />
                    ))}
                </div>
            )}

            {managingAreaId && (
                <ManageCalendarsModal
                    areaId={managingAreaId}
                    calendars={managingCalendars}
                    onClose={() => setManagingAreaId(null)}
                    onChanged={refreshTurnos}
                />
            )}
        </div>
    );
}
