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

interface Props {
    currentRouteName: string;
    areas?: Area[];
}

const Areas = ({ currentRouteName, areas }: Props) => {
    const safeAreas: Area[] = Array.isArray(areas) ? areas : [];
    return (
        <div>
            <Index areas={safeAreas} />
        </div>
    );
};

Areas.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default Areas;
