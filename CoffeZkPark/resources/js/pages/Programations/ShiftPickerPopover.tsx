import { X } from 'lucide-react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { shiftColor } from './programaciones.helpers';
import type { AnchorRect, Calendar } from './programaciones.types';

// Popover del selector de turno por día, montado con un portal en <body> para que no lo recorte
// el contenedor con scroll horizontal de la tabla (el problema que se ve al abrir el selector en
// las últimas columnas: quedaba cortado por el borde del área con overflow-auto).
export default function ShiftPickerPopover({
    rect,
    calendars,
    shiftLabel,
    shiftBadgeLetter,
    onPick,
    onClear,
    onClose,
}: {
    rect: AnchorRect;
    calendars: Calendar[];
    shiftLabel: (calendar: Calendar) => string;
    shiftBadgeLetter: (calendar: Calendar) => string;
    onPick: (calendarId: number) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centerX, 70), window.innerWidth - 70);
    const openBelow = rect.bottom + 60 <= window.innerHeight;
    const style: React.CSSProperties = openBelow
        ? { top: rect.bottom + 4, left, transform: 'translateX(-50%)' }
        : { top: rect.top - 4, left, transform: 'translate(-50%, -100%)' };

    return createPortal(
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div
                style={{ position: 'fixed', zIndex: 50, ...style }}
                className="flex gap-1.5 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg"
            >
                {calendars.map((cal) => (
                    <button
                        key={cal.id}
                        title={shiftLabel(cal)}
                        onClick={() => onPick(cal.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white hover:opacity-80 ${shiftColor(cal.shift_type).badge}`}
                    >
                        {shiftBadgeLetter(cal)}
                    </button>
                ))}
                <button
                    title="Sin asignar"
                    onClick={onClear}
                    className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-400 hover:bg-gray-50"
                >
                    <X size={13} />
                </button>
            </div>
        </>,
        document.body,
    );
}
