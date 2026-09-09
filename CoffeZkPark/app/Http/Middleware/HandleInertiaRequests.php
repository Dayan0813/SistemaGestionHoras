<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user()?->loadMissing('employee.area', 'roles.permissions');

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user
                    ? [
                        'id' => $user->id,
                        'email' => $user->email,
                        'roles' => $user->roles->pluck('role')->values()->all(),
                        'permissions' => $user->roles
                            ->flatMap(fn ($role) => $role->permissions->pluck('name'))
                            ->unique()
                            ->values()
                            ->all(),
                        'area_id' => $user->employee?->area_id,
                        'area_name' => $user->employee?->area?->nombre,
                        'area_scheduling_mode' => $user->employee?->area?->scheduling_mode,
                        // Global para toda la empresa (no por área), como rangos de fechas
                        // exactas (no meses completos) — ver CompanySetting.
                        'area_high_season_ranges' => \App\Models\CompanySetting::get('high_season_ranges', []),
                        // Meses de anticipación con que se avisa que una reserva de mes de
                        // vacaciones (sin fechas todavía) ya necesita fechas exactas — ver
                        // EmployeeAbsenceController::storeReservation().
                        'vacation_reminder_months' => \App\Models\CompanySetting::get('vacation_reminder_months', 3),
                    ]
                    : null,
            ],
            // Sin esto, cada redirect()->with('success'/'warning'/'error', ...)
            // de los controladores se pierde: Inertia no comparte el flash de
            // sesión por defecto, hay que exponerlo explícitamente.
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'warning' => fn () => $request->session()->get('warning'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }
}
