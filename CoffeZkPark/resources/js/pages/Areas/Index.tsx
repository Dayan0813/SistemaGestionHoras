import { Link, usePage } from "@inertiajs/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import CreateAreaModal from "./CreateAreaModal";

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
    const [showCreate, setShowCreate] = useState(false);
    const { flash } = usePage().props as unknown as { flash?: { success?: string } };

    return (
        <div className="m-12">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Áreas</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center rounded-lg border border-[#95c020] px-4 py-2 font-bold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                >
                    <Plus className="mr-2" size={18} /> Nueva Área
                </button>
            </div>

            {flash?.success && <div className="mb-6 rounded bg-green-100 p-3 text-green-700">{flash.success}</div>}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

            <CreateAreaModal show={showCreate} onClose={() => setShowCreate(false)} />
        </div>
    );
}
