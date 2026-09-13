<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    /**
     * Verifica que el usuario tenga al menos uno
     * de los permisos indicados en la ruta.
     */
    public function handle(
        Request $request,
        Closure $next,
        ...$permissions
    ): Response {
        $user = auth()->guard('web')->user();

        if (!$user) {
            abort(403);
        }

        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        abort(403);
    }
}