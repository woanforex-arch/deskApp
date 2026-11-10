<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BankReconciliation;
use App\Models\BankTransaction;
use App\Models\BankTransfer;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BankAccountController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'active' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $accounts = BankAccount::query()
            ->with('glAccount:id,code,name')
            ->withCount(['transactions as unmatched_count' => fn ($query) => $query->where('status', 'unmatched')])
            ->when($request->filled('active'), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->get()
            ->map(fn (BankAccount $account) => $this->present($account));

        return response()->json(['data' => $accounts]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'string', 'max:40'],
            'iban' => ['nullable', 'string', 'max:40'],
            'gl_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'currency' => ['nullable', 'string', 'size:3'],
            'opening_balance' => ['nullable', 'numeric'],
        ]);

        $account = BankAccount::create([
            ...$data,
            'currency' => $data['currency'] ?? 'USD',
            'opening_balance' => $data['opening_balance'] ?? 0,
            'current_balance' => $data['opening_balance'] ?? 0,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->present($account->load('glAccount'))], 201);
    }

    public function show(BankAccount $bankAccount): JsonResponse
    {
        $bankAccount->load(['glAccount:id,code,name', 'transactions' => fn ($query) => $query->orderByDesc('transaction_date')->limit(100), 'reconciliations']);

        return response()->json([
            'data' => $this->present($bankAccount) + [
                'transactions' => $bankAccount->transactions->map(fn (BankTransaction $transaction) => [
                    'id' => $transaction->id,
                    'transaction_date' => $transaction->transaction_date?->toDateString(),
                    'description' => $transaction->description,
                    'reference' => $transaction->reference,
                    'type' => $transaction->type,
                    'amount' => (float) $transaction->amount,
                    'status' => $transaction->status,
                ]),
                'reconciliations' => $bankAccount->reconciliations->map(fn (BankReconciliation $reconciliation) => [
                    'id' => $reconciliation->id,
                    'statement_date' => $reconciliation->statement_date?->toDateString(),
                    'statement_balance' => (float) $reconciliation->statement_balance,
                    'book_balance' => (float) $reconciliation->book_balance,
                    'difference' => (float) $reconciliation->difference,
                    'status' => $reconciliation->status,
                ]),
            ],
        ]);
    }

    public function update(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'string', 'max:40'],
            'iban' => ['nullable', 'string', 'max:40'],
            'gl_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $bankAccount->update($data);

        return response()->json(['data' => $this->present($bankAccount->refresh()->load('glAccount'))]);
    }

    public function transactions(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $data = $request->validate([
            'transaction_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:60'],
            'type' => ['required', Rule::in(['deposit', 'withdrawal'])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
        ]);

        $transaction = BankTransaction::create([
            ...$data,
            'bank_account_id' => $bankAccount->id,
            'currency' => $bankAccount->currency,
            'status' => 'unmatched',
            'source' => 'manual',
        ]);

        $bankAccount->forceFill([
            'current_balance' => round((float) $bankAccount->current_balance + $transaction->signedAmount(), 2),
        ])->save();

        return response()->json([
            'data' => [
                'id' => $transaction->id,
                'transaction_date' => $transaction->transaction_date?->toDateString(),
                'description' => $transaction->description,
                'type' => $transaction->type,
                'amount' => (float) $transaction->amount,
                'status' => $transaction->status,
                'current_balance' => (float) $bankAccount->refresh()->current_balance,
            ],
        ], 201);
    }

    public function match(BankTransaction $bankTransaction): JsonResponse
    {
        $bankTransaction->forceFill(['status' => 'matched', 'matched_at' => now()])->save();

        return response()->json(['message' => 'Bank transaction matched.', 'data' => ['id' => $bankTransaction->id, 'status' => 'matched']]);
    }

    public function unmatch(BankTransaction $bankTransaction): JsonResponse
    {
        $bankTransaction->forceFill(['status' => 'unmatched', 'matched_at' => null, 'reconciliation_id' => null])->save();

        return response()->json(['message' => 'Bank transaction unmatched.', 'data' => ['id' => $bankTransaction->id, 'status' => 'unmatched']]);
    }

    public function reconciliations(Request $request, BankAccount $bankAccount): JsonResponse
    {
        $data = $request->validate([
            'statement_date' => ['required', 'date'],
            'statement_balance' => ['required', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $book = (float) $bankAccount->current_balance;

        $reconciliation = BankReconciliation::create([
            'bank_account_id' => $bankAccount->id,
            'statement_date' => $data['statement_date'],
            'statement_balance' => $data['statement_balance'],
            'book_balance' => $book,
            'difference' => round((float) $data['statement_balance'] - $book, 2),
            'status' => 'draft',
            'started_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json(['data' => $reconciliation], 201);
    }

    public function completeReconciliation(Request $request, BankReconciliation $bankReconciliation): JsonResponse
    {
        $bankReconciliation->forceFill([
            'status' => 'completed',
            'completed_by' => $request->user()->id,
            'completed_at' => now(),
        ])->save();

        BankTransaction::query()
            ->where('bank_account_id', $bankReconciliation->bank_account_id)
            ->where('status', 'matched')
            ->whereNull('reconciliation_id')
            ->update(['reconciliation_id' => $bankReconciliation->id]);

        return response()->json(['message' => 'Reconciliation completed.', 'data' => ['id' => $bankReconciliation->id, 'status' => 'completed']]);
    }

    public function transfers(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_bank_account_id' => ['required', 'integer', 'exists:bank_accounts,id', 'different:to_bank_account_id'],
            'to_bank_account_id' => ['required', 'integer', 'exists:bank_accounts,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'transfer_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $transfer = DB::transaction(function () use ($data): BankTransfer {
            $transfer = BankTransfer::create([...$data, 'status' => 'completed']);
            $this->posting->postBankTransfer($transfer->refresh());

            $from = BankAccount::query()->find($data['from_bank_account_id']);
            $to = BankAccount::query()->find($data['to_bank_account_id']);
            $from?->forceFill(['current_balance' => round((float) $from->current_balance - (float) $data['amount'], 2)])->save();
            $to?->forceFill(['current_balance' => round((float) $to->current_balance + (float) $data['amount'], 2)])->save();

            return $transfer->refresh();
        });

        return response()->json([
            'data' => [
                'id' => $transfer->id,
                'amount' => (float) $transfer->amount,
                'transfer_date' => $transfer->transfer_date?->toDateString(),
                'reference' => $transfer->reference,
                'status' => $transfer->status,
                'journal_entry_id' => $transfer->journal_entry_id,
            ],
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(BankAccount $account): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'bank_name' => $account->bank_name,
            'account_number' => $account->account_number,
            'iban' => $account->iban,
            'currency' => $account->currency,
            'gl_account' => $account->glAccount ? $account->glAccount->code.' · '.$account->glAccount->name : null,
            'opening_balance' => (float) $account->opening_balance,
            'current_balance' => (float) $account->current_balance,
            'unmatched_count' => $account->unmatched_count ?? $account->unmatchedCount(),
            'is_active' => $account->is_active,
        ];
    }
}
