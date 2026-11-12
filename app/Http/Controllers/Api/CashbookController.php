<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cashbook;
use App\Models\CashTransaction;
use App\Services\Accounting\CurrencyService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CashbookController extends Controller
{
    public function __construct(private readonly PostingService $posting, private readonly CurrencyService $currency) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', 'string', 'max:20'],
            'active' => ['nullable', 'boolean'],
        ]);

        $cashbooks = Cashbook::query()
            ->with('glAccount:id,code,name')
            ->withCount('transactions')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('active'), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->orderBy('name')
            ->get()
            ->map(fn (Cashbook $cashbook) => $this->present($cashbook));

        return response()->json([
            'data' => [
                'cashbooks' => $cashbooks,
                'stats' => [
                    'cash' => round((float) Cashbook::query()->where('type', 'cash')->sum('balance'), 2),
                    'petty' => round((float) Cashbook::query()->where('type', 'petty')->sum('balance'), 2),
                    'funds' => round((float) Cashbook::query()->sum('balance'), 2),
                    'transactions' => CashTransaction::query()->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:30', 'unique:cashbooks,code'],
            'type' => ['required', Rule::in(['cash', 'petty', 'fund'])],
            'gl_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'currency' => ['nullable', 'string', 'size:3'],
            'balance' => ['nullable', 'numeric'],
            'custodian' => ['nullable', 'string', 'max:120'],
        ]);

        $cashbook = Cashbook::create([
            ...$data,
            'currency' => $data['currency'] ?? $this->currency->baseCurrency(),
            'balance' => $data['balance'] ?? 0,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->present($cashbook->load('glAccount'))], 201);
    }

    public function show(Cashbook $cashbook): JsonResponse
    {
        $cashbook->load('glAccount:id,code,name');

        return response()->json([
            'data' => $this->present($cashbook) + [
                'transactions' => $cashbook->transactions()
                    ->orderByDesc('transaction_date')
                    ->orderByDesc('id')
                    ->limit(100)
                    ->get()
                    ->map(fn (CashTransaction $transaction) => $this->presentTransaction($transaction)),
            ],
        ]);
    }

    public function storeTransaction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cashbook_id' => ['required', 'integer', 'exists:cashbooks,id'],
            'transaction_date' => ['required', 'date'],
            'type' => ['required', Rule::in(['receipt', 'payment', 'transfer_in', 'transfer_out'])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:60'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
        ]);

        $transaction = DB::transaction(function () use ($data, $request): CashTransaction {
            $transaction = CashTransaction::create([...$data, 'created_by' => $request->user()->id]);
            $this->posting->postCashTransaction($transaction->refresh());

            return $transaction->refresh();
        });

        return response()->json([
            'data' => $this->presentTransaction($transaction->load('journalEntry')),
            'message' => 'Cash transaction posted.',
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Cashbook $cashbook): array
    {
        return [
            'id' => $cashbook->id,
            'name' => $cashbook->name,
            'code' => $cashbook->code,
            'type' => $cashbook->type,
            'currency' => $cashbook->currency,
            'balance' => (float) $cashbook->balance,
            'custodian' => $cashbook->custodian,
            'gl_account' => $cashbook->glAccount ? $cashbook->glAccount->code.' · '.$cashbook->glAccount->name : null,
            'is_active' => $cashbook->is_active,
            'transactions_count' => $cashbook->transactions_count ?? $cashbook->transactions()->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentTransaction(CashTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'cashbook_id' => $transaction->cashbook_id,
            'cashbook' => $transaction->cashbook?->name,
            'transaction_date' => $transaction->transaction_date?->toDateString(),
            'type' => $transaction->type,
            'amount' => (float) $transaction->amount,
            'description' => $transaction->description,
            'reference' => $transaction->reference,
            'contact' => $transaction->contact?->name,
            'journal_entry_id' => $transaction->journal_entry_id,
        ];
    }
}
