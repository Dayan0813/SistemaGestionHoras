import { Link } from "@inertiajs/react";

/* =========================
   TIPOS LOCALES
========================= */

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
    areas: Area[];
}

/* =========================
   COMPONENTE
========================= */

export default function Index({ areas }: Props) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 m-12">
            {areas.map((area) => (
                <Link
                    key={area.id}
                    href={route("areas.show", area.id)}
                    className="bg-white rounded-xl shadow hover:shadow-md border border-[#a81c24] transition p-6"
                >
                    <h3 className="text-lg font-bold">
                        {area.nombre}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                        {area.descripcion || "Sin descripción"}
                    </p>

                    <div className="grid grid-cols-3 text-center mt-6">
                        <div>
                            <p className="text-xl font-bold">
                                {area.total}
                            </p>
                            <span className="text-xs text-gray-500">
                                Total
                            </span>
                        </div>

                        <div className="text-green-600">
                            <p className="text-xl font-bold">
                                {area.activos}
                            </p>
                            <span className="text-xs">
                                Activos
                            </span>
                        </div>

                        <div className="text-red-600">
                            <p className="text-xl font-bold">
                                {area.inactivos}
                            </p>
                            <span className="text-xs">
                                Inactivos
                            </span>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
