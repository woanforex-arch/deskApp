<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Cashbook;
use App\Models\CashTransaction;
use App\Models\Contact;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CashbookController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'cashbook_id' => ['nullable', 'integer', 'exists:cashbooks,id'],
        ]);

        $cashbooks = Cashbook::query()
            ->with('glAccount:id,code,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Cashbook $cashbook) => [
                'id' => $cashbook->id,
                'name' => $cashbook->name,
                'code' => $cashbook->code,
                'type' => $cashbook->type,
                'currency' => $cashbook->currency,
                'balance' => (float) $cashbook->balance,
                'custodian' => $cashbook->custodian,
                'gl_account' => $cashbook->glAccount ? $cashbook->glAccount->code.' · '.$cashbook->glAccount->name : null,
                'is_active' => $cashbook->is_active,
            ]);

        $transactions = CashTransaction::query()
            ->with(['cashbook:id,name,currency', 'contact:id,name'])
            ->when($filters['cashbook_id'] ?? null, fn ($query, $id) => $query->where('cashbook_id', $id))
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (CashTransaction $transaction) => [
                'id' => $transaction->id,
                'cashbook' => $transaction->cashbook?->name,
                'transaction_date' => $transaction->transaction_date?->toDateString(),
                'type' => $transaction->type,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->cashbook?->currency,
                'description' => $transaction->description,
                'reference' => $transaction->reference,
                'contact' => $transaction->contact?->name,
            ]);

        return Inertia::render('Cashbooks/Index', [
            'cashbooks' => $cashbooks,
            'transactions' => $transactions,
            'filters' => ['cashbook_id' => $filters['cashbook_id'] ?? null],
            'stats' => [
                'cash' => round((float) Cashbook::query()->where('type', 'cash')->sum('balance'), 2),
                'petty' => round((float) Cashbook::query()->where('type', 'petty')->sum('balance'), 2),
                'funds' => round((float) Cashbook::query()->sum('balance'), 2),
                'transactions' => CashTransaction::query()->count(),
            ],
            'glAccounts' => Account::query()->where('type', 'asset')->orderBy('code')->get(['id', 'code', 'name']),
            'contacts' => Contact::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
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

        Cashbook::create([
            ...$data,
            'currency' => $data['currency'] ?? 'USD',
            'balance' => $data['balance'] ?? 0,
            'is_active' => true,
        ]);

        return back()->with('success', 'Cashbook created.');
    }

    public function storeTransaction(Request $request): RedirectResponse
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

        $transaction = DB::transaction(function () use ($data): CashTransaction {
            $transaction = CashTransaction::create([...$data, 'created_by' => auth()->id()]);
            $this->posting->postCashTransaction($transaction->refresh());

            return $transaction->refresh();
        });

        return back()->with('success', "Cash transaction {$transaction->reference} posted.");
    }
}
