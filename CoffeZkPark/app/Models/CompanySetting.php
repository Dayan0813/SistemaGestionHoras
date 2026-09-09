<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Configuración global clave-valor de la empresa (no por área) — ej. los meses de temporada
 * alta, que aplican igual a todas las áreas de jornada fija.
 */
class CompanySetting extends Model
{
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    protected $casts = [
        'value' => 'array',
    ];

    // Cacheado: get() se llama en HandleInertiaRequests::share() en CADA request autenticado
    // (no solo en páginas que usan la configuración), así que sin caché eran 2+ SELECT extra
    // por request en toda la app. set() invalida la entrada correspondiente al escribir.
    private const CACHE_PREFIX = 'company_setting:';

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = Cache::rememberForever(self::CACHE_PREFIX . $key, fn () => static::find($key)?->value);

        return $value ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget(self::CACHE_PREFIX . $key);
    }
}
