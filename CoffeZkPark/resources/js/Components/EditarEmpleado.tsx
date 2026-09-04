import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import CatalogSelectWithAdd from './CatalogSelectWithAdd';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: any;
    areas: Array<{
        id: number;
        nombre: string;
        centro_costo: string;
    }>;
    contrato: Record<number, string>;
    cargo: Record<number, string>;
}

const EditEmployeeModal = ({ isOpen, onClose, employee, areas, cargo, contrato }: EditEmployeeModalProps) => {
    const [formData, setFormData] = useState<any>({});

    //Efecto

    //Efecto que bloquea scroll del fondo

    useEffect(() => {
        if (isOpen) {
            //Bloquea scroll
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'auto';
            };
        }
    }, [isOpen]);

    //Cerrar modal com X

    const modalRef = React.useRef<HTMLDivElement>(null);

    // Cuando cambie el empleado, carga sus datos
    useEffect(() => {
        if (employee) {
            let resolvedAreaId = employee.area_id || '';

            if (!resolvedAreaId && employee.centrocosto) {
                const match = areas.find((a) => String(a.centro_costo) === String(employee.centrocosto));
                if (match) resolvedAreaId = match.id;
            }

            setFormData({
                uid: employee.uid ?? '',
                userid: employee.userid ?? '',
                name: employee.name ?? '',
                cardno: employee.cardno ?? '',
                estado: employee.estado ?? '',
                documentos: employee.documentos ?? '',
                dispositivo: employee.dispositivo ?? '',
                horario: employee.horario ?? '',
                empresa: employee.empresa ?? '',
                dependencia: employee.dependencia ?? '',
                centrocosto: employee.centrocosto ?? '',
                area_id: resolvedAreaId,
                cargo_id: employee.cargo_id ?? '',
                contrato_id: employee.contrato_id ?? '',
            });
        }
    }, [employee, areas]);

    // 🔑 AUTO-SINCRONIZAR EMPRESA DESDE CONTRATO
    useEffect(() => {
        if (formData.contrato_id) {
            // empresa = ID del contrato (como definiste en backend)
            setFormData((prev: any) => ({
                ...prev,
                empresa: String(formData.contrato_id),
            }));
        }
    }, [formData.contrato_id]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.put(route('empleados.update', employee.id), formData, {
            preserveState: false,
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div ref={modalRef} className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white p-4 shadow-lg">
                <header className="z-10 mb-4 flex items-center justify-between bg-white px-6 py-2">
                    <h2 className="text-xl font-bold text-gray-800">Editar Empleado</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="w-full">
                    {/* UID */}
                    <section className="grid max-h-[50vh] w-full max-w-6xl grid-cols-2 gap-4 overflow-y-scroll">
                        <div>
                            <label className="block text-sm font-medium">UID</label>
                            <input
                                type="text"
                                name="uid"
                                value={formData.uid}
                                readOnly
                                title="El UID no se puede editar: identifica al empleado en programaciones, marcaciones y su cuenta de acceso."
                                className="w-full rounded border bg-gray-100 px-3 py-2 text-gray-500"
                            />
                        </div>

                        {/* UserID */}
                        <div>
                            <label className="block text-sm font-medium">UserID</label>
                            <input
                                type="text"
                                name="userid"
                                value={formData.userid}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium">Nombre</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                                required
                            />
                        </div>

                        {/* Card No */}
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

                        {/* Estado */}
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

                        {/* Documentos */}
                        <div>
                            <label className="block text-sm font-medium">Documentos</label>
                            <input
                                type="text"
                                name="documentos"
                                value={formData.documentos}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Dispositivo */}
                        <div>
                            <label className="block text-sm font-medium">Dispositivo</label>
                            <input
                                type="text"
                                name="dispositivo"
                                value={formData.dispositivo}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Horario */}
                        <div>
                            <label className="block text-sm font-medium">Horario</label>
                            <input
                                type="text"
                                name="horario"
                                value={formData.horario}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Empresa */}
                        <div>
                            <label className="block text-sm font-medium">Empresa</label>
                            <input
                                type="text"
                                name="empresa"
                                value={formData.empresa}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Cargo */}
                        <CatalogSelectWithAdd
                            label="Cargo"
                            value={formData.cargo_id}
                            onChange={(id) => setFormData({ ...formData, cargo_id: id })}
                            options={cargo}
                            placeholder="Seleccione un cargo"
                            storeRouteName="cargos.store"
                            reloadProp="cargo"
                        />

                        {/* Dependencia */}
                        <div>
                            <label className="block text-sm font-medium">Dependencia</label>
                            <input
                                type="text"
                                name="dependencia"
                                value={formData.dependencia}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Centro de costo */}
                        <div>
                            <label className="block text-sm font-medium">Centro de costo</label>
                            <input
                                type="text"
                                name="centrocosto"
                                value={formData.centrocosto}
                                onChange={handleChange}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            />
                        </div>

                        {/* Área */}
                        <div>
                            <label className="block text-sm font-medium">Área</label>
                            <select
                                name="area_id"
                                value={formData.area_id}
                                onChange={handleChange}
                                disabled={!!formData.centrocosto}
                                className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-[#a81c24]"
                            >
                                <option value="">Seleccione un área</option>
                                {areas.map((area: any) => (
                                    <option key={area.id} value={area.id}>
                                        {area.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tipo de contrato */}
                        <CatalogSelectWithAdd
                            label="Tipo de Contrato"
                            value={formData.contrato_id}
                            onChange={(id) => setFormData({ ...formData, contrato_id: id })}
                            options={contrato}
                            placeholder="Seleccione contrato"
                            storeRouteName="contratos.store"
                            reloadProp="contrato"
                        />
                    </section>

                    {/* Botones */}
                    <div className="z-10 col-span-2 mt-6 flex justify-end gap-3 bg-white px-6 py-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded bg-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-400"
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="rounded bg-[#a81c24] px-4 py-2 font-semibold text-white hover:bg-[#8a171e]">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditEmployeeModal;
