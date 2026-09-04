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

interface Props {
    currentRouteName: string;
    areas?: Area[];
    eligibleEmployees?: EligibleEmployee[];
}

const Areas = ({ currentRouteName, areas, eligibleEmployees }: Props) => {
    const safeAreas: Area[] = Array.isArray(areas) ? areas : [];
    const safeEligibleEmployees: EligibleEmployee[] = Array.isArray(eligibleEmployees) ? eligibleEmployees : [];
    return (
        <div>
            <Index areas={safeAreas} eligibleEmployees={safeEligibleEmployees} />
        </div>
    );
};

Areas.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default Areas;
