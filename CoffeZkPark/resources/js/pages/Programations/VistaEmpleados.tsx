import { CheckCircle } from 'lucide-react';
import React from 'react';

interface Employee {
    uid: number;
    name: string;
    cargo: string;
    area_id: number;
    tipo_contrato: string;
}

interface VistaEmpleadosProps {
    employees: Employee[];
    selectedEmployee: number[];
    setSelectedEmployee: React.Dispatch<React.SetStateAction<number[]>>;
}

export default function VistaEmpleados({ employees, selectedEmployee, setSelectedEmployee }: VistaEmpleadosProps) {
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
                            {/* Icono de selección */}
                            {isSelected && <CheckCircle className="h-6 w-6 flex-shrink-0 text-[#95c020]" />}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
