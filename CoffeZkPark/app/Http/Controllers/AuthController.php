<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use App\Models\UserRole;
use Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * =====================================
     * 
     *  Funcion Para el render del formulario 
     * 
     * ======================================
     */

    public function loginForm()
    {
        return Inertia::render('Auth/Login', [
            'canRegister' => !User::exists(),
        ]);
    }

    /**
     * =====================================
     * 
     *  Funcion Login
     * 
     * ======================================
     */

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        if (!Auth::attempt($credentials)) {
            return back()->withErrors([
                'email' => 'Credenciales Incorrectas'
            ]);
        }

        $request->session()->regenerate();

        // 🔑 Usuario FRESCO desde BD (no el de sesión)
        $user = User::with('employee')->findOrFail(Auth::id());

        // =========================
        // COORDINATOR → SU ÁREA
        // =========================
        if ($user->hasRole('coordinator')) {
            $areaId = $user->employee?->area_id;

            if (!$areaId) {
                abort(403, 'No tienes un área asignada');
            }

            // 🔥 HARD REDIRECT (CLAVE)
            return Inertia::location(route('areas.show', $areaId));
        }

        if ($user->hasRole('aux_admin_th') || $user->hasRole('aux_th')) {
            return Inertia::location(route('programaciones'));
        }

        if ($user->hasRole('admin_nomina')) {
            return Inertia::location(route('empleados'));
        }

        // =========================
        // ADMIN → INICIO
        // =========================
        return Inertia::location(route('inicio'));
    }

    /**
     * =====================================
     * 
     *  Funcion Register
     * 
     * ======================================
     */

    public function createUser(Request $request)
    {

        $employees = Employee::query()
            ->whereDoesntHave('user') // evita duplicar empleado
            ->orderBy('name')
            ->get(['uid', 'name']);

        return Inertia::render('Auth/Register', [
            'employees' => $employees,
            'roles' => [
                'admin',
                'coordinator',
                'aux_admin_th',
                'admin_nomina',
                'aux_th',
            ],
        ]);
    }

    /**
     * =====================================
     * 
     *  Funcion Para cuando la BD Esta vacia
     *  Solo permite crear el primer registro
     * 
     * ======================================
     */

    public function showRegister()
    {
        if (User::count() > 0) {
            return redirect()->route('login');
        }

        return Inertia::render('Auth/Register', [
            'employees' => Employee::orderBy('name')->get(['uid', 'name']),
            'roles' => ['admin'], // primer usuario SIEMPRE admin
        ]);
    }

    // crea el registro

    public function register(Request $request)
    {
        if (User::count() > 0) {
            abort(403);
        }

        $request->validate([
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'employee_uid' => 'required|exists:employees,uid|unique:users,employee_uid',
        ]);

        // Bloqueo para que dos envíos concurrentes antes de que exista
        // cualquier usuario no puedan volverse ambos admin (TOCTOU entre el
        // User::count() de arriba y el User::create() de abajo).
        $user = \Illuminate\Support\Facades\Cache::lock('bootstrap-first-user', 10)->block(5, function () use ($request) {
            if (User::count() > 0) {
                abort(403);
            }

            $user = User::create([
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'employee_uid' => $request->employee_uid,
            ]);

            // PRIMER USUARIO = ADMIN
            UserRole::create([
                'user_id' => $user->id,
                'role' => 'admin',
            ]);

            return $user;
        });

        Auth::login($user);

        return redirect()->route('inicio');
    }

    /**
     * =====================================
     * 
     *  Funcion Guardar Usuario
     * 
     * ======================================
     */

    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', Password::min(8)->mixedCase()->numbers()],
            'role' => [
                'required',
                Rule::in([
                    'admin',
                    'coordinator',
                    'aux_admin_th',
                    'admin_nomina',
                    'aux_th',
                ]),
            ],
            'employee_uid' => [
                'required',
                'exists:employees,uid',
                'unique:users,employee_uid',
            ],
        ]);

        $user = User::create([
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'employee_uid' => $validated['employee_uid'],
        ]);

        UserRole::create([
            'user_id' => $user->id,
            'role' => $validated['role'],
        ]);

        return redirect()
            ->route('users.create')
            ->with('success', '✅ Usuario creado correctamente');
    }

    /**
     * =====================================
     * 
     *  Funcion Logout (Cerrar sesion)
     * 
     * ======================================
     */

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

}
