import { Coffee } from 'lucide-react';

export default function CoffeLoader() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center">
                <div className="flex h-28 w-28 animate-spin items-center justify-center rounded-full border-8 border-gray-200 border-t-amber-800 text-5xl text-amber-700">
                    <div className="animate-ping">
                        <Coffee />
                    </div>
                </div>
                <p className="mt-4 text-lg font-semibold text-amber-200">Procesando...</p>
            </div>
        </div>
    );
}
