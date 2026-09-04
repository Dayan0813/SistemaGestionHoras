import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useState } from 'react';
import CatalogSelectWithAdd from './CatalogSelectWithAdd';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    areas: Array<{ id: number; nombre: string }>;
    contrato: Record<number, string>;
    cargo: Record<number, string>;
}

const emptyForm = {
    name: '',
    userid: '',
    cardno: '',
    estado: 'Activo',
    area_id: '',
    cargo_id: '',
    contrato_id: '',
};

export default function CreateEmployeeModal({ isOpen, onClose, areas, cargo, contrato }: Props) {
    const [formData, setFormData] = useState(emptyForm);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleClose = () => {
        setFormData(emptyForm);
        setErrors({});
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(route('empleados.store'), formData, {
            preserveState: true,
            onSuccess: () => {
                setFormData(emptyForm);
                onClose();
            },
            onError: (errs) => setErrors(errs as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h2 className="text-xl font-bold text-gray-800">Nuevo empleado</h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-800">
                        <X />
                    </button>
                </div>

                <p className="mb-4 rounded bg-blue-50 p-3 text-xs text-blue-700">
                    El identificador interno (UID) se genera automáticamente. Si esta persona va a marcar huella más adelante, escribe en
                    "UserID" el número que le vas a asignar en el dispositivo — así, cuando se enrole, la sincronización reconoce a este mismo
                    empleado en vez de crear uno duplicado.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nombre</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                                autoFocus
                                required
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium">
                                UserID <span className="font-normal text-gray-400">(del huellero, opcional)</span>
                            </label>
                            <input
                                type="text"
                                name="userid"
                                value={formData.userid}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                            {errors.userid && <p className="mt-1 text-xs text-red-600">{errors.userid}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Card No</label>
                            <input
                                type="text"
                                name="cardno"
                                value={formData.cardno}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Estado</label>
                            <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                                required
                            >
                                <option value="Activo">Activo</option>
                                <option value="Inactivo">Inactivo</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium">Área</label>
                            <select
                                name="area_id"
                                value={formData.area_id}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            >
                                <option value="">Seleccione un área</option>
                                {areas.map((area) => (
                                    <option key={area.id} value={area.id}>
                                        {area.nombre}
                                    </option>
                                ))}
                            </select>
                            {errors.area_id && <p className="mt-1 text-xs text-red-600">{errors.area_id}</p>}
                        </div>

                        <CatalogSelectWithAdd
                            label="Cargo"
                            value={formData.cargo_id}
                            onChange={(id) => setFormData({ ...formData, cargo_id: id })}
                            options={cargo}
                            placeholder="Seleccione un cargo"
                            storeRouteName="cargos.store"
                            reloadProp="cargo"
                        />

                        <CatalogSelectWithAdd
                            label="Tipo de contrato"
                            value={formData.contrato_id}
                            onChange={(id) => setFormData({ ...formData, contrato_id: id })}
                            options={contrato}
                            placeholder="Seleccione contrato"
                            storeRouteName="contratos.store"
                            reloadProp="contrato"
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button type="button" onClick={handleClose} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded border border-[#95c020] bg-[#95c020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7da81a] disabled:opacity-50"
                        >
                            {processing ? 'Creando…' : 'Crear empleado'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
