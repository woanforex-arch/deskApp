<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\ExchangeRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CurrencyController extends Controller
{
    public function index(): Response
    {
        $currencies = Currency::query()
            ->withCount('exchangeRates')
            ->orderByDesc('is_base')
            ->orderBy('code')
            ->get()
            ->map(fn (Currency $currency) => [
                'id' => $currency->id,
                'code' => $currency->code,
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'rate_to_base' => (float) $currency->rate_to_base,
                'is_base' => $currency->is_base,
                'is_active' => $currency->is_active,
                'rates_count' => $currency->exchange_rates_count,
                'latest_rate' => (float) ($currency->exchangeRates()->orderByDesc('effective_date')->value('rate') ?? $currency->rate_to_base),
                'in_use' => $currency->is_base || $this->inUse($currency->code),
            ]);

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

        return Inertia::render('Currencies/Index', [
            'currencies' => $currencies,
            'rates' => $rates,
            'stats' => [
                'currencies' => Currency::query()->count(),
                'active' => Currency::query()->where('is_active', true)->count(),
                'rates' => ExchangeRate::query()->count(),
                'base' => Currency::query()->where('is_base', true)->value('code') ?? 'USD',
            ],
            'sources' => ['manual', 'ecb', 'central_bank', 'provider'],
        ]);
    }

    public function store(Request $request): RedirectResponse
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

        Currency::create([
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'symbol' => $data['symbol'] ?? null,
            'rate_to_base' => $isBase ? 1 : $data['rate_to_base'],
            'is_base' => $isBase,
            'is_active' => true,
        ]);

        return back()->with('success', 'Currency added.');
    }

    public function storeRate(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'currency_code' => ['required', 'string', 'size:3', 'regex:/^[A-Za-z]{3}$/', Rule::exists('currencies', 'code')],
            'rate' => ['required', 'numeric', 'gt:0'],
            'effective_date' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:40'],
        ]);

        ExchangeRate::updateOrCreate(
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

        return back()->with('success', 'Exchange rate saved.');
    }

    public function toggle(Currency $currency): RedirectResponse
    {
        if ($currency->is_base) {
            return back()->with('error', 'The base currency cannot be deactivated.');
        }

        $currency->forceFill(['is_active' => ! $currency->is_active])->save();

        return back()->with('success', "{$currency->code} ".($currency->is_active ? 'activated' : 'deactivated').'.');
    }

    public function update(Request $request, Currency $currency): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'size:3', Rule::unique('currencies', 'code')->ignore($currency->id)],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'symbol' => ['nullable', 'string', 'max:8'],
            'rate_to_base' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $newCode = strtoupper($data['code'] ?? $currency->code);

        if ($newCode !== $currency->code && ($currency->is_base || $this->inUse($currency->code))) {
            return back()
                ->withInput()
                ->with('error', "{$currency->code} is in use and its code cannot be changed.");
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

        return back()->with('success', "{$currency->refresh()->code} updated.");
    }

    public function destroy(Currency $currency): RedirectResponse
    {
        if ($currency->is_base) {
            return back()->with('error', 'The base currency cannot be deleted. Set another base currency first.');
        }

        if ($this->inUse($currency->code)) {
            return back()->with('error', "{$currency->code} is used by accounts or transactions and cannot be deleted.");
        }

        DB::transaction(function () use ($currency): void {
            $currency->exchangeRates()->delete();
            $currency->delete();
        });

        return back()->with('success', "{$currency->code} and its exchange rates deleted.");
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
}
