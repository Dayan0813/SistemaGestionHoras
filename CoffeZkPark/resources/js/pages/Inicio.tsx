import MainLayout from '@/Layouts/MainLayout';
import React from 'react';

interface CurrentProps {
    currentRouteName: string;
}

const Inicio = ({ currentRouteName }: CurrentProps) => {
    return (
        <div className="mx-auto max-w-7xl space-y-16 px-6 py-12">
            {/* =========================
                HERO / BIENVENIDA
            ========================== */}
            <section className="space-y-4 text-center">
                <h1 className="text-4xl font-semibold text-[#a81c24]">Sistema de Gestión de Tiempos y Asistencias</h1>

                <p className="mx-auto max-w-3xl text-lg text-gray-600">
                    Plataforma web diseñada para automatizar el control de la jornada laboral mediante integración biométrica y procesamiento
                    inteligente de datos.
                </p>
            </section>

            {/* =========================
                INTRODUCCIÓN
            ========================== */}
            <section className="rounded-xl border border-[#95c020]/60 bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-[#a81c24]">Introducción</h2>

                <p className="leading-relaxed text-gray-600">
                    El presente proyecto consiste en el desarrollo de un
                    <strong> Sistema de Gestión de Tiempos y Asistencias</strong>, diseñado para automatizar el control de la jornada laboral mediante
                    la integración de hardware biométrico y una plataforma web robusta.
                    <br />
                    <br />
                    La solución centraliza la información capturada por dispositivos <strong>ZKTeco</strong>, eliminando procesos manuales y errores
                    en el cálculo de horas trabajadas. Utilizando el framework <strong>Laravel</strong>, el sistema transforma registros crudos en
                    información confiable para la toma de decisiones administrativas.
                </p>
            </section>

            {/* =========================
                OBJETIVOS
            ========================== */}
            <section className="space-y-8">
                <h2 className="text-center text-2xl font-semibold text-[#a81c24]">Objetivos del Proyecto</h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Objetivo General */}
                    <div className="rounded-xl border border-[#95c020]/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-2 font-semibold text-[#a81c24]">Objetivo General</h3>
                        <p className="text-gray-600">
                            Desarrollar una plataforma web integral que gestione la asistencia de empleados, permitiendo la sincronización con
                            dispositivos biométricos y la generación automatizada de consolidados de horas.
                        </p>
                    </div>

                    {/* Objetivos Específicos */}
                    <div className="rounded-xl border border-[#95c020]/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-2 font-semibold text-[#a81c24]">Objetivos Específicos</h3>
                        <ul className="list-inside list-disc space-y-2 text-gray-600">
                            <li>Integrar dispositivos biométricos ZKTeco para extracción de registros.</li>
                            <li>Administrar empleados, áreas y programaciones laborales.</li>
                            <li>Calcular automáticamente horas ordinarias, extras y recargos.</li>
                            <li>Generar reportes y consolidados exportables para nómina.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* =========================
                MÓDULOS DEL SISTEMA
            ========================== */}
            <section className="space-y-8">
                <h2 className="text-center text-2xl font-semibold text-[#a81c24]">Módulos del Sistema</h2>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        {
                            title: 'Empleados',
                            desc: 'Gestión de datos personales, identificación biométrica y asignación a áreas.',
                        },
                        {
                            title: 'Programaciones',
                            desc: 'Definición de horarios, turnos rotativos y calendarios laborales.',
                        },
                        {
                            title: 'Dispositivos',
                            desc: 'Configuración de conexión y sincronización con terminales ZKTeco.',
                        },
                        {
                            title: 'Reportes',
                            desc: 'Generación de hojas de tiempo y consolidados por período.',
                        },
                    ].map((m) => (
                        <div key={m.title} className="rounded-xl border border-[#95c020]/60 bg-white p-6 shadow-sm transition hover:shadow-md">
                            <h3 className="mb-2 font-semibold text-[#a81c24]">{m.title}</h3>
                            <p className="text-sm text-gray-600">{m.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* =========================
                ALCANCE TÉCNICO
            ========================== */}
            <section className="rounded-xl bg-[#a81c24] p-8 text-gray-100">
                <h2 className="mb-4 text-xl font-semibold">Alcance Técnico</h2>

                <p className="leading-relaxed text-gray-300">
                    El sistema está desarrollado bajo una arquitectura
                    <strong> MVC (Modelo–Vista–Controlador)</strong> utilizando el framework <strong>Laravel</strong>, garantizando seguridad,
                    escalabilidad y eficiencia en el manejo de bases de datos relacionales.
                    <br />
                    <br />
                    La comunicación con los dispositivos biométricos se realiza mediante protocolos de red compatibles con el IP y SDK de
                    <strong> ZKTeco</strong>, asegurando la integridad y trazabilidad de cada marcación registrada.
                </p>
            </section>
        </div>
    );
};

Inicio.layout = (page: React.ReactNode) => <MainLayout RouteNavbar={(page as any).props.currentRouteName}>{page}</MainLayout>;

export default Inicio;
