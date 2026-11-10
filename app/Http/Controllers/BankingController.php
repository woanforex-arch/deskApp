<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\BankAccount;
use App\Models\BankReconciliation;
use App\Models\BankTransaction;
use App\Models\BankTransfer;
use App\Models\Contact;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BankingController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'status' => ['nullable', 'string', 'max:20'],
        ]);

        $accountId = $filters['account_id'] ?? null;

        $accounts = BankAccount::query()
            ->with('glAccount:id,code,name')
            ->withCount(['transactions as unmatched_count' => fn ($query) => $query->where('status', 'unmatched')])
            ->orderBy('name')
            ->get()
            ->map(fn (BankAccount $account) => [
                'id' => $account->id,
                'name' => $account->name,
                'bank_name' => $account->bank_name,
                'account_number' => $account->account_number,
                'currency' => $account->currency,
                'gl_account' => $account->glAccount ? $account->glAccount->code.' · '.$account->glAccount->name : null,
                'opening_balance' => (float) $account->opening_balance,
                'current_balance' => (float) $account->current_balance,
                'unmatched_count' => $account->unmatched_count,
                'is_active' => $account->is_active,
            ]);

        $transactions = BankTransaction::query()
            ->with(['bankAccount:id,name', 'contact:id,name'])
            ->when($accountId, fn ($query) => $query->where('bank_account_id', $accountId))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (BankTransaction $transaction) => [
                'id' => $transaction->id,
                'bank_account' => $transaction->bankAccount?->name,
                'transaction_date' => $transaction->transaction_date?->toDateString(),
                'description' => $transaction->description,
                'reference' => $transaction->reference,
                'type' => $transaction->type,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->currency,
                'status' => $transaction->status,
                'matched_at' => $transaction->matched_at?->toIso8601String(),
                'contact' => $transaction->contact?->name,
                'source' => $transaction->source,
            ]);

        $reconciliations = BankReconciliation::query()
            ->with('bankAccount:id,name,currency')
            ->orderByDesc('statement_date')
            ->limit(50)
            ->get()
            ->map(fn (BankReconciliation $reconciliation) => [
                'id' => $reconciliation->id,
                'bank_account' => $reconciliation->bankAccount?->name,
                'statement_date' => $reconciliation->statement_date?->toDateString(),
                'statement_balance' => (float) $reconciliation->statement_balance,
                'book_balance' => (float) $reconciliation->book_balance,
                'difference' => (float) $reconciliation->difference,
                'currency' => $reconciliation->bankAccount?->currency,
                'status' => $reconciliation->status,
                'completed_at' => $reconciliation->completed_at?->toIso8601String(),
            ]);

        $transfers = BankTransfer::query()
            ->with(['fromAccount:id,name', 'toAccount:id,name'])
            ->orderByDesc('transfer_date')
            ->limit(50)
            ->get()
            ->map(fn (BankTransfer $transfer) => [
                'id' => $transfer->id,
                'from' => $transfer->fromAccount?->name,
                'to' => $transfer->toAccount?->name,
                'amount' => (float) $transfer->amount,
                'transfer_date' => $transfer->transfer_date?->toDateString(),
                'reference' => $transfer->reference,
                'status' => $transfer->status,
            ]);

        return Inertia::render('Banking/Index', [
            'accounts' => $accounts,
            'transactions' => $transactions,
            'reconciliations' => $reconciliations,
            'transfers' => $transfers,
            'filters' => ['account_id' => $accountId, 'status' => $filters['status'] ?? null],
            'stats' => [
                'cash' => round((float) BankAccount::query()->where('is_active', true)->sum('current_balance'), 2),
                'unmatched' => BankTransaction::query()->where('status', 'unmatched')->count(),
                'accounts' => BankAccount::query()->where('is_active', true)->count(),
                'open_reconciliations' => BankReconciliation::query()->where('status', 'draft')->count(),
            ],
            'glAccounts' => Account::query()->where('type', 'asset')->orderBy('code')->get(['id', 'code', 'name']),
            'contacts' => Contact::query()->orderBy('name')->get(['id', 'name']),
            'currencies' => Account::query()->distinct()->orderBy('currency')->pluck('currency'),
        ]);
    }

    public function storeAccount(Request $request): RedirectResponse
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

        BankAccount::create([
            ...$data,
            'currency' => $data['currency'] ?? 'USD',
            'opening_balance' => $data['opening_balance'] ?? 0,
            'current_balance' => $data['opening_balance'] ?? 0,
            'is_active' => true,
        ]);

        return back()->with('success', 'Bank account added.');
    }

    public function storeTransaction(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bank_account_id' => ['required', 'integer', 'exists:bank_accounts,id'],
            'transaction_date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:60'],
            'type' => ['required', Rule::in(['deposit', 'withdrawal'])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
        ]);

        $account = BankAccount::query()->findOrFail($data['bank_account_id']);
        $transaction = BankTransaction::create([
            ...$data,
            'currency' => $account->currency,
            'status' => 'unmatched',
            'source' => 'manual',
        ]);

        $account->forceFill([
            'current_balance' => round((float) $account->current_balance + $transaction->signedAmount(), 2),
        ])->save();

        return back()->with('success', 'Bank transaction captured — match it to a reconciliation to close it out.');
    }

    public function match(BankTransaction $bankTransaction): RedirectResponse
    {
        $bankTransaction->forceFill([
            'status' => 'matched',
            'matched_at' => now(),
        ])->save();

        return back()->with('success', 'Transaction marked as matched.');
    }

    public function unmatch(BankTransaction $bankTransaction): RedirectResponse
    {
        $bankTransaction->forceFill([
            'status' => 'unmatched',
            'matched_at' => null,
            'reconciliation_id' => null,
        ])->save();

        return back()->with('success', 'Transaction returned to the unmatched queue.');
    }

    public function storeReconciliation(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bank_account_id' => ['required', 'integer', 'exists:bank_accounts,id'],
            'statement_date' => ['required', 'date'],
            'statement_balance' => ['required', 'numeric'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $account = BankAccount::query()->findOrFail($data['bank_account_id']);
        $book = (float) $account->current_balance;

        BankReconciliation::create([
            'bank_account_id' => $account->id,
            'statement_date' => $data['statement_date'],
            'statement_balance' => $data['statement_balance'],
            'book_balance' => $book,
            'difference' => round((float) $data['statement_balance'] - $book, 2),
            'status' => 'draft',
            'started_by' => auth()->id(),
            'notes' => $data['notes'] ?? null,
        ]);

        return back()->with('success', 'Reconciliation started.');
    }

    public function completeReconciliation(BankReconciliation $bankReconciliation): RedirectResponse
    {
        $bankReconciliation->forceFill([
            'status' => 'completed',
            'completed_by' => auth()->id(),
            'completed_at' => now(),
        ])->save();

        BankTransaction::query()
            ->where('bank_account_id', $bankReconciliation->bank_account_id)
            ->where('status', 'matched')
            ->whereNull('reconciliation_id')
            ->update(['reconciliation_id' => $bankReconciliation->id]);

        return back()->with('success', 'Bank reconciliation completed.');
    }

    public function storeTransfer(Request $request): RedirectResponse
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

        return back()->with('success', "Bank transfer {$transfer->reference} completed and posted.");
    }
}
