<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\TaxRate;
use App\Models\TaxRemittance;
use App\Services\Accounting\LedgerService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TaxController extends Controller
{
    public function __construct(
        private readonly PostingService $posting,
        private readonly LedgerService $ledger,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = $filters['from'] ?? Carbon::today()->startOfYear()->toDateString();
        $to = $filters['to'] ?? Carbon::today()->toDateString();

        $rates = TaxRate::query()
            ->with('account:id,code,name')
            ->orderBy('name')
            ->get()
            ->map(fn (TaxRate $rate) => [
                'id' => $rate->id,
                'name' => $rate->name,
                'code' => $rate->code,
                'rate' => (float) $rate->rate,
                'type' => $rate->type,
                'account' => $rate->account ? $rate->account->code.' - '.$rate->account->name : null,
                'is_active' => $rate->is_active,
            ]);

        $remittances = TaxRemittance::query()
            ->with('taxRate:id,name,code')
            ->orderByDesc('due_date')
            ->get()
            ->map(fn (TaxRemittance $remittance) => [
                'id' => $remittance->id,
                'name' => $remittance->name,
                'period' => $remittance->period,
                'due_date' => $remittance->due_date?->toDateString(),
                'amount' => (float) $remittance->amount,
                'status' => $remittance->status,
                'remitted_at' => $remittance->remitted_at?->toIso8601String(),
                'reference' => $remittance->reference,
                'rate' => $remittance->taxRate?->name,
            ]);

        $vat = $this->ledger->vatReturn(Carbon::parse($from), Carbon::parse($to));

        return Inertia::render('Tax/Index', [
            'rates' => $rates,
            'remittances' => $remittances,
            'vat' => $vat,
            'filters' => ['from' => $from, 'to' => $to],
            'stats' => [
                'rates' => TaxRate::query()->where('is_active', true)->count(),
                'pending' => round((float) TaxRemittance::query()->where('status', 'pending')->sum('amount'), 2),
                'remitted' => round((float) TaxRemittance::query()->where('status', 'remitted')->sum('amount'), 2),
                'net_vat' => (float) ($vat['net_payable'] ?? 0),
            ],
            'accounts' => Account::query()->whereIn('type', ['liability', 'asset'])->orderBy('code')->get(['id', 'code', 'name']),
            'types' => ['vat', 'sales_tax', 'withholding', 'income_tax', 'payroll'],
            'periods' => collect(range(0, 11))
                ->map(fn (int $offset) => now()->subMonthsNoOverflow($offset)->format('Y-m'))
                ->values(),
        ]);
    }

    public function storeRate(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:20', 'unique:tax_rates,code'],
            'rate' => ['required', 'numeric', 'between:0,100'],
            'type' => ['required', Rule::in(['vat', 'sales_tax', 'withholding', 'income_tax', 'payroll'])],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        TaxRate::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Tax rate created.');
    }

    public function storeRemittance(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tax_rate_id' => ['nullable', 'integer', 'exists:tax_rates,id'],
            'name' => ['required', 'string', 'max:120'],
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'due_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);

        TaxRemittance::create([...$data, 'status' => 'pending']);

        return back()->with('success', 'Tax remittance scheduled.');
    }

    public function remit(Request $request, TaxRemittance $taxRemittance): RedirectResponse
    {
        if ($taxRemittance->status === 'remitted') {
            return back()->with('error', 'This remittance has already been paid.');
        }

        $this->posting->postTaxRemittance($taxRemittance, $request->user());

        return back()->with('success', "Tax remittance {$taxRemittance->name} posted.");
    }
}
