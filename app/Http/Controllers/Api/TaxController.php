<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxRate;
use App\Models\TaxRemittance;
use App\Services\Accounting\LedgerService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class TaxController extends Controller
{
    public function __construct(
        private readonly PostingService $posting,
        private readonly LedgerService $ledger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json([
            'data' => [
                'rates' => TaxRate::query()->with('account:id,code,name')->orderBy('code')->get()->map(fn (TaxRate $rate) => [
                    'id' => $rate->id,
                    'name' => $rate->name,
                    'code' => $rate->code,
                    'rate' => (float) $rate->rate,
                    'type' => $rate->type,
                    'account' => $rate->account ? $rate->account->code.' · '.$rate->account->name : null,
                    'is_active' => $rate->is_active,
                ]),
                'remittances' => TaxRemittance::query()->with('taxRate:id,name,code')->orderByDesc('period')->get()->map(fn (TaxRemittance $remittance) => [
                    'id' => $remittance->id,
                    'name' => $remittance->name,
                    'period' => $remittance->period,
                    'due_date' => $remittance->due_date?->toDateString(),
                    'amount' => (float) $remittance->amount,
                    'status' => $remittance->status,
                    'tax_rate' => $remittance->taxRate?->code,
                    'remitted_at' => $remittance->remitted_at?->toIso8601String(),
                ]),
                'vat_return' => $this->ledger->vatReturn($from, $to),
            ],
        ]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:20', 'unique:tax_rates,code'],
            'rate' => ['required', 'numeric', 'between:0,100'],
            'type' => ['required', Rule::in(['vat', 'sales_tax', 'withholding', 'income_tax', 'payroll'])],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        $rate = TaxRate::create([...$data, 'is_active' => true]);

        return response()->json(['data' => $rate], 201);
    }

    public function storeRemittance(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tax_rate_id' => ['nullable', 'integer', 'exists:tax_rates,id'],
            'name' => ['required', 'string', 'max:120'],
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'due_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);

        $remittance = TaxRemittance::create([...$data, 'status' => 'pending']);

        return response()->json(['data' => $remittance], 201);
    }

    public function remit(Request $request, TaxRemittance $taxRemittance): JsonResponse
    {
        if ($taxRemittance->status === 'remitted') {
            return response()->json(['message' => 'This remittance has already been paid.'], 422);
        }

        $this->posting->postTaxRemittance($taxRemittance, $request->user());

        return response()->json([
            'message' => 'Tax remittance posted.',
            'data' => [
                'id' => $taxRemittance->id,
                'status' => $taxRemittance->refresh()->status,
                'remitted_at' => $taxRemittance->remitted_at?->toIso8601String(),
                'journal_entry_id' => $taxRemittance->journal_entry_id,
            ],
        ]);
    }
}
