import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
dayjs.locale('es');

interface ProgramationData {
    calendar_id: number | '';
    work_position_id: number | '';
    start_date: string;
    end_date: string;
    work_days: string[];
    excluded_dates: string[];
    month: string;
    group_code: string;
}

interface Calendar {
    id: number;
    area_id: number;
    hora_entrada: string;
    hora_salida: string;
    shift_type: 'D' | 'N';
}

interface WorkPosition {
    id: number;
    name: string;
}

interface Props {
    employeeId: number;
    calendars: Calendar[];
    areaId: number | null;
    workPositions: WorkPosition[];
    defaultData: ProgramationData;
    onClose: () => void;
    onSave: (empId: number, data: ProgramationData) => void;
}

export default function IndividualPModal({ employeeId, defaultData, onClose, onSave, areaId }: Props) {
    const [data, setData] = useState<ProgramationData>(defaultData);

    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [workPositions, setWorkPositions] = useState<WorkPosition[]>([]);

    const [loadingCalendars, setLoadingCalendars] = useState(false);
    const [loadingPositions, setLoadingPositions] = useState(false);

    // Calendarios por area

    useEffect(() => {
        if (!areaId) {
            setCalendars([]);
            return;
        }

        setLoadingCalendars(true);
        axios
            .get(`/calendars/area/${areaId}`)
            .then((res) => setCalendars(res.data))
            .finally(() => setLoadingCalendars(false));
    }, [areaId]);

    // Puestos por area

    useEffect(() => {
        const fetchPuestos = async () => {
            if (!areaId) {
                setWorkPositions([]);
                return;
            }

            setLoadingPositions(true);
            try {
                const response = await axios.get(`/workPositions/area/${areaId}/puestos`);
                setWorkPositions(response.data);
            } catch (error) {
                console.error('Error cargando puestos:', error);
            } finally {
                setLoadingPositions(false);
            }
        };

        fetchPuestos();
    }, [areaId]);

    // Guardar

    const handleSave = () => {
        if (!data.calendar_id || !data.start_date || !data.end_date) {
            alert('Completa todos los campos antes de guardar');
            return;
        }
        onSave(employeeId, data);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                {/* Encabezado */}
                <div className="mb-4 flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-bold text-[#a81c24]">Configuración individual — Empleado {employeeId}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-[#a81c24]">
                        <XCircle className="h-6 w-6" />
                    </button>
                </div>

                {/* Campos del formulario */}
                <div className="space-y-4">
                    {/* Calendario */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700">Turno</label>
                        <select
                            value={data.calendar_id}
                            disabled={loadingCalendars}
                            onChange={(e) => setData({ ...data, calendar_id: Number(e.target.value) })}
                            className="w-full rounded border border-gray-300 px-2 py-1"
                        >
                            <option value="">
                                {loadingCalendars
                                    ? 'Cargando...'
                                    : 'Seleccione un turno'}
                            </option>
                            {calendars.map((cal) => (
                                <option key={cal.id} value={cal.id}>
                                    {cal.shift_type} ({cal.hora_entrada} {' '}
                                    {cal.hora_salida})
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Puesto de Trabajo */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700">Puesto de Trabajo</label>
                        <select
                            value={data.work_position_id}
                            onChange={(e) =>
                                setData({
                                    ...data,
                                    work_position_id: Number(e.target.value) || '',
                                })
                            }
                            disabled={loadingPositions}
                            className="w-full rounded border px-2 py-1"
                        >
                            <option value="">
                                {loadingPositions ? 'Cargando...' : areaId ? 'Seleccione un puesto...' : 'Primero elija un área'}
                            </option>

                            {workPositions.map((puesto) => (
                                <option key={puesto.id} value={puesto.id}>
                                    {puesto.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fechas */}
                    <div className="flex space-x-2">
                        <div className="w-1/2">
                            <label className="block text-sm font-semibold text-gray-700">Inicio</label>
                            <input
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData({ ...data, start_date: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1"
                            />
                        </div>
                        <div className="w-1/2">
                            <label className="block text-sm font-semibold text-gray-700">Fin</label>
                            <input
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData({ ...data, end_date: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="mt-6 flex justify-end space-x-3 border-t pt-3">
                    <button onClick={onClose} className="rounded border border-gray-400 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded border border-[#95c020] px-3 py-1 text-sm font-semibold text-[#95c020] hover:bg-[#95c020] hover:text-white"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}
