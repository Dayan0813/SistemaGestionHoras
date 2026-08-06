import { Link } from '@inertiajs/react';
import { ChevronRight, UsersRound } from 'lucide-react';

interface AreaData {
    area_id: number;
    area_name: string;
    employees_count: number;
    statues?: string;
}

interface AreaDataProps {
    areas: AreaData;
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
    );
};
