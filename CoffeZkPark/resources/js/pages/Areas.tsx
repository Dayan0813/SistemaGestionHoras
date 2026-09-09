// resources/js/Pages/Inicio.tsx
import MainLayout from '@/Layouts/MainLayout';
import React from 'react';
import Index from './Areas/Index';

interface CurrentProps {
    currentRouteName: string;
}

interface Area {
    id: number;
    nombre: string;
    descripcion: string | null;
    centro_costo: string;
    total: number;
    activos: number;
    inactivos: number;
}

interface EligibleEmployee {
    uid: string;
    name: string;
}

interface HighSeasonRange {
    start: string;
    end: string;
}

interface Props {
    currentRouteName: string;
    areas?: Area[];
    eligibleEmployees?: EligibleEmployee[];
    highSeasonRanges?: HighSeasonRange[];
    vacationReminderMonths?: number;
}

const Areas = ({ currentRouteName, areas, eligibleEmployees, highSeasonRanges, vacationReminderMonths }: Props) => {
    const safeAreas: Area[] = Array.isArray(areas) ? areas : [];
    const safeEligibleEmployees: EligibleEmployee[] = Array.isArray(eligibleEmployees) ? eligibleEmployees : [];
    const safeHighSeasonRanges: HighSeasonRange[] = Array.isArray(highSeasonRanges) ? highSeasonRanges : [];
    const safeVacationReminderMonths: number = typeof vacationReminderMonths === 'number' ? vacationReminderMonths : 3;
    return (
        <div>
            <Index
                areas={safeAreas}
                eligibleEmployees={safeEligibleEmployees}
                highSeasonRanges={safeHighSeasonRanges}
                vacationReminderMonths={safeVacationReminderMonths}
            />
        </div>
    );
};

Areas.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default Areas;
