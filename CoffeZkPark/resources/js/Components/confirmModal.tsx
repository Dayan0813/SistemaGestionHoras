import { useEffect } from 'react';

interface ConfirmModalProps {
    show: boolean;
    title?: string;
    message?: string;
    onConfirm: () => void;
    onClose: () => void;
    refreshOnClose?: boolean;
}

export default function ConfirmModal({
    show,
    title = 'Confirmar acción',
    message = '¿Estás seguro de continuar?',
    onConfirm,
    onClose,
    refreshOnClose = true,
}: ConfirmModalProps) {
    //Efecto para el scroll: debe declararse antes de cualquier "return"
    //condicional (Reglas de los Hooks) — si no, React lanza un error al
    //pasar de show=false a show=true en el primer render.
    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = 'auto';
            };
        }
    }, [show]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-bold">{title}</h2>
                <p className="mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="rounded bg-[#a81c24] px-4 py-2 text-white hover:bg-[#c9252d]">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}
