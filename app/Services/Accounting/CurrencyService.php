<?php

namespace App\Services\Accounting;

use App\Models\Company;
use App\Models\Currency;
use App\Models\ExchangeRate;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class CurrencyService
{
    public function baseCurrency(): string
    {
        return Company::query()->value('base_currency')
            ?? Currency::query()->where('is_base', true)->value('code')
            ?? 'USD';
    }

    /**
     * Active currencies and their current rate to the base currency.
     *
     * @return array{base: string, currencies: array<int, array{code: string, name: string, symbol: string|null, rate: float}>}
     */
    public function displayOptions(): array
    {
        $base = strtoupper($this->baseCurrency());

        $currencies = Currency::query()
            ->where('is_active', true)
            ->orderByDesc('is_base')
            ->orderBy('code')
            ->get(['code', 'name', 'symbol', 'rate_to_base'])
            ->map(fn (Currency $currency) => [
                'code' => strtoupper($currency->code),
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'rate' => strtoupper($currency->code) === $base ? 1.0 : (float) $currency->rate_to_base,
            ])
            ->values()
            ->all();

        // The base currency should always be selectable, even before it has been configured.
        if (! in_array($base, array_column($currencies, 'code'), true)) {
            array_unshift($currencies, [
                'code' => $base,
                'name' => $base,
                'symbol' => null,
                'rate' => 1.0,
            ]);
        }

        return [
            'base' => $base,
            'currencies' => $currencies,
        ];
    }

    public function rate(string $code, CarbonInterface|string|null $date = null): float
    {
        $code = strtoupper($code);

        if ($code === strtoupper($this->baseCurrency())) {
            return 1.0;
        }

        $date = $date ? Carbon::parse($date) : today();

        $historic = ExchangeRate::query()
            ->where('currency_code', $code)
            ->whereDate('effective_date', '<=', $date->toDateString())
            ->orderByDesc('effective_date')
            ->value('rate');

        if ($historic !== null) {
            return (float) $historic;
        }

        return (float) (Currency::query()->where('code', $code)->value('rate_to_base') ?? 1);
    }

    public function convert(float $amount, string $from, string $to, CarbonInterface|string|null $date = null): float
    {
        if (strtoupper($from) === strtoupper($to)) {
            return round($amount, 2);
        }

        $fromRate = $this->rate($from, $date);
        $toRate = $this->rate($to, $date);

        return round($amount * ($fromRate / $toRate), 2);
    }

    public function toBase(float $amount, string $currency, CarbonInterface|string|null $date = null): float
    {
        return $this->convert($amount, $currency, $this->baseCurrency(), $date);
    }

    /**
     * @return array{code: string, rate: float, date: string}
     */
    public function snapshot(string $code, CarbonInterface|string|null $date = null): array
    {
        $date = $date ? Carbon::parse($date) : today();

        return [
            'code' => strtoupper($code),
            'rate' => $this->rate($code, $date),
            'date' => $date->toDateString(),
        ];
    }
}
