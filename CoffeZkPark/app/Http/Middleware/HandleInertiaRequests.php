<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        if ($user) {
            $user->loadMissing([
                'employee.area',
                'roles',
            ]);
        }

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user
                    ? [
                        'id' => $user->id,
                        'email' => $user->email,

                        'roles' => $user->roles
                            ->pluck('role')
                            ->values()
                            ->all(),

                        'permissions' => $user->getPermissions(),

                        'area_id' => $user->employee?->area_id,

                        'area_name' => $user->employee?->area?->nombre,
                    ]
                    : null,
            ],
        ]);
    }
}