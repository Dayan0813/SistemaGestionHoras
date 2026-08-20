// resources/js/Pages/Inicio.tsx
import MainLayout from '@/Layouts/MainLayout';
import React from 'react';
import MarkingsRecords from './Markings/MarkingsRecords';

interface CurrentProps {
    currentRouteName: string;
}

interface Device {
    id: number;
    name: string;
}

interface Props {
    currentRouteName: string;
    devices: Device[];
}

const MarkingsLogs = ({ currentRouteName, devices }: Props) => {
    return (
        <>
            <div className="m-8">
                <MarkingsRecords devices={devices} />
            </div>
        </>
    );
};

MarkingsLogs.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default MarkingsLogs;
