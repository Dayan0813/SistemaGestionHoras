import CoffeLoader from '@/Components/Loaders/CoffeLoader';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Login() {
    const { canRegister } = usePage().props as unknown as { canRegister: boolean };
    const [Loader, setLoader] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (Loader || processing) return;

        // Mostrar loader inmediatamente
        setLoader(true);

        setTimeout(() => {
            post('/login', {
                onFinish: () => {
                    // Si hay error, ocultamos loader
                    setLoader(false);
                },
            });
        }, 1200);
    };

    return (
        <>
            {Loader && <CoffeLoader />}

            <div className="flex min-h-screen items-center justify-center bg-gray-100">
                <form onSubmit={submit} className="w-full max-w-md rounded bg-white p-6 shadow">
                    <h1 className="mb-4 text-center text-xl font-bold">Iniciar Sesión</h1>

                    <input
                        type="email"
                        placeholder="Correo"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="mb-2 w-full rounded border p-2"
                    />
                    {errors.email && <p className="text-red-600">{errors.email}</p>}

                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="mb-4 w-full rounded border p-2"
                    />

                    <button disabled={processing || Loader} className="w-full rounded bg-[#a81c24] py-2 font-bold text-white disabled:opacity-60">
                        Entrar
                    </button>

                    {canRegister && (
                        <p className="mt-4 text-center text-sm">
                            ¿Sistema nuevo?{' '}
                            <Link href="/register" className="font-semibold text-blue-600">
                                Crear primer usuario
                            </Link>
                        </p>
                    )}
                </form>
            </div>
        </>
    );
}
