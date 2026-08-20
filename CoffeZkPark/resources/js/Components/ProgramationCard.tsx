import { Link } from '@inertiajs/react';
<<<<<<< HEAD
import { CalendarCog, ChevronRight, UsersRound } from 'lucide-react';
=======
import { ChevronRight, UsersRound } from 'lucide-react';
>>>>>>> origin/feature/hernandez

interface AreaData {
    area_id: number;
    area_name: string;
    employees_count: number;
    statues?: string;
}

interface AreaDataProps {
    areas: AreaData;
<<<<<<< HEAD
    onManageTurnos: (areaId: number) => void;
}

export const ProgramationCard = ({ areas, onManageTurnos }: AreaDataProps) => {
    return (
        <div className="rounded-lg bg-white p-6 shadow-lg transition-shadow hover:shadow-xl">
            {/*Link de redireccionamiento a detalle de la vista*/}
            <Link href={`/programations/areas/${areas.area_id}`}>
                <div className="flex w-full">
                    <h2 className="mb-3 text-lg font-bold text-gray-800">{areas.area_name}</h2>
                    <ChevronRight className="ml-auto w-5" />
                </div>
                <div className="flex gap-2">
                    <UsersRound className="w-4" />
                    <p className="text-md flex w-full text-gray-600">
                        Empleados: <span className="text-md ml-auto font-semibold">{areas.employees_count}</span>
                    </p>
                </div>
                {areas.statues && <p className="mt-2 text-sm text-gray-500">Estados: {areas.statues}</p>}
            </Link>

            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onManageTurnos(areas.area_id);
                }}
                title="Cambios que afectan a todos los empleados del área"
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-md border border-[#a81c24] px-3 py-1.5 text-sm font-semibold text-[#a81c24] hover:bg-[#a81c24] hover:text-white"
            >
                <CalendarCog className="h-4 w-4" /> Turnos del área (todos)
            </button>
        </div>
=======
}

export const ProgramationCard = ({ areas }: AreaDataProps) => {
    return (
        <>
            {/*Link de redireccionamiento a detalle de la vista*/}
            <Link href={`/programations/areas/${areas.area_id}`}>
                <div className="rounded-lg bg-white p-6 shadow-lg transition-shadow hover:shadow-xl">
                    <div className="flex w-full">
                        <h2 className="mb-3 text-lg font-bold text-gray-800">{areas.area_name}</h2>
                        <ChevronRight className="ml-auto w-5" />
                    </div>
                    <div className="flex gap-2">
                        <UsersRound className="w-4" />
                        <p className="text-md flex w-full text-gray-600">
                            Empleados: <span className="text-md ml-auto font-semibold">{areas.employees_count}</span>
                        </p>
                    </div>
                    {areas.statues && <p className="mt-2 text-sm text-gray-500">Estados: {areas.statues}</p>}
                </div>
            </Link>
        </>
>>>>>>> origin/feature/hernandez
    );
};
