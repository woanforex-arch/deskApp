<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingSetting;
use App\Models\Currency;
use App\Models\ExchangeRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class CurrencyController extends Controller
{
    public const DATE_FORMATS = ['Y-m-d', 'd/m/Y', 'm/d/Y', 'd-m-Y', 'F j, Y'];

    public function index(): JsonResponse
    {
        $currencies = Currency::query()
            ->withCount('exchangeRates')
            ->orderByDesc('is_base')
            ->orderBy('code')
            ->get()
            ->map(fn (Currency $currency) => $this->present($currency));

        $rates = ExchangeRate::query()
            ->orderByDesc('effective_date')
            ->orderBy('currency_code')
            ->limit(300)
            ->get()
            ->map(fn (ExchangeRate $rate) => [
                'id' => $rate->id,
                'currency_code' => $rate->currency_code,
                'rate' => (float) $rate->rate,
                'effective_date' => $rate->effective_date?->toDateString(),
                'source' => $rate->source,
            ]);

        return response()->json([
            'data' => [
                'currencies' => $currencies,
                'rates' => $rates,
                'base' => Currency::query()->where('is_base', true)->value('code') ?? 'USD',
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => [
                'required',
                'string',
                'size:3',
                'regex:/^[A-Za-z]{3}$/',
                'unique:currencies,code',
            ],
            'name' => ['required', 'string', 'max:80'],
            'symbol' => ['nullable', 'string', 'max:8'],
            'rate_to_base' => ['required', 'numeric', 'gt:0'],
            'is_base' => ['nullable', 'boolean'],
        ], [
            'code.regex' => 'The currency code must be a three-letter ISO code, such as USD or GHS.',
        ]);

        $isBase = (bool) ($data['is_base'] ?? false);

        if ($isBase) {
            Currency::query()->update(['is_base' => false]);
        }

        $currency = Currency::create([
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'symbol' => $data['symbol'] ?? null,
            'rate_to_base' => $isBase ? 1 : $data['rate_to_base'],
            'is_base' => $isBase,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->present($currency)], 201);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currency_code' => ['required', 'string', 'size:3', 'regex:/^[A-Za-z]{3}$/', Rule::exists('currencies', 'code')],
            'rate' => ['required', 'numeric', 'gt:0'],
            'effective_date' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:40'],
        ]);

        $rate = ExchangeRate::updateOrCreate(
            [
                'currency_code' => strtoupper($data['currency_code']),
                'effective_date' => $data['effective_date'],
            ],
            [
                'rate' => $data['rate'],
                'source' => $data['source'] ?? 'manual',
            ],
        );

        Currency::query()
            ->where('code', strtoupper($data['currency_code']))
            ->update(['rate_to_base' => $data['rate']]);

        return response()->json([
            'data' => [
                'id' => $rate->id,
                'currency_code' => $rate->currency_code,
                'rate' => (float) $rate->rate,
                'effective_date' => $rate->effective_date?->toDateString(),
                'source' => $rate->source,
            ],
        ], 201);
    }

    public function update(Request $request, Currency $currency): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'size:3', Rule::unique('currencies', 'code')->ignore($currency->id)],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'symbol' => ['nullable', 'string', 'max:8'],
            'rate_to_base' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $newCode = strtoupper($data['code'] ?? $currency->code);

        if ($newCode !== $currency->code && ($currency->is_base || $this->inUse($currency->code))) {
            return response()->json([
                'message' => "{$currency->code} is in use and its code cannot be changed.",
            ], 422);
        }

        $updates = array_filter([
            'code' => $data['code'] ?? null,
            'name' => $data['name'] ?? null,
            'symbol' => $data['symbol'] ?? null,
        ], fn ($value) => $value !== null);

        if ($currency->is_base) {
            $updates['rate_to_base'] = 1;
        } else {
            $updates['rate_to_base'] = $data['rate_to_base'] ?? $currency->rate_to_base;
        }

        $updates['code'] = $newCode;

        $currency->forceFill($updates)->save();

        return response()->json(['data' => $this->present($currency->refresh())]);
    }

    public function destroy(Currency $currency): JsonResponse
    {
        if ($currency->is_base) {
            return response()->json([
                'message' => 'The base currency cannot be deleted. Set another base currency first.',
            ], 422);
        }

        if ($this->inUse($currency->code)) {
            return response()->json([
                'message' => "{$currency->code} is used by accounts or transactions and cannot be deleted.",
            ], 422);
        }

        DB::transaction(function () use ($currency): void {
            $currency->exchangeRates()->delete();
            $currency->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Check whether a currency code is referenced by accounts, settings,
     * or posted transactions.
     */
    private function inUse(string $code): bool
    {
        return collect([
            ['accounts', 'currency'],
            ['invoices', 'currency'],
            ['bills', 'currency'],
            ['payments', 'currency'],
            ['vendor_payments', 'currency'],
            ['credit_notes', 'currency'],
            ['bank_accounts', 'currency'],
            ['bank_transactions', 'currency'],
            ['bank_transfers', 'currency'],
            ['cashbooks', 'currency'],
            ['cash_transactions', 'currency'],
        ])
            ->filter(fn (array $pair) => Schema::hasTable($pair[0]) && Schema::hasColumn($pair[0], $pair[1]))
            ->contains(fn (array $pair) => DB::table($pair[0])->where($pair[1], $code)->exists());
    }

    public function toggle(Currency $currency): JsonResponse
    {
        if ($currency->is_base) {
            return response()->json(['message' => 'The base currency cannot be deactivated.'], 422);
        }

        $currency->forceFill(['is_active' => ! $currency->is_active])->save();

        return response()->json(['data' => $this->present($currency->refresh())]);
    }

    public function settings(): JsonResponse
    {
        return response()->json(['data' => $this->settingsPayload()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fy_start_date' => ['nullable', 'date'],
            'fy_end_date' => ['nullable', 'date'],
            'accounting_method' => ['required', Rule::in(['accrual', 'cash'])],
            'decimal_places' => ['required', 'integer', 'between:0,4'],
            'date_format' => ['required', 'string', Rule::in(self::DATE_FORMATS)],
            'time_zone' => ['required', 'timezone', 'max:60'],
        ]);

        if (! empty($data['fy_start_date']) && ! empty($data['fy_end_date']) && $data['fy_end_date'] <= $data['fy_start_date']) {
            return response()->json([
                'message' => 'Financial year end must come after the start date.',
            ], 422);
        }

        AccountingSetting::instance()->forceFill([
            'fy_start_date' => $data['fy_start_date'] ?? null,
            'fy_end_date' => $data['fy_end_date'] ?? null,
            'accounting_method' => $data['accounting_method'],
            'decimal_places' => (int) $data['decimal_places'],
            'date_format' => $data['date_format'],
            'time_zone' => $data['time_zone'],
        ])->save();

        return response()->json(['data' => $this->settingsPayload()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function settingsPayload(): array
    {
        $settings = AccountingSetting::instance();

        return [
            'fy_start_date' => $settings->fy_start_date?->toDateString(),
            'fy_end_date' => $settings->fy_end_date?->toDateString(),
            'accounting_method' => $settings->accounting_method,
            'decimal_places' => (int) $settings->decimal_places,
            'date_format' => $settings->date_format,
            'time_zone' => $settings->time_zone,
            'date_formats' => self::DATE_FORMATS,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Currency $currency): array
    {
        return [
            'id' => $currency->id,
            'code' => $currency->code,
            'name' => $currency->name,
            'symbol' => $currency->symbol,
            'rate_to_base' => (float) $currency->rate_to_base,
            'is_base' => (bool) $currency->is_base,
            'is_active' => $currency->is_active,
            'rates_count' => $currency->exchange_rates_count ?? $currency->exchangeRates()->count(),
            'latest_rate' => (float) ($currency->exchangeRates()->orderByDesc('effective_date')->value('rate') ?? $currency->rate_to_base),
        ];
    }
}
