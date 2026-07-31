import MainLayout from '@/Layouts/MainLayout';
import React, { useState } from 'react';
import { router, Link } from '@inertiajs/react';

export default function DevicesCreate() {
    const [values, setValues] = useState({ name: '', ip: '', port: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValues({ ...values, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route('devices.store'), values);
    };

    return (
        <div className="p-6 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold mb-4">Agregar Dispositivo</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="text"
                    name="name"
                    placeholder="Nombre"
                    className="w-full border p-2 rounded"
                    value={values.name}
                    onChange={handleChange}
                />
                <input
                    type="text"
                    name="ip"
                    placeholder="Dirección IP"
                    className="w-full border p-2 rounded"
                    value={values.ip}
                    onChange={handleChange}
                />
                <input
                    type="number"
                    name="port"
                    placeholder="Puerto"
                    className="w-full border p-2 rounded"
                    value={values.port}
                    onChange={handleChange}
                />
                <div className="flex space-x-2">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Guardar
                    </button>
                    <Link
                        href={route('devices.index')}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                        Cancelar
                    </Link>
                </div>
            </form>
        </div>
    );
}

DevicesCreate.layout = (page: React.ReactNode) => (
    <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>
);
