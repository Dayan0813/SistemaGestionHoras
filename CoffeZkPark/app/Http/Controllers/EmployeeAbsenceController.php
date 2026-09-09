<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresAreaAccess;
use App\Models\area;
use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\EmployeeAbsence;
use App\Models\EmployeeAbsenceSnapshot;
use App\Models\Programations;
use App\Support\ColombianHolidays;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Ausencias de empleado (vacaciones/incapacidad) con reemplazo: al crear una, el empleado
 * reemplazo hereda de verdad los turnos que el ausente tenía programados en el rango dado,
 * creando filas nuevas de Programations para el reemplazo (marcadas con group_code
 * "absence:{id}" para poder revertirlas al cancelar) — sin tocar las del ausente ni el motor
 * de consulta (AreaScheduleQuery), que no distingue "ausencia" de una programación normal.
 */
class EmployeeAbsenceController extends Controller
{
    use EnsuresAreaAccess;

    public function index(Request $request)
    {
        $user = auth()->user()->loadMissing('employee');

        $query = EmployeeAbsence::with([
            'employee:uid,name,area_id',
            'replacementEmployee:uid,name',
            'area:id,nombre',
            'createdBy:id,email',
        ])->orderByDesc('id');

        $isAdmin = $user->hasRole('admin');
        // aux_admin_th y aux_th no tienen área propia — igual que en /programaciones, en vez
        // de bloquear con 403 se les da un selector para consultar (solo lectura) las
        // ausencias de UNA área a la vez, nunca todas mezcladas.
        $isMultiAreaReadOnly = $user->hasRole('aux_admin_th') || $user->hasRole('aux_th');
        $employeesQuery = Employee::query()->where('estado', 'Activo')->orderBy('name');

        if ($isMultiAreaReadOnly) {
            if ($request->filled('area')) {
                $query->where('area_id', $request->integer('area'));
                $employeesQuery->where('area_id', $request->integer('area'));
            } else {
                // Sin área elegida todavía: no hay nada que listar (evita mezclar áreas).
                $query->whereRaw('1 = 0');
                $employeesQuery->whereRaw('1 = 0');
            }
        } elseif (!$isAdmin) {
            $areaId = $user->employee?->area_id;
            if (!$areaId) {
                abort(403, 'Usuario sin área asignada');
            }
            $query->where('area_id', $areaId);
            $employeesQuery->where('area_id', $areaId);
        } elseif ($request->filled('area')) {
            $query->where('area_id', $request->integer('area'));
        }

        return Inertia::render('Ausencias', [
            'currentRouteName' => 'ausencias',
            'absences' => $query->get(),
            'areas' => ($isAdmin || $isMultiAreaReadOnly) ? area::orderBy('nombre')->get(['id', 'nombre']) : null,
            'selectedArea' => $isMultiAreaReadOnly ? $request->integer('area') ?: null : null,
            // Para el formulario de creación: en cada empleado va su area_id, así en el
            // frontend el selector de reemplazo se puede filtrar a la MISMA área del ausente
            // sin otra petición (relevante sobre todo para admin, que ve todas las áreas).
            'employees' => $employeesQuery->get(['uid', 'name', 'area_id']),
        ]);
    }

    /**
     * Rangos de fechas (con su turno) que un empleado tiene programados actualmente — para
     * que, al elegirlo como "ausente" en el formulario, se pueda mostrar qué días sí tiene
     * cobertura real y avisar (sin bloquear) si la fecha "Desde" elegida cae fuera de todos
     * ellos.
     */
    public function schedule(Request $request)
    {
        $validated = $request->validate([
            'employee_uid' => 'required|string|exists:employees,uid',
        ]);

        $employee = Employee::where('uid', $validated['employee_uid'])->firstOrFail();
        if (!$employee->area_id) {
            abort(403, 'El empleado no tiene área asignada.');
        }

        $this->ensureAreaAcces((int) $employee->area_id);

        // Solo rangos vigentes o futuros (no interesa mostrar historial ya vencido para elegir
        // una ausencia nueva) — mismo criterio de "no cancelado" que el resto del controller.
        $ranges = Programations::where('employee_uid', $employee->uid)
            ->where('status', '!=', 'Cancelado')
            ->where('end_date', '>=', now()->toDateString())
            ->with('calendar:id,hora_entrada,hora_salida,shift_type')
            ->orderBy('start_date')
            ->get(['id', 'calendar_id', 'start_date', 'end_date'])
            ->map(fn ($p) => [
                'start_date' => $p->start_date->toDateString(),
                'end_date' => $p->end_date->toDateString(),
                'shift_type' => $p->calendar?->shift_type,
                'hora_entrada' => $p->calendar?->hora_entrada,
                'hora_salida' => $p->calendar?->hora_salida,
            ]);

        return response()->json(['ranges' => $ranges]);
    }

    /**
     * Ausencias ACTIVAS de un área — para que Programaciones.tsx marque las celdas de los
     * días en que un empleado está de vacaciones/incapacidad en vez de mostrarlas como
     * espacio libre normal para asignar. Liviano a propósito (sin relaciones cargadas más
     * allá del nombre), porque se pide junto con el resto de datos de la grilla.
     */
    public function activeByArea(Request $request)
    {
        $validated = $request->validate([
            'area_id' => 'required|integer|exists:areas,id',
        ]);

        $this->ensureAreaAcces($validated['area_id']);

        // Solo ausencias con fechas reales bloquean celdas — una reserva de mes sin fechas
        // (ver storeReservation()) no tiene rango que bloquear, se expone aparte abajo.
        $absences = EmployeeAbsence::where('area_id', $validated['area_id'])
            ->where('status', 'Activa')
            ->whereNotNull('start_date')
            ->get(['id', 'employee_uid', 'type', 'start_date', 'end_date'])
            ->map(fn ($a) => [
                'employee_uid' => $a->employee_uid,
                'type' => $a->type,
                'start_date' => $a->start_date->toDateString(),
                'end_date' => $a->end_date->toDateString(),
            ]);

        // Reservas de mes ACTIVAS sin fechas todavía — para el recordatorio visual en
        // Programaciones.tsx (no bloquean nada, solo avisan).
        $reservations = EmployeeAbsence::where('area_id', $validated['area_id'])
            ->where('status', 'Activa')
            ->whereNull('start_date')
            ->whereNotNull('planned_month')
            ->get(['id', 'employee_uid', 'planned_month'])
            ->map(fn ($a) => [
                'id' => $a->id,
                'employee_uid' => $a->employee_uid,
                'planned_month' => $a->planned_month,
            ]);

        return response()->json(['absences' => $absences, 'reservations' => $reservations]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_uid' => 'required|string|exists:employees,uid',
            'type' => 'required|in:vacaciones,incapacidad',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            // Obligatorio solo para incapacidad: cubrir el puesto suele ser crítico. Las
            // vacaciones no necesitan reemplazo — basta con bloquear la disponibilidad del
            // empleado esos días (ver absenceForDay() en Programaciones.tsx).
            'replacement_employee_uid' => [
                Rule::requiredIf($request->input('type') === 'incapacidad'),
                'nullable',
                'string',
                'exists:employees,uid',
                'different:employee_uid',
            ],
            'notes' => 'nullable|string|max:500',
        ]);

        $absentEmployee = Employee::where('uid', $validated['employee_uid'])->firstOrFail();
        if (!$absentEmployee->area_id) {
            abort(403, 'El empleado ausente no tiene área asignada.');
        }

        $this->ensureAreaAcces((int) $absentEmployee->area_id);

        // Vacaciones: solo empleados con derecho a ellas (ningún contrato "temporal", único
        // catálogo libre sin flag propio — mismo criterio de texto que ya usa el frontend en
        // contractTextColor()/contractBadgeColor()) y solo hasta el saldo que les queda.
        $requestedDays = null;
        if ($validated['type'] === 'vacaciones') {
            $absentEmployee->loadMissing('contrato');
            $contratoNombre = strtolower($absentEmployee->contrato?->name ?? '');
            if (str_contains($contratoNombre, 'temporal')) {
                abort(422, 'Los empleados con contrato temporal no tienen derecho a vacaciones.');
            }

            $requestedDays = Carbon::parse($validated['start_date'])->diffInDays(Carbon::parse($validated['end_date'])) + 1;

            if ($requestedDays > $absentEmployee->dias_vacaciones_disponibles) {
                abort(422, "El empleado solo tiene {$absentEmployee->dias_vacaciones_disponibles} día(s) de vacaciones disponibles y se solicitaron {$requestedDays}.");
            }
        }

        $replacementEmployee = null;
        if (!empty($validated['replacement_employee_uid'])) {
            $replacementEmployee = Employee::where('uid', $validated['replacement_employee_uid'])->firstOrFail();
            if ((int) $replacementEmployee->area_id !== (int) $absentEmployee->area_id) {
                abort(403, 'El reemplazo debe pertenecer a la misma área que el empleado ausente.');
            }
        }

        $areaId = (int) $absentEmployee->area_id;

        [$absence, $inheritedDays, $skippedForConflict] = $this->withAreaLock($areaId, function () use ($validated, $absentEmployee, $replacementEmployee, $areaId, $requestedDays) {
            return DB::transaction(function () use ($validated, $absentEmployee, $replacementEmployee, $areaId, $requestedDays) {
                // Revalida el saldo con el valor FRESCO (bajo lock de fila): el chequeo de
                // arriba usó el valor cargado antes de esperar el lock de área, que puede
                // haber quedado stale si otra solicitud para el mismo empleado ya decrementó
                // mientras esta esperaba turno (dos clics rápidos, dos pestañas).
                if ($validated['type'] === 'vacaciones') {
                    $freshEmployee = Employee::where('uid', $absentEmployee->uid)->lockForUpdate()->first();
                    if ($requestedDays > $freshEmployee->dias_vacaciones_disponibles) {
                        abort(422, "El empleado solo tiene {$freshEmployee->dias_vacaciones_disponibles} día(s) de vacaciones disponibles y se solicitaron {$requestedDays}.");
                    }
                }

                $absence = EmployeeAbsence::create([
                    'employee_uid' => $absentEmployee->uid,
                    'area_id' => $areaId,
                    'type' => $validated['type'],
                    'start_date' => $validated['start_date'],
                    'end_date' => $validated['end_date'],
                    'days' => $requestedDays,
                    'replacement_employee_uid' => $replacementEmployee?->uid,
                    'status' => 'Activa',
                    'notes' => $validated['notes'] ?? null,
                    'created_by' => auth()->id(),
                ]);

                if ($validated['type'] === 'vacaciones') {
                    $absentEmployee->decrement('dias_vacaciones_disponibles', $requestedDays);
                }

                [$inheritedDays, $skippedForConflict] = $this->createAbsence(
                    $absence,
                    $absentEmployee,
                    $replacementEmployee,
                    $areaId,
                    $validated['start_date'],
                    $validated['end_date'],
                );

                return [$absence, $inheritedDays, $skippedForConflict];
            });
        });

        if ($skippedForConflict > 0) {
            return $this->respondAbsenceResult(
                $request,
                'warning',
                "⚠️ Ausencia registrada. {$inheritedDays} día(s) heredados por el reemplazo, pero {$skippedForConflict} día(s) se omitieron porque el puesto ya estaba ocupado por otro empleado.",
            );
        }

        if ($replacementEmployee === null) {
            return $this->respondAbsenceResult(
                $request,
                'success',
                $inheritedDays > 0
                    ? "✅ Ausencia registrada. {$inheritedDays} día(s) del empleado quedaron bloqueados."
                    : '✅ Ausencia registrada. El empleado no tenía turnos programados en ese rango.',
            );
        }

        if ($inheritedDays === 0) {
            return $this->respondAbsenceResult(
                $request,
                'warning',
                '⚠️ Ausencia registrada, pero el empleado ausente no tenía turnos programados en ese rango: no se generó ningún turno para el reemplazo.',
            );
        }

        return $this->respondAbsenceResult(
            $request,
            'success',
            "✅ Ausencia registrada. El reemplazo heredó {$inheritedDays} día(s) de turno.",
        );
    }

    /**
     * Plan anual de vacaciones: registra VARIAS tandas de vacaciones de una vez para un mismo
     * empleado (fraccionamiento de los 15 días), contando solo días HÁBILES (sin fin de
     * semana ni festivos colombianos — a diferencia de store(), que sigue contando días
     * calendario para no alterar el comportamiento ya probado de incapacidad/atajo rápido).
     * Aplica a cualquier empleado con derecho a vacaciones (cualquier contrato que NO sea
     * "temporal" — "empleado fijo" es sobre el CONTRATO del empleado, no sobre el modo de
     * programación de su área, que puede ser fija o variable por igual). Reglas propias de
     * este flujo, que NO aplican a store(): ningún día puede caer en temporada alta, y no
     * puede solaparse con vacaciones ya activas de OTRO empleado de la misma área. Nunca
     * lleva reemplazo (las vacaciones solo bloquean disponibilidad, ver store()).
     */
    public function storePlan(Request $request)
    {
        $validated = $request->validate([
            'employee_uid' => 'required|string|exists:employees,uid',
            // Máximo 2 tandas por plan (mismo límite que PlanVacaciones.tsx) — un fraccionamiento
            // más granular no aporta y complica la validación de solapamiento/temporada alta.
            'ranges' => 'required|array|min:1|max:2',
            'ranges.*.start_date' => 'required|date',
            'ranges.*.end_date' => 'required|date|after_or_equal:ranges.*.start_date',
        ]);

        $absentEmployee = Employee::where('uid', $validated['employee_uid'])->with(['area', 'contrato'])->firstOrFail();
        if (!$absentEmployee->area_id) {
            abort(403, 'El empleado no tiene área asignada.');
        }

        $this->ensureAreaAcces((int) $absentEmployee->area_id);

        $contratoNombre = strtolower($absentEmployee->contrato?->name ?? '');
        if (str_contains($contratoNombre, 'temporal')) {
            abort(422, 'Los empleados con contrato temporal no tienen derecho a vacaciones.');
        }

        $highSeasonRanges = CompanySetting::get('high_season_ranges', []);
        $areaId = (int) $absentEmployee->area_id;

        // 1) Expandir cada tanda a sus días HÁBILES, validar temporada alta y acumular total.
        $allBusinessDays = [];
        foreach ($validated['ranges'] as $i => $range) {
            $businessDays = $this->businessDaysInRange($range['start_date'], $range['end_date']);
            foreach ($businessDays as $day) {
                if ($this->isHighSeasonDay($day, $highSeasonRanges)) {
                    $tanda = $i + 1;
                    abort(422, "La tanda {$tanda} cae en temporada alta (día {$day}). No se pueden programar vacaciones en temporada alta.");
                }
            }
            $allBusinessDays = array_merge($allBusinessDays, $businessDays);
        }

        $totalDays = count($allBusinessDays);
        if ($totalDays === 0) {
            abort(422, 'El rango elegido no tiene ningún día hábil.');
        }
        if ($totalDays > $absentEmployee->dias_vacaciones_disponibles) {
            abort(422, "El plan pide {$totalDays} día(s) hábiles y el empleado solo tiene {$absentEmployee->dias_vacaciones_disponibles} disponible(s).");
        }

        // 2) Solapamiento por área: ningún día hábil de NINGUNA tanda puede coincidir con una
        // ausencia tipo vacaciones ACTIVA de OTRO empleado de la misma área.
        $conflicting = EmployeeAbsence::where('area_id', $areaId)
            ->where('employee_uid', '!=', $absentEmployee->uid)
            ->where('type', 'vacaciones')
            ->where('status', 'Activa')
            ->whereNotNull('start_date')
            ->get(['employee_uid', 'start_date', 'end_date'])
            ->filter(function ($other) use ($allBusinessDays) {
                $otherStart = $other->start_date->toDateString();
                $otherEnd = $other->end_date->toDateString();
                foreach ($allBusinessDays as $day) {
                    if ($day >= $otherStart && $day <= $otherEnd) {
                        return true;
                    }
                }

                return false;
            });

        if ($conflicting->isNotEmpty()) {
            $names = Employee::whereIn('uid', $conflicting->pluck('employee_uid')->unique())->pluck('name')->implode(', ');
            abort(422, "Ya hay otro empleado del área de vacaciones en fechas que se cruzan: {$names}.");
        }

        // 3) Crear una EmployeeAbsence por tanda, todo dentro de un solo lock+transacción.
        $this->withAreaLock($areaId, function () use ($validated, $absentEmployee, $areaId, $totalDays) {
            return DB::transaction(function () use ($validated, $absentEmployee, $areaId, $totalDays) {
                // Revalida el saldo con el valor FRESCO (bajo lock de fila): el chequeo de
                // arriba pudo quedar stale si otra solicitud para el mismo empleado ya
                // decrementó mientras esta esperaba el lock de área.
                $freshEmployee = Employee::where('uid', $absentEmployee->uid)->lockForUpdate()->first();
                if ($totalDays > $freshEmployee->dias_vacaciones_disponibles) {
                    abort(422, "El plan pide {$totalDays} día(s) hábiles y el empleado solo tiene {$freshEmployee->dias_vacaciones_disponibles} disponible(s).");
                }

                foreach ($validated['ranges'] as $range) {
                    $businessDays = $this->businessDaysInRange($range['start_date'], $range['end_date']);

                    $absence = EmployeeAbsence::create([
                        'employee_uid' => $absentEmployee->uid,
                        'area_id' => $areaId,
                        'type' => 'vacaciones',
                        'start_date' => $range['start_date'],
                        'end_date' => $range['end_date'],
                        'days' => count($businessDays),
                        'replacement_employee_uid' => null,
                        'status' => 'Activa',
                        'notes' => 'Plan anual de vacaciones',
                        'created_by' => auth()->id(),
                    ]);

                    $absentEmployee->decrement('dias_vacaciones_disponibles', count($businessDays));

                    if (!empty($businessDays)) {
                        $this->hideEmployeeDays($absence, $absentEmployee->uid, $businessDays);
                    }
                }
            });
        });

        return $this->respondAbsenceResult(
            $request,
            'success',
            "✅ Plan de vacaciones registrado: {$totalDays} día(s) hábiles en ".count($validated['ranges']).' tanda(s).',
        );
    }

    /**
     * Reserva un MES (sin fechas exactas) para una futura tanda de vacaciones de un empleado
     * — pensado para el mes prioritario (enero), cuando aún no se sabe el rango exacto pero sí
     * en qué mes del año tomará esa tanda. No descuenta saldo (no hay días que contar
     * todavía) ni toca Programations. Se "confirma" más adelante con fechas reales vía
     * updatePlanRange(), que convierte esta MISMA fila en la tanda real.
     */
    public function storeReservation(Request $request)
    {
        $validated = $request->validate([
            'employee_uid' => 'required|string|exists:employees,uid',
            'planned_month' => 'required|date_format:Y-m',
        ]);

        $absentEmployee = Employee::where('uid', $validated['employee_uid'])->with('contrato')->firstOrFail();
        if (!$absentEmployee->area_id) {
            abort(403, 'El empleado no tiene área asignada.');
        }

        $this->ensureAreaAcces((int) $absentEmployee->area_id);

        $contratoNombre = strtolower($absentEmployee->contrato?->name ?? '');
        if (str_contains($contratoNombre, 'temporal')) {
            abort(422, 'Los empleados con contrato temporal no tienen derecho a vacaciones.');
        }

        EmployeeAbsence::create([
            'employee_uid' => $absentEmployee->uid,
            'area_id' => $absentEmployee->area_id,
            'type' => 'vacaciones',
            'planned_month' => $validated['planned_month'],
            'start_date' => null,
            'end_date' => null,
            'days' => null,
            'replacement_employee_uid' => null,
            'status' => 'Activa',
            'notes' => 'Mes reservado — pendiente definir fechas',
            'created_by' => auth()->id(),
        ]);

        return $this->respondAbsenceResult($request, 'success', "✅ Mes reservado: {$validated['planned_month']}.");
    }

    /**
     * true si $dayISO cae dentro de algún rango de temporada alta (CompanySetting
     * 'high_season_ranges', configurado globalmente por un admin en Areas/Index.tsx).
     *
     * @param array<int, array{start:string,end:string}> $highSeasonRanges
     */
    private function isHighSeasonDay(string $dayISO, array $highSeasonRanges): bool
    {
        foreach ($highSeasonRanges as $range) {
            if (($range['start'] ?? null) !== null && ($range['end'] ?? null) !== null && $dayISO >= $range['start'] && $dayISO <= $range['end']) {
                return true;
            }
        }

        return false;
    }

    /**
     * Días HÁBILES (sin fin de semana ni festivo colombiano) dentro de un rango inclusivo —
     * solo para storePlan(); store() sigue contando días calendario a propósito.
     *
     * @return string[]
     */
    private function businessDaysInRange(string $startDate, string $endDate): array
    {
        $days = [];
        $cursor = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        while ($cursor->lte($end)) {
            $dayISO = $cursor->toDateString();
            if (ColombianHolidays::isBusinessDay($dayISO)) {
                $days[] = $dayISO;
            }
            $cursor->addDay();
        }

        return $days;
    }

    /**
     * Aplica el efecto real de una ausencia ya creada ($absence, con su employee_uid/type/etc
     * ya persistidos): hereda los turnos del ausente hacia el reemplazo si lo hay (o solo los
     * oculta si no hay reemplazo), respetando conflictos de puesto. Extraído de store() para
     * que storePlan() (varias tandas de vacaciones en un solo envío) pueda reusar exactamente
     * la misma lógica de "esconder/heredar" sin duplicarla.
     *
     * @return array{0:int,1:int} [$inheritedDays, $skippedForConflict]
     */
    private function createAbsence(
        EmployeeAbsence $absence,
        Employee $absentEmployee,
        ?Employee $replacementEmployee,
        int $areaId,
        string $startDate,
        string $endDate,
    ): array {
        $coveredDays = $this->coveredDates($startDate, $endDate, null);

        // Una sola query para TODAS las programaciones activas del ausente que se solapan con
        // el rango (en vez de una query por día — con una incapacidad/vacación de varias
        // semanas eso eran decenas de queries idénticas salvo por la fecha), con overrides del
        // rango precargados; se resuelve la cobertura efectiva de cada día en memoria.
        $candidateProgramations = Programations::where('employee_uid', $absentEmployee->uid)
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate)
            ->with(['overrides' => fn ($q) => $q->whereIn('date', $coveredDays)])
            ->get();

        // Día -> ['calendar_id' => ..., 'work_position_id' => ...] con la cobertura
        // EFECTIVA del ausente ese día (override puntual si existe, si no la fila base).
        // Un día sin nada programado para el ausente simplemente no genera nada.
        $dayShifts = [];
        foreach ($coveredDays as $day) {
            $isoWeekday = Carbon::parse($day)->isoWeekday();

            $programation = $candidateProgramations
                ->filter(fn ($p) => $p->start_date->toDateString() <= $day && $p->end_date->toDateString() >= $day)
                ->filter(fn ($p) => empty($p->work_days) || in_array($isoWeekday, $p->work_days, true))
                ->sortByDesc('id')
                ->first();

            if (!$programation) {
                continue;
            }

            $override = $programation->overrides->firstWhere('date', $day);

            $dayShifts[$day] = [
                'calendar_id' => $override?->calendar_id ?? $programation->calendar_id,
                'work_position_id' => ($override && $override->work_position_id !== null)
                    ? $override->work_position_id
                    : $programation->work_position_id,
            ];
        }

        if (empty($dayShifts)) {
            return [0, 0];
        }

        // Vacaciones sin reemplazo: no hay a quién heredar turnos, así que basta con
        // ocultar/recortar la programación del ausente en los días que tenía cubiertos
        // (con snapshot para restaurar al cancelar) — el bloqueo visual en
        // Programaciones.tsx ya lo cubre absenceForDay() mirando EmployeeAbsence
        // directamente, esto es solo para que tampoco aparezca con turno en
        // AreaScheduleGrid/Excel, que sí leen de Programations.
        if ($replacementEmployee === null) {
            $this->hideEmployeeDays($absence, $absentEmployee->uid, array_keys($dayShifts));

            return [count($dayShifts), 0];
        }

        // Puestos ya ocupados por OTROS empleados en el rango, para no pisar a nadie
        // más que no sea el propio ausente (cuyo turno se está prestando).
        $occupiedByDayAndPosition = $this->loadOccupiedPositions($areaId, $startDate, $endDate);

        $inheritedDays = 0;
        $skippedForConflict = 0;
        $groupCode = $absence->groupCode();
        // Días donde el reemplazo SÍ terminó heredando el turno (sin conflicto de
        // puesto) — son exactamente los días que hay que "vaciar" en la programación
        // del ausente, para que ya no aparezca cubriendo turno en las vistas.
        $daysToHideFromAbsent = [];

        foreach ($this->groupContiguousSameShift($dayShifts) as $block) {
            $blockDays = array_values(array_diff($block['days'], []));
            $usableDays = [];

            foreach ($blockDays as $day) {
                $positionId = $block['work_position_id'];
                $occupant = $positionId ? ($occupiedByDayAndPosition[$day][$positionId] ?? null) : null;

                if ($occupant !== null && $occupant !== $absentEmployee->uid && $occupant !== $replacementEmployee->uid) {
                    $skippedForConflict++;
                    continue;
                }

                $usableDays[] = $day;
            }

            if (empty($usableDays)) {
                continue;
            }

            sort($usableDays);

            // El reemplazo puede ya haber tenido SU PROPIO turno programado alguno de
            // estos días (sin relación con el puesto que se chequeó arriba, ej. otra
            // atracción, u otro puesto sin position id) — si no se recorta primero,
            // quedaría con dos Programations activas el mismo día. Se guarda como
            // snapshot igual que al ausente, para poder restaurarlo al cancelar.
            $this->hideEmployeeDays($absence, $replacementEmployee->uid, $usableDays);

            foreach ($this->toContiguousDateRanges($usableDays) as $range) {
                $calendar = \App\Models\calendars::find($block['calendar_id']);

                Programations::create([
                    'employee_uid' => $replacementEmployee->uid,
                    'type' => $calendar?->shift_type,
                    'area_id' => $areaId,
                    'calendar_id' => $block['calendar_id'],
                    'work_position_id' => $block['work_position_id'],
                    'start_date' => $range['start'],
                    'end_date' => $range['end'],
                    'status' => 'Programado',
                    'group_code' => $groupCode,
                    'work_days' => null,
                ]);

                $rangeDays = $this->coveredDates($range['start'], $range['end'], null);
                $inheritedDays += count($rangeDays);
                array_push($daysToHideFromAbsent, ...$rangeDays);

                if ($block['work_position_id']) {
                    foreach ($rangeDays as $day) {
                        $occupiedByDayAndPosition[$day][$block['work_position_id']] = $replacementEmployee->uid;
                    }
                }
            }
        }

        if (!empty($daysToHideFromAbsent)) {
            $this->hideEmployeeDays($absence, $absentEmployee->uid, $daysToHideFromAbsent);
        }

        return [$inheritedDays, $skippedForConflict];
    }

    /**
     * El formulario largo de Ausencias.tsx usa Inertia (router.post) y espera el redirect
     * normal con flash message. El atajo rápido de Programaciones.tsx llama por axios pidiendo
     * JSON (header Accept o el flag expects_json) para poder quedarse en esa pantalla sin
     * navegar — se le responde con un JSON simple en vez de redirigir.
     */
    private function respondAbsenceResult(Request $request, string $flashKey, string $message)
    {
        if ($request->wantsJson() || $request->boolean('expects_json')) {
            return response()->json([$flashKey => $message]);
        }

        return redirect()->route('ausencias')->with($flashKey, $message);
    }

    public function destroy(EmployeeAbsence $absence)
    {
        $this->ensureAreaAcces((int) $absence->area_id);

        DB::transaction(fn () => $this->revertAbsence($absence));

        return redirect()
            ->route('ausencias')
            ->with('success', '✅ Ausencia cancelada: los turnos heredados por el reemplazo fueron revertidos y la programación del empleado se restauró.');
    }

    /**
     * Edita una tanda de vacaciones YA guardada (registrada por el plan anual, sin reemplazo):
     * revierte su efecto tal cual destroy() y crea una tanda nueva con las fechas editadas,
     * todo en una sola transacción — así se re-valida días hábiles, temporada alta, solapamiento
     * por área y saldo disponible exactamente igual que al crearla la primera vez, sin dejar
     * turnos duplicados ni saldo descuadrado. Solo aplica a vacaciones sin reemplazo (las
     * creadas por storePlan()); una incapacidad o vacaciones con reemplazo deben cancelarse y
     * volver a crearse desde el formulario largo, porque ahí sí hay turnos heredados de por
     * medio que complican una edición "in place".
     */
    public function updatePlanRange(Request $request, EmployeeAbsence $absence)
    {
        $this->ensureAreaAcces((int) $absence->area_id);

        if ($absence->type !== 'vacaciones' || $absence->replacement_employee_uid !== null) {
            abort(422, 'Solo se pueden editar tandas de vacaciones sin reemplazo.');
        }
        if ($absence->status !== 'Activa') {
            abort(422, 'Esta ausencia ya está cancelada.');
        }

        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $absentEmployee = Employee::where('uid', $absence->employee_uid)->with(['area', 'contrato'])->firstOrFail();
        $areaId = (int) $absence->area_id;

        $highSeasonRanges = CompanySetting::get('high_season_ranges', []);
        $businessDays = $this->businessDaysInRange($validated['start_date'], $validated['end_date']);

        foreach ($businessDays as $day) {
            if ($this->isHighSeasonDay($day, $highSeasonRanges)) {
                abort(422, "La fecha elegida cae en temporada alta (día {$day}). No se pueden programar vacaciones en temporada alta.");
            }
        }

        $totalDays = count($businessDays);
        if ($totalDays === 0) {
            abort(422, 'El rango elegido no tiene ningún día hábil.');
        }

        // El saldo "disponible" para esta edición incluye de vuelta los días que esta MISMA
        // tanda ya tenía descontados (se está reemplazando, no sumando una tanda nueva).
        $availableForThisEdit = $absentEmployee->dias_vacaciones_disponibles + ($absence->days ?? 0);
        if ($totalDays > $availableForThisEdit) {
            abort(422, "La tanda editada pide {$totalDays} día(s) hábiles y el empleado solo tiene {$availableForThisEdit} disponible(s).");
        }

        $conflicting = EmployeeAbsence::where('area_id', $areaId)
            ->where('id', '!=', $absence->id)
            ->where('employee_uid', '!=', $absentEmployee->uid)
            ->where('type', 'vacaciones')
            ->where('status', 'Activa')
            ->whereNotNull('start_date')
            ->get(['employee_uid', 'start_date', 'end_date'])
            ->filter(function ($other) use ($businessDays) {
                $otherStart = $other->start_date->toDateString();
                $otherEnd = $other->end_date->toDateString();
                foreach ($businessDays as $day) {
                    if ($day >= $otherStart && $day <= $otherEnd) {
                        return true;
                    }
                }

                return false;
            });

        if ($conflicting->isNotEmpty()) {
            $names = Employee::whereIn('uid', $conflicting->pluck('employee_uid')->unique())->pluck('name')->implode(', ');
            abort(422, "Ya hay otro empleado del área de vacaciones en fechas que se cruzan: {$names}.");
        }

        $this->withAreaLock($areaId, function () use ($absence, $absentEmployee, $validated, $businessDays) {
            DB::transaction(function () use ($absence, $absentEmployee, $validated, $businessDays) {
                $this->revertAbsence($absence);

                // Revalida el saldo con el valor FRESCO (bajo lock de fila, ya con los días de
                // la tanda vieja devueltos por revertAbsence): el chequeo de arriba, hecho
                // antes de esperar el lock de área, pudo quedar stale si otra solicitud para
                // el mismo empleado decrementó su saldo mientras esta esperaba turno.
                $freshEmployee = Employee::where('uid', $absentEmployee->uid)->lockForUpdate()->first();
                $totalDays = count($businessDays);
                if ($totalDays > $freshEmployee->dias_vacaciones_disponibles) {
                    abort(422, "La tanda editada pide {$totalDays} día(s) hábiles y el empleado solo tiene {$freshEmployee->dias_vacaciones_disponibles} disponible(s).");
                }

                $newAbsence = EmployeeAbsence::create([
                    'employee_uid' => $absentEmployee->uid,
                    'area_id' => $absence->area_id,
                    'type' => 'vacaciones',
                    'planned_month' => null,
                    'start_date' => $validated['start_date'],
                    'end_date' => $validated['end_date'],
                    'days' => count($businessDays),
                    'replacement_employee_uid' => null,
                    'status' => 'Activa',
                    'notes' => 'Plan anual de vacaciones',
                    'created_by' => auth()->id(),
                ]);

                $absentEmployee->decrement('dias_vacaciones_disponibles', count($businessDays));

                if (!empty($businessDays)) {
                    $this->hideEmployeeDays($newAbsence, $absentEmployee->uid, $businessDays);
                }
            });
        });

        return $this->respondAbsenceResult($request, 'success', "✅ Tanda actualizada: {$totalDays} día(s) hábiles.");
    }

    /**
     * Revierte el efecto de una ausencia ACTIVA: restaura las Programations recortadas (del
     * ausente y del reemplazo si aplica) desde sus snapshots, borra los turnos heredados por
     * el reemplazo, devuelve el saldo de vacaciones descontado, y la marca Cancelada. Extraído
     * de destroy() para que updatePlanRange() pueda reusarlo antes de crear la tanda editada,
     * sin duplicar la lógica de reversión.
     */
    private function revertAbsence(EmployeeAbsence $absence): void
    {
        // Una reserva de mes pura (sin fechas) nunca tocó Programations ni descontó saldo —
        // nada que revertir salvo marcarla Cancelada.
        if ($absence->isReservationOnly()) {
            $absence->update(['status' => 'Cancelada']);

            return;
        }

        Programations::where('group_code', $absence->groupCode())
            ->where('employee_uid', $absence->replacement_employee_uid)
            ->delete();

        foreach ($absence->snapshots()->get() as $snapshot) {
            Programations::create([
                'employee_uid' => $snapshot->employee_uid,
                'type' => $snapshot->type,
                'area_id' => $absence->area_id,
                'calendar_id' => $snapshot->calendar_id,
                'work_position_id' => $snapshot->work_position_id,
                'start_date' => $snapshot->start_date,
                'end_date' => $snapshot->end_date,
                'status' => $snapshot->status,
                'group_code' => $snapshot->group_code,
                'work_days' => $snapshot->work_days,
            ]);
        }
        $absence->snapshots()->delete();

        if ($absence->type === 'vacaciones' && $absence->days) {
            Employee::where('uid', $absence->employee_uid)->increment('dias_vacaciones_disponibles', $absence->days);
        }

        $absence->update(['status' => 'Cancelada']);
    }

    /**
     * "Vacía" la programación de UN empleado (el ausente, o el reemplazo si ya tenía turno
     * propio ese día) en los días dados: por cada Programations original que se solapa con
     * esos días, guarda un snapshot exacto (para poder reconstruirla al cancelar la ausencia)
     * y la reemplaza por los fragmentos que quedan FUERA de esos días (0, 1 o varios,
     * agrupados en rangos contiguos vía toContiguousDateRanges) — así ese empleado deja de
     * aparecer cubriendo turno esos días concretos en la grilla/exports, sin perder el resto
     * de su programación. Se usa tanto para el ausente (siempre) como para el reemplazo
     * (solo si ya tenía algo programado esos días, para no dejarlo con dos turnos a la vez).
     */
    private function hideEmployeeDays(EmployeeAbsence $absence, string $employeeUid, array $hiddenDays): void
    {
        $hiddenDaySet = array_flip($hiddenDays);
        $earliest = min($hiddenDays);
        $latest = max($hiddenDays);

        $candidates = Programations::where('employee_uid', $employeeUid)
            ->where('status', '!=', 'Cancelado')
            ->where('start_date', '<=', $latest)
            ->where('end_date', '>=', $earliest)
            ->get();

        foreach ($candidates as $candidate) {
            $candidateDays = $this->coveredDates($candidate->start_date->toDateString(), $candidate->end_date->toDateString(), $candidate->work_days);
            $overlapsHidden = array_filter($candidateDays, fn ($d) => isset($hiddenDaySet[$d]));

            if (empty($overlapsHidden)) {
                continue;
            }

            EmployeeAbsenceSnapshot::create([
                'employee_absence_id' => $absence->id,
                'employee_uid' => $candidate->employee_uid,
                'calendar_id' => $candidate->calendar_id,
                'work_position_id' => $candidate->work_position_id,
                'start_date' => $candidate->start_date,
                'end_date' => $candidate->end_date,
                'status' => $candidate->status,
                'type' => $candidate->type,
                'group_code' => $candidate->group_code,
                'work_days' => $candidate->work_days,
            ]);

            $remainingDays = array_values(array_diff($candidateDays, array_keys($hiddenDaySet)));
            sort($remainingDays);

            $candidate->delete();

            // Los días que quedan (si hay) se recrean como fila(s) nueva(s) sin work_days: ya
            // no hace falta el patrón semanal original, porque solo interesa cubrir
            // exactamente los días concretos que sobrevivieron al recorte.
            foreach ($this->toContiguousDateRanges($remainingDays) as $range) {
                Programations::create([
                    'employee_uid' => $employeeUid,
                    'type' => $candidate->type,
                    'area_id' => $candidate->area_id,
                    'calendar_id' => $candidate->calendar_id,
                    'work_position_id' => $candidate->work_position_id,
                    'start_date' => $range['start'],
                    'end_date' => $range['end'],
                    'status' => $candidate->status,
                    'group_code' => $candidate->group_code,
                    'work_days' => null,
                ]);
            }
        }
    }

    /**
     * Mismo mecanismo de lock por área que ProgramationsController::withAreaLock() — evita que
     * esto choque con un store/update de Programaciones concurrente sobre la misma área.
     */
    private function withAreaLock(int $areaId, \Closure $callback)
    {
        $lockName = "programations_area_{$areaId}";

        $acquired = DB::selectOne('SELECT GET_LOCK(?, 10) AS acquired', [$lockName]);

        if (!$acquired || (int) $acquired->acquired !== 1) {
            abort(423, 'Esta área está siendo modificada por otro usuario en este momento. Intenta de nuevo en unos segundos.');
        }

        try {
            return $callback();
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) AS released', [$lockName]);
        }
    }

    /**
     * Mapa día ISO -> work_position_id -> employee_uid que lo ocupa, para todas las
     * programaciones activas del área que tocan el rango — mismo criterio que
     * ProgramationsController::loadOccupiedPositions().
     */
    private function loadOccupiedPositions(int $areaId, string $startDate, string $endDate): array
    {
        $candidates = Programations::where('area_id', $areaId)
            ->where('status', '!=', 'Cancelado')
            ->whereNotNull('work_position_id')
            ->where('start_date', '<=', $endDate)
            ->where('end_date', '>=', $startDate)
            ->with(['overrides' => fn ($q) => $q->whereBetween('date', [$startDate, $endDate])])
            ->get();

        $occupiedByDayAndPosition = [];

        foreach ($candidates as $candidate) {
            $overridesByDate = $candidate->overrides->keyBy('date');

            foreach ($this->coveredDates($candidate->start_date->toDateString(), $candidate->end_date->toDateString(), $candidate->work_days) as $day) {
                if ($day < $startDate || $day > $endDate) {
                    continue;
                }

                $override = $overridesByDate->get($day);
                $effectiveWorkPositionId = ($override && $override->work_position_id !== null)
                    ? $override->work_position_id
                    : $candidate->work_position_id;

                if ($effectiveWorkPositionId !== null) {
                    $occupiedByDayAndPosition[$day][(int) $effectiveWorkPositionId] = $candidate->employee_uid;
                }
            }
        }

        return $occupiedByDayAndPosition;
    }

    /**
     * Fechas ISO ('YYYY-MM-DD') cubiertas por un rango, respetando work_days (null o vacío =
     * todos los días del rango) — mismo criterio que ProgramationsController::coveredDates().
     */
    private function coveredDates(string $startDate, string $endDate, ?array $workDays): array
    {
        $dates = [];
        $cursor = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        while ($cursor->lte($end)) {
            if (empty($workDays) || in_array($cursor->dayOfWeekIso, $workDays, true)) {
                $dates[] = $cursor->toDateString();
            }
            $cursor->addDay();
        }

        return $dates;
    }

    /**
     * Agrupa fechas ISO ordenadas en rangos de días calendario consecutivos — mismo criterio
     * que ProgramationsController::toContiguousDateRanges().
     */
    private function toContiguousDateRanges(array $sortedDates): array
    {
        if (empty($sortedDates)) {
            return [];
        }

        $ranges = [];
        $start = $sortedDates[0];
        $prev = $sortedDates[0];

        for ($i = 1; $i < count($sortedDates); $i++) {
            $current = $sortedDates[$i];
            $expectedNext = Carbon::parse($prev)->addDay()->toDateString();

            if ($current === $expectedNext) {
                $prev = $current;
                continue;
            }

            $ranges[] = ['start' => $start, 'end' => $prev];
            $start = $current;
            $prev = $current;
        }

        $ranges[] = ['start' => $start, 'end' => $prev];

        return $ranges;
    }

    /**
     * Agrupa el mapa día -> {calendar_id, work_position_id} en bloques de días que comparten
     * el MISMO turno y puesto (no alcanza con toContiguousDateRanges(): además de días
     * consecutivos, deben coincidir en calendar_id/work_position_id para poder representarse
     * en una sola fila de Programations). No exige que los días de un bloque sean
     * consecutivos entre sí — cada bloque se vuelve a partir en rangos contiguos más
     * adelante, en toContiguousDateRanges().
     *
     * @param array<string, array{calendar_id:int,work_position_id:?int}> $dayShifts
     * @return array<int, array{calendar_id:int,work_position_id:?int,days:string[]}>
     */
    private function groupContiguousSameShift(array $dayShifts): array
    {
        $blocks = [];

        foreach ($dayShifts as $day => $shift) {
            $key = $shift['calendar_id'] . '::' . ($shift['work_position_id'] ?? 'null');

            if (!isset($blocks[$key])) {
                $blocks[$key] = [
                    'calendar_id' => $shift['calendar_id'],
                    'work_position_id' => $shift['work_position_id'],
                    'days' => [],
                ];
            }

            $blocks[$key]['days'][] = $day;
        }

        return array_values($blocks);
    }
}
