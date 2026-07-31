// resources/js/Pages/Inicio.tsx
import MainLayout from '@/Layouts/MainLayout';
import { usePage } from '@inertiajs/react';
import React from 'react';
import VistaProgramations from './Programations/VistaProgramations';


const programaciones = () => {

    return (
        <div>
            <VistaProgramations />
        </div>
    );
};

programaciones.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default programaciones;
