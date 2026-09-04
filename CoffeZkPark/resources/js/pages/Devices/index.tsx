import ConfirmModal from '@/Components/confirmModal';
import EditDeviceModal from '@/Components/EditModal';
import MainLayout from '@/Layouts/MainLayout';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Plus, Trash2, RefreshCcw } from 'lucide-react';
import React from 'react';

interface Device {
    id: number;
    name: string;
    ip: string;
    port: number;
    state: boolean;
}

export default function DevicesIndex() {
    const { devices, flash } = usePage().props as unknown as { devices: Device[]; flash?: any };

    const [showModal, setShowModal] = React.useState(false);
    const [deleteId, setDeleteId] = React.useState<number | null>(null);

    const [showEditModal, setShowEditModal] = React.useState(false);
    const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);

    const handleDelete = (id: number) => {
        setDeleteId(id);
        setShowModal(true);
    };  

    const handleEditClick = (device: Device) => {
        setSelectedDevice(device);
        setShowEditModal(true);
    };
    

    const confirmDelete = React.useCallback(() => {
        if (deleteId !== null) {
            router.delete(route('devices.destroy', deleteId));
            setShowModal(false);
            setDeleteId(null);
        }
    }, [deleteId]);

    return (
        <div className="p-6">
            <h1 className="mb-8 flex items-center justify-center text-2xl font-bold">Dispositivos ZKTeco</h1>
            <div className="m-3 mb-8 flex items-center justify-between">
                <Link
                    href={route('servicios')}
                    className="flex items-center gap-2 rounded-lg border border-[#a81c24] px-4 py-2 font-bold text-[#a81c24] transition hover:bg-[#a81c24] hover:font-bold hover:text-white"
                >
                    <ArrowLeft size={18} />
                    Volver a Servicios
                </Link>
                <Link
                    href={route('devices.create')}
                    className="flex items-center rounded-lg border border-[#95c020] px-4 py-2 font-bold text-[#95c020] hover:bg-[#95c020] hover:font-bold hover:text-white"
                >
                    <Plus className="mr-2" size={18} /> Agregar
                </Link>
            </div>

            {flash?.success && <div className="mb-4 rounded bg-green-100 p-3 text-green-700">{flash.success}</div>}

            <div className="m-2 rounded-lg border border-[#95c020] bg-white">
                <div className="max-h-96 w-full overflow-y-auto">
                    <table className="w-full border-collapse text-left text-sm rtl:text-right">
                        <thead>
                            <tr className="bg-[#95c020] text-white">
                                <th className="px-2 py-4 text-center">ID</th>
                                <th className="px-2 py-4 text-center">Nombre</th>
                                <th className="px-2 py-4 text-center">IP</th>
                                <th className="px-2 py-4 text-center">Puerto</th>
                                <th className="px-2 py-4 text-center">Estado</th>
                                <th className="px-2 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((device) => (
                                <tr key={device.id} className="text-center">
                                    <td className="px-5 py-5 text-center font-bold">{device.id}</td>
                                    <td className="px-5 py-5 text-center">{device.name}</td>
                                    <td className="px-5 py-5 text-center font-black">{device.ip}</td>
                                    <td className="px-5 py-5 text-center">{device.port}</td>
                                    <td className="px-5 py-5 text-center">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                                device.state ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}
                                        >
                                            {device.state ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>

                                    <td className="flex items-center justify-center space-x-4 px-4 py-2">
                                        <button
                                            onClick={() => handleEditClick(device)}
                                            className="rounded border border-yellow-500 text-yellow-500 px-3 py-2 hover:bg-yellow-500 hover:text-white"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(device.id)}
                                            className="inline-flex items-center rounded border border-red-600 text-red-600 px-3 py-2 hover:bg-red-600 hover:text-white"
                                        >
                                            <Trash2 size={16}
                                             />
                                        </button>
                                    </td>
                                    
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/*Modal que se encarga de dar una vista antes de eliminar*/}

                <ConfirmModal
                    show={showModal}
                    title="Eliminar dispositivo"
                    message="¿Seguro que deseas eliminar este dispositivo? Esta acción no se puede deshacer."
                    onConfirm={confirmDelete}
                    onClose={() => setShowModal(false)}
                />

                {/*Modal que muestra edicion de los demas*/}

                <EditDeviceModal show={showEditModal} device={selectedDevice} onClose={() => setShowEditModal(false)} />
            </div>
        </div>
    );
}

DevicesIndex.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;
