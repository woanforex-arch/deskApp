<?php

namespace App\Http\Controllers;

use App\Enums\AccountType;
use App\Http\Requests\Api\StoreAccountRequest;
use App\Http\Requests\Api\UpdateAccountRequest;
use App\Models\Account;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::enum(AccountType::class)],
            'category' => ['nullable', 'string', 'max:60'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $accounts = Account::query()
            ->withSum('journalLines as total_debit', 'debit')
            ->withSum('journalLines as total_credit', 'credit')
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%"));
            })
            ->orderBy('code')
            ->get();

        $summary = collect(AccountType::cases())
            ->map(function (AccountType $type) use ($accounts): array {
                $ofType = $accounts->filter(fn (Account $account) => $account->type === $type);

                return [
                    'type' => $type->value,
                    'label' => $type->label(),
                    'count' => $ofType->count(),
                    'total' => round((float) $ofType->sum(fn (Account $account) => $account->balance()), 2),
                ];
            })
            ->values();

        return Inertia::render('Accounts/Index', [
            'accounts' => $accounts
                ->map(fn (Account $account) => [
                    'id' => $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'type' => $account->type->value,
                    'type_label' => $account->type->label(),
                    'normal_balance' => $account->normalBalance()->value,
                    'parent_id' => $account->parent_id,
                    'category' => $account->category,
                    'currency' => $account->currency,
                    'is_control' => (bool) $account->is_control,
                    'opening_balance' => (float) $account->opening_balance,
                    'description' => $account->description,
                    'is_active' => $account->is_active,
                    'balance' => $account->balance(),
                ])
                ->values(),
            'summary' => $summary,
            'filters' => [
                'type' => $filters['type'] ?? null,
                'category' => $filters['category'] ?? null,
                'search' => $filters['search'] ?? null,
            ],
            'types' => AccountType::options(),
            'categories' => $this->categories(),
            'parents' => Account::query()
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'type'])
                ->map(fn (Account $account) => [
                    'id' => $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'type' => $account->type->value,
                ])
                ->values(),
        ]);
    }

    /**
     * Common chart-of-account categories, merged with any custom categories
     * already stored so the picker stays useful without being restrictive.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function categories(): array
    {
        $defaults = [
            'cash' => 'Cash and cash equivalents',
            'receivable' => 'Receivables',
            'inventory' => 'Inventory',
            'fixed_asset' => 'Fixed assets',
            'current_asset' => 'Other current assets',
            'payable' => 'Payables',
            'tax' => 'Tax',
            'debt' => 'Debt and borrowings',
            'equity' => 'Equity',
            'revenue' => 'Revenue',
            'cost_of_sales' => 'Cost of sales',
            'operating_expense' => 'Operating expenses',
            'other_income' => 'Other income',
            'other_expense' => 'Other expenses',
        ];

        $stored = Account::query()
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        return collect($defaults)
            ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
            ->merge($stored
                ->reject(fn (string $category) => array_key_exists($category, $defaults))
                ->map(fn (string $category) => [
                    'value' => $category,
                    'label' => str($category)->replace(['_', '-'], ' ')->title()->toString(),
                ]))
            ->values()
            ->all();
    }

    public function store(StoreAccountRequest $request): RedirectResponse
    {
        $account = Account::create($request->validated());

        return redirect()
            ->route('accounts.index')
            ->with('success', "Account {$account->code} · {$account->name} created.");
    }

    public function update(UpdateAccountRequest $request, Account $account): RedirectResponse
    {
        $account->update($request->validated());

        return redirect()
            ->route('accounts.index')
            ->with('success', "Account {$account->code} updated.");
    }

    public function destroy(Account $account): RedirectResponse
    {
        if ($account->children()->exists() || $account->journalLines()->exists() || $account->invoiceItems()->exists()) {
            return back()->with('error', 'This account cannot be deleted because it has child accounts or posted transactions.');
        }

        $account->delete();

        return redirect()
            ->route('accounts.index')
            ->with('success', 'Account deleted.');
    }
}
