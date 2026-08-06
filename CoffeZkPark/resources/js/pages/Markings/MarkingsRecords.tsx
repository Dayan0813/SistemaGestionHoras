import { Logs, RadioReceiver, RefreshCcw } from 'lucide-react';
import { useRef, useState } from 'react';

interface Device {
    id: number;
    name: string;
}

interface ActivityLog {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    time: string;
}

export default function MarkingsRecords({ devices }: { devices: Device[] }) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [deviceId, setDeviceId] = useState<number | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const startStream = (url: string) => {
        setLogs([]);

        eventSourceRef.current?.close();
        eventSourceRef.current = new EventSource(url);

        eventSourceRef.current.addEventListener('log', (e: any) => {
            const data = JSON.parse(e.data);

            setLogs((prev) => [
                {
                    type: data.type,
                    message: data.message,
                    time: new Date().toLocaleTimeString(),
                },
                ...prev,
            ]);
        });

        eventSourceRef.current.addEventListener('end', () => {
            eventSourceRef.current?.close();
        });
    };

    return (
        <div className="space-y-4">
            <div className='flex gap-2 items-center'>
            <Logs/>
            <h2 className="font-bold text-lg">Registro de Actividad ZKTECO</h2>
            </div>
            <p className='-mt-5'>Aqui se muestra el registro de actividad a la hora de la sincronizacion de marcaciones</p>

            {/* LOGS */}
            <div className="h-72 space-y-2 overflow-y-auto rounded border border-[#a81c24] p-3">
                {logs.map((log, i) => (
                    <div
                        key={i}
                        className={`flex justify-between rounded p-3 ${
                            log.type === 'success'
                                ? 'bg-green-50 text-green-700'
                                : log.type === 'error'
                                  ? 'bg-red-50 text-red-700'
                                  : log.type === 'warning'
                                    ? 'bg-yellow-50 text-yellow-700'
                                    : 'bg-gray-50 text-gray-700'
                        }`}
                    >
                        <span>{log.message}</span>
                        <span className="text-xs">{log.time}</span>
                    </div>
                ))}
            </div>

            {/* BOTÓN GLOBAL */}
            <button
                onClick={() => startStream('/marking')}
                className="flex w-full items-center justify-center gap-2 rounded bg-[#a81c24] py-3 text-white font-bold border border-[#a81c24] hover:bg-[#de242f] cursor-pointer"
            >
                <RefreshCcw />
                <span>Sincronizacion Global</span>
            </button>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* SELECT */}
                <select className="w-full rounded border p-2" onChange={(e) => setDeviceId(Number(e.target.value))} defaultValue="">
                    <option value="" disabled>
                        Seleccionar dispositivo
                    </option>
                    {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                            {device.name}
                        </option>
                    ))}
                </select>

                {/* BOTÓN INDIVIDUAL */}
                <button
                    disabled={!deviceId}
                    onClick={() => startStream(`/marking/only/${deviceId}`)}
                    className="flex w-full items-center justify-center gap-2 rounded border py-3 bg-[#95c020] text-white"
                >
                    <RadioReceiver />
                    <span>Sincronización Unica</span>
                </button>
            </div>
        </div>
    );
}
