import { AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type ConfirmVariant = 'default' | 'info' | 'warning' | 'danger';

interface ConfirmModalProps {
    show: boolean;
    title?: string;
    message?: string;
    // Contenido adicional debajo del mensaje (ej. una lista) — para casos más ricos que un solo
    // párrafo, sin tener que crear un modal de confirmación aparte.
    children?: ReactNode;
    onConfirm: () => void;
    onClose: () => void;
    refreshOnClose?: boolean;
    // Cambia el ícono/color del encabezado y el texto del botón de confirmar, para que el
    // componente sirva tanto para una confirmación neutra como para una advertencia o una
    // acción destructiva, sin salirse de la paleta del proyecto.
    variant?: ConfirmVariant;
    confirmLabel?: string;
    cancelLabel?: string;
}

const VARIANT_STYLES: Record<ConfirmVariant, { icon: typeof Info; iconBg: string; iconColor: string; confirmBtn: string }> = {
    default: {
        icon: HelpCircle,
        iconBg: 'bg-[#a81c24]/10',
        iconColor: 'text-[#a81c24]',
        confirmBtn: 'bg-[#a81c24] hover:bg-[#c9252d]',
    },
    info: {
        icon: Info,
        iconBg: 'bg-[#eaf3d3]',
        iconColor: 'text-[#5e7a15]',
        confirmBtn: 'bg-[#95c020] hover:bg-[#7da81a]',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-[#f0b429]/20',
        iconColor: 'text-[#a1740a]',
        confirmBtn: 'bg-[#a81c24] hover:bg-[#c9252d]',
    },
    danger: {
        icon: AlertTriangle,
        iconBg: 'bg-[#a81c24]/10',
        iconColor: 'text-[#a81c24]',
        confirmBtn: 'bg-[#a81c24] hover:bg-[#c9252d]',
    },
};

// Modal de confirmación único y reutilizable para toda la app — evita que cada pantalla arme su
// propio diálogo con estilos distintos. Para casos con contenido más rico que un párrafo (ej.
// una lista de empleados afectados), usar la prop `children`.
export default function ConfirmModal({
    show,
    title = 'Confirmar acción',
    message = '¿Estás seguro de continuar?',
    children,
    onConfirm,
    onClose,
    variant = 'default',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
}: ConfirmModalProps) {
    // Efecto para el scroll: debe declararse antes de cualquier "return"
    // condicional (Reglas de los Hooks) — si no, React lanza un error al
    // pasar de show=false a show=true en el primer render.
    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'auto';
            };
        }
    }, [show]);

    if (!show) return null;

    const styles = VARIANT_STYLES[variant];
    const Icon = styles.icon;

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
                <div className="flex items-start gap-3 px-6 pt-6 pb-2">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.iconBg}`}>
                        <Icon size={18} className={styles.iconColor} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                        <p className="mt-1 text-sm text-gray-600">{message}</p>
                    </div>
                </div>

                {children && <div className="max-h-72 overflow-y-auto px-6 py-3">{children}</div>}

                <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={onConfirm} className={`rounded-md px-4 py-2 text-xs font-bold text-white ${styles.confirmBtn}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
