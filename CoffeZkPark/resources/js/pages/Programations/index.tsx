import CoffeLoader from '@/Components/Loaders/CoffeLoader';
import MainLayout from '@/Layouts/MainLayout';
import { PageProps as InertiaPageProps } from '@inertiajs/core';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import VistaEmpleados from './VistaEmpleados';
import TimesProgramations from './timesProgramations';

dayjs.locale('es');

/* =======================
   TIPOS UNIFICADOS
======================= */

interface Employee {
    uid: number;
    name: string;
    area_id: number;
    cargo: string; // ✅ obligatorio
    tipo_contrato: string; // ✅ obligatorio
}

interface Contract {
    id: number;
    name: string;
}

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string;
    hora_salida: string;
    shift_type: 'D' | 'N';
    is_custom: boolean;
    created_for_employee_uid: string | null;
}

interface ProgramationData {
    calendar_id: number | '';
    work_position_id: number | '';
    start_date: string;
    end_date: string;
    work_days: string[];
    excluded_dates: string[];
    month: string;
    group_code: string;
}

interface PageProps extends InertiaPageProps {
    areas: Record<string, string>;
    calendars: Calendar[];
    contracts: Contract[];
}

/* =======================
   COMPONENTE
======================= */

export default function Index() {
    const { areas, calendars, contracts = [] } = usePage<PageProps>().props;

    /* =======================
       ESTADOS
    ======================= */

    const [selectedArea, setSelectedArea] = useState('');
    const [selectedContract, setSelectedContract] = useState<number | ''>('');
    const [selectedMonth, setSelectedMonth] = useState('');

    const [loader, setLoader] = useState(false);

    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<number[]>([]);

    const [dayOverrides, setDayOverrides] = useState<Record<string, number>>({});

    const [programationData, setProgramationData] = useState<ProgramationData>({
        calendar_id: '',
        work_position_id: '',
        start_date: '',
        end_date: '',
        work_days: [],
        excluded_dates: [],
        month: '',
        group_code: '',
    });

    /* =======================
       🔹 CARGA DE EMPLEADOS (BACKEND)
    ======================= */

    useEffect(() => {
        if (!selectedArea) {
            setFilteredEmployees([]);
            setSelectedEmployee([]);
            return;
        }

        axios
            .get('/programations/employees', {
                params: {
                    area_id: Number(selectedArea),
                    contrato_id: selectedContract || null,
                },
            })
            .then((res) => {
                // 🔹 NORMALIZACIÓN (AQUÍ SE SOLUCIONA EL ERROR TS)
                const normalized: Employee[] = res.data.map((e: any) => ({
                    uid: e.uid,
                    name: e.name,
                    area_id: e.area_id,
                    cargo: e.cargo?.name ?? e.cargo ?? 'Sin cargo',
                    tipo_contrato: e.contrato?.name ?? e.tipo_contrato ?? 'Sin contrato',
                }));

                setFilteredEmployees(normalized);
                setSelectedEmployee([]);
            })
            .catch((err) => {
                console.error('Error cargando empleados:', err);
                setFilteredEmployees([]);
            });
    }, [selectedArea, selectedContract]);

    /* =======================
       ENVIAR
    ======================= */

    const handleSubmit = () => {
        setLoader(true);

        const startTime = Date.now();
        router.post(
            '/programations',
            {
                area_id: Number(selectedArea),
                calendar_id: Number(programationData.calendar_id),
                work_position_id: programationData.work_position_id,
                start_date: programationData.start_date,
                end_date: programationData.end_date,
                employees: selectedEmployee,
                day_overrides: JSON.stringify(dayOverrides),
            },
            {
                onFinish: () => {
                    const elapsed = Date.now() - startTime;
                    const remaining = Math.max(3000 - elapsed, 0);

                    setTimeout(() => {
                        setLoader(false);
                    }, remaining);
                },
                onSuccess: () => {
                    // 🔹 RESET TOTAL
                    setSelectedArea('');
                    setSelectedContract('');
                    setSelectedMonth('');
                    setFilteredEmployees([]);
                    setSelectedEmployee([]);
                    setDayOverrides({});
                    setProgramationData({
                        calendar_id: '',
                        work_position_id: '',
                        start_date: '',
                        end_date: '',
                        work_days: [],
                        excluded_dates: [],
                        month: '',
                        group_code: '',
                    });
                },
            },
        );
    };

    const selectedEmployeesData = filteredEmployees.filter((emp) => selectedEmployee.includes(emp.uid));

    /* =======================
       RENDER
    ======================= */

    return (
        <>
            {loader && <CoffeLoader />}
            <div className="mx-auto mt-5 mb-6 w-[95%] rounded-xl border border-[#a81c24] p-6 shadow-lg">
                <header className="m-2">
                    <h1 className="text-lg font-bold">Crear Nueva Programación Mensual</h1>

                    <div className="mt-5 flex w-full items-center justify-evenly gap-4">
                        {/* Área */}
                        <div className="w-[50%]">
                            <h4 className="mb-1.5 font-bold">Área del parque</h4>
                            <select
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="w-full rounded-md border border-[#a81c24] px-4 py-2"
                            >
                                <option value="">Selecciona un área</option>
                                {Object.entries(areas).map(([id, nombre]) => (
                                    <option key={id} value={id}>
                                        {nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Contrato */}
                        <div className="w-[50%]">
                            <h4 className="mb-1.5 font-bold">Contrato</h4>
                            <select
                                value={selectedContract}
                                onChange={(e) => setSelectedContract(Number(e.target.value) || '')}
                                className="w-full rounded-md border border-[#a81c24] px-4 py-2"
                            >
                                <option value="">Todos los contratos</option>
                                {contracts.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </header>

                {/* Empleados */}

                <div className="mx-auto mt-5 w-full rounded-lg border border-[#a81c24] p-6">
                    <VistaEmpleados employees={filteredEmployees} selectedEmployee={selectedEmployee} setSelectedEmployee={setSelectedEmployee} />
                </div>

                {/* Configuración */}
                {selectedEmployeesData.length > 0 && selectedArea && (
                    <TimesProgramations
                        {...({
                            calendars,
                            areaId: Number(selectedArea),
                            employeeIds: selectedEmployee,
                            selectedMonth,
                            onChange: (data: {
                                calendar_id: number | '';
                                work_position_id: number | '';
                                start_date: string;
                                end_date: string;
                                work_days: string[];
                                excluded_dates: string[];
                                day_overrides: Record<string, number>;
                            }) => {
                                const { day_overrides, ...rest } = data;
                                setProgramationData((prev) => ({ ...prev, ...rest }));
                                setDayOverrides(day_overrides);
                            },
                        } as unknown as any)}
                    />
                )}

                {/* Botones */}
                <div className="mt-6 flex justify-end space-x-5">
                    <button onClick={handleSubmit} className="flex items-center rounded border border-[#95c020] px-3 py-1 font-bold text-[#95c020]">
                        <Save className="mr-2" /> Guardar 
                    </button>
                </div>
            </div>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
