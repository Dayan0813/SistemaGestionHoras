import CoffeLoader from '@/Components/Loaders/CoffeLoader';
import MainLayout from '@/Layouts/MainLayout';
import { PageProps as InertiaPageProps } from '@inertiajs/core';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import IndividualPModal from './IndividualPModal';
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
    nextGroupNumber: number;
}

/* =======================
   COMPONENTE
======================= */

export default function Index() {
    const { areas, calendars, contracts = [], nextGroupNumber } = usePage<PageProps>().props;

    /* =======================
       ESTADOS
    ======================= */

    const [groupCode, setGroupCode] = useState<string | null>(null);

    const [selectedArea, setSelectedArea] = useState('');
    const [selectedContract, setSelectedContract] = useState<number | ''>('');
    const [selectedMonth, setSelectedMonth] = useState('');

    const [loader, setLoader] = useState(false);

    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<number[]>([]);

    const [customProgramations, setCustomProgramations] = useState<Record<number, ProgramationData>>({});

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
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [selectedEmployeeForCustom, setSelectedEmployeeForCustom] = useState<number | null>(null);

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
       AGRUPAR
    ======================= */

    const createGroup = () => {
        if (selectedEmployee.length === 0) {
            alert('Selecciona al menos un empleado');
            return;
        }

        if (groupCode) return;

        const code = `ParCafe${String(nextGroupNumber).padStart(2, '0')}`;
        setGroupCode(code);
    };

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
                group_code: groupCode,
                custom_programations: JSON.stringify(customProgramations),
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
                    setGroupCode(null);
                    setSelectedArea('');
                    setSelectedContract('');
                    setSelectedMonth('');
                    setFilteredEmployees([]);
                    setSelectedEmployee([]);
                    setCustomProgramations({});
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
                    <VistaEmpleados
                        employees={filteredEmployees}
                        selectedEmployee={selectedEmployee}
                        setSelectedEmployee={setSelectedEmployee}
                        customProgramations={customProgramations}
                        onOpenCustom={(id) => {
                            setSelectedEmployeeForCustom(id);
                            setShowCustomModal(true);
                        }}
                        groupCode={groupCode}
                    />
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
                            }) =>
                                setProgramationData((prev) => ({
                                    ...prev,
                                    ...data,
                                })),
                        } as unknown as any)}
                    />
                )}

                {/* Botones */}
                <div className="mt-6 flex justify-end space-x-5">
                    <button onClick={createGroup} className="rounded border border-[#a81c24] px-4 py-2 font-semibold text-[#a81c24]">
                        Agrupar Selección
                    </button>

                    <button onClick={handleSubmit} className="flex items-center rounded border border-[#95c020] px-3 py-1 font-bold text-[#95c020]">
                        <Save className="mr-2" /> Guardar y Ver Calendario
                    </button>
                </div>

                {/* Modal */}
                {showCustomModal && selectedEmployeeForCustom !== null && (
                    <IndividualPModal
                        employeeId={selectedEmployeeForCustom}
                        calendars={calendars}
                        areaId={selectedArea ? Number(selectedArea) : null}
                        defaultData={
                            customProgramations[selectedEmployeeForCustom] || {
                                ...programationData,
                                calendar_id: '',
                                work_position_id: '',
                                start_date: '',
                                end_date: '',
                                work_days: [],
                                excluded_dates: [],
                                month: selectedMonth,
                                group_code: '',
                            }
                        }
                        onClose={() => {
                            setShowCustomModal(false);
                            setSelectedEmployeeForCustom(null);
                        }}
                        onSave={(empId, data) => {
                            setCustomProgramations((prev) => ({
                                ...prev,
                                [empId]: data,
                            }));
                        }}
                        workPositions={[]}
                    />
                )}
            </div>
        </>
    );
}

Index.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
