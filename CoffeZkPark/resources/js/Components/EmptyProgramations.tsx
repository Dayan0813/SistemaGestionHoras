export const EmptyProgramations = () => {
    return (
        <>
            <div className="m-8 flex items-center justify-center">
                <div className="w-full rounded-xl border-2 border-dashed p-20 text-center">
                    <div className="mb-4 text-4xl text-gray-400">📅</div>

                    <h2 className="text-xl font-semibold">No Se Encontraron Programaciones</h2>

                    <p className="mt-2 text-gray-500">Try adjusting your search or filters</p>

                    <button onClick={() => (window.location.href = route('programations.view'))} className="mt-6 rounded-md border px-5 py-2">
                        Clear Filters
                    </button>
                </div>
            </div>
        </>
    );
};
