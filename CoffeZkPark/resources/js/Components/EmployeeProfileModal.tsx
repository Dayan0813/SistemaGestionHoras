import axios from 'axios';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Profile {
    uid: string;
    name: string;
    estado: string;
    cardno: string | null;
    documentos: string | null;
    dispositivo: string | null;
    horario: string | null;
    empresa: string | null;
    dependencia: string | null;
    centrocosto: string | null;
    area: string | null;
    cargo: string | null;
    contrato: string | null;
}

interface Props {
    // uid del empleado a mostrar; null cierra el modal (mismo patrón que EmployeeHoursModal).
    uid: string | null;
    onClose: () => void;
}

// Ficha de solo lectura de un empleado — se abre al hacer clic en su nombre desde las
// vistas de programación (Consulta por área, Vista previa). Reutiliza el mismo look de
// modal que el resto de la app (fondo oscuro + tarjeta blanca centrada).
export default function EmployeeProfileModal({ uid, onClose }: Props) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!uid) return;
        setProfile(null);
        setError(null);
        setLoading(true);
        axios
            .get(route('empleados.perfil', uid))
            .then((res) => setProfile(res.data))
            .catch(() => setError('No se pudo cargar el perfil de este empleado.'))
            .finally(() => setLoading(false));
    }, [uid]);

    if (!uid) return null;

    const fields: [string, string | null | undefined][] = profile
        ? [
              ['Cargo', profile.cargo],
              ['Contrato', profile.contrato],
              ['Área', profile.area],
              ['Empresa', profile.empresa],
              ['Documento', profile.cardno],
              ['Dependencia', profile.dependencia],
              ['Centro de costo', profile.centrocosto],
              ['Dispositivo', profile.dispositivo],
              ['Horario', profile.horario],
          ]
        : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-7 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <button type="button" onClick={onClose} title="Cerrar" className="absolute top-5 right-5 text-gray-400 hover:text-gray-600">
                    <X size={18} />
                </button>

                <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">Perfil del empleado</p>

                {loading && <p className="mt-6 text-sm text-gray-500">Cargando…</p>}
                {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

                {profile && (
                    <>
                        <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#95c020]/20 text-sm font-bold text-[#5e7a15]">
                                {profile.name
                                    .split(' ')
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((w) => w[0])
                                    .join('')
                                    .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-semibold text-gray-900">{profile.name}</h2>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <span className="font-mono text-xs text-gray-400">{profile.uid}</span>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                            profile.estado === 'Activo' ? 'bg-[#eaf3d3] text-[#5e7a15]' : 'bg-gray-100 text-gray-500'
                                        }`}
                                    >
                                        {profile.estado}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
                            {fields.map(([label, value]) => (
                                <div key={label}>
                                    <dt className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{label}</dt>
                                    <dd className="truncate text-sm text-gray-800">{value || '—'}</dd>
                                </div>
                            ))}
                        </dl>
                    </>
                )}
            </div>
        </div>
    );
}
