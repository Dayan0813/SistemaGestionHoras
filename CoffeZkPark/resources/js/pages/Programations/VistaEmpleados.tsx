// VistaEmpleados.tsx (VERSION MODIFICADA)
import { CheckCircle, Settings } from 'lucide-react';
import React from 'react';

interface Employee {
    uid: number;
    name: string;
    cargo: string;
    area_id: number;
    tipo_contrato: string;
}

interface ProgramationData {
    // ...
    group_code: string;
}

interface VistaEmpleadosProps {
    employees: Employee[];
    selectedEmployee: number[];
    setSelectedEmployee: React.Dispatch<React.SetStateAction<number[]>>;
    customProgramations: Record<number, ProgramationData>;
    onOpenCustom: (empId: number) => void;

    groupCode: string | null;
}

export default function VistaEmpleados({
    employees,
    selectedEmployee,
    setSelectedEmployee,
    customProgramations,
    onOpenCustom,
    groupCode,
}: VistaEmpleadosProps) {
    if (employees.length === 0) {
        return <p className="mt-5 mb-5 text-center text-gray-500">Selecciona un área para ver los empleados.</p>;
    }

    // Toggle selección de empleados
    const toggleSelection = (id: number) => {
        setSelectedEmployee((prev) => (prev.includes(id) ? prev.filter((empId) => empId !== id) : [...prev, id]));
    };

    return (
        <div className="mt-6 max-h-78 space-y-2 overflow-y-auto">
            {/* ... Mapeo de empleados ... (sin cambios) */}
            {employees.map((emp) => {
                const isSelected = selectedEmployee.includes(emp.uid);
                const hasCustom = !!customProgramations[emp.uid];

                return (
                    <div
                        key={emp.uid}
                        onClick={() => toggleSelection(emp.uid)}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition ${
                            isSelected ? 'border-[#95c020] bg-[#f0f9ce]' : 'hover:bg-gray-50'
                        }`}
                    >
                        {/* Izquierda: información */}
                        <div>
                            {/* ... Contenido Izquierda ... */}
                            <div className="flex items-center">
                                <h3 className={`text-base font-medium ${isSelected ? 'text-[#95c020]' : 'text-gray-700'}`}>{emp.name}</h3>
                                <p className="text-sm text-gray-500">
                                    <span className="ml-4 rounded border px-1.5 py-[1px] font-medium capitalize">{emp.tipo_contrato}</span>
                                </p>
                            </div>
                            <p className="text-sm text-gray-500">ID: {emp.uid}</p>
                        </div>

                        {/* Derecha: acciones */}
                        <div className="flex items-center gap-2">
                            {/* Botón de ajuste individual */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenCustom(emp.uid);
                                }}
                                title="Ajustar programación individual"
                                className="rounded-md border border-[#a81c24] p-1 text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
                            >
                                <Settings className="h-4 w-4" />
                            </button>

                            {/* Indicador si tiene override */}
                            {hasCustom && (
                                <span className="flex items-center text-xs font-semibold text-green-600" title="Programación individual aplicada">
                                    ✔ Ajuste
                                </span>
                            )}

                            {/* Icono de selección */}
                            {isSelected && <CheckCircle className="h-6 w-6 flex-shrink-0 text-[#95c020]" />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
