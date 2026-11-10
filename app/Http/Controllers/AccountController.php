<?php

namespace App\Http\Controllers;

use App\Enums\AccountType;
use App\Http\Requests\Api\StoreAccountRequest;
use App\Http\Requests\Api\UpdateAccountRequest;
use App\Models\Account;
use App\Models\AccountingSetting;
use App\Models\BankAccount;
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

        $settings = AccountingSetting::instance();

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
            'settings' => [
                'default_cash_account_id' => $settings->default_cash_account_id,
                'default_bank_account_id' => $settings->default_bank_account_id,
                'default_sales_account_id' => $settings->default_sales_account_id,
                'default_receivable_account_id' => $settings->default_receivable_account_id,
                'default_payable_account_id' => $settings->default_payable_account_id,
                'inventory_control_account_id' => $settings->inventory_control_account_id,
                'cost_of_sales_account_id' => $settings->cost_of_sales_account_id,
                'retained_earnings_account_id' => $settings->retained_earnings_account_id,
                'opening_balance_account_id' => $settings->opening_balance_account_id,
                'opening_fiscal_year' => $settings->opening_fiscal_year,
                'opening_cash_balance' => (float) $settings->opening_cash_balance,
                'opening_inventory_value' => (float) $settings->opening_inventory_value,
                'outstanding_customer_balances' => (float) $settings->outstanding_customer_balances,
                'outstanding_supplier_balances' => (float) $settings->outstanding_supplier_balances,
                'existing_assets_value' => (float) $settings->existing_assets_value,
                'existing_liabilities_value' => (float) $settings->existing_liabilities_value,
                'share_capital' => (float) $settings->share_capital,
            ],
            'bankAccounts' => BankAccount::query()
                ->with('glAccount:id,code,name')
                ->orderBy('name')
                ->get()
                ->map(fn (BankAccount $bankAccount) => [
                    'id' => $bankAccount->id,
                    'name' => $bankAccount->name,
                    'account_number' => $bankAccount->account_number,
                    'bank_name' => $bankAccount->bank_name,
                    'gl_account' => $bankAccount->glAccount
                        ? [
                            'id' => $bankAccount->glAccount->id,
                            'code' => $bankAccount->glAccount->code,
                            'name' => $bankAccount->glAccount->name,
                        ]
                        : null,
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

    /**
     * Save the default ledger accounts used by automated postings.
     */
    public function updateConfiguration(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'default_cash_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'default_bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'default_sales_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'default_receivable_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'default_payable_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'inventory_control_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'cost_of_sales_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'retained_earnings_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'opening_balance_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        AccountingSetting::instance()
            ->forceFill(collect($data)
                ->map(fn ($value) => filled($value) ? (int) $value : null)
                ->all())
            ->save();

        return back()->with('success', 'Accounting configuration saved.');
    }

    /**
     * Save the opening financial position for the company.
     */
    public function updateFinancials(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'opening_fiscal_year' => ['nullable', 'integer', 'between:1900,2200'],
            'opening_cash_balance' => ['required', 'numeric', 'min:0'],
            'opening_inventory_value' => ['required', 'numeric', 'min:0'],
            'outstanding_customer_balances' => ['required', 'numeric', 'min:0'],
            'outstanding_supplier_balances' => ['required', 'numeric', 'min:0'],
            'existing_assets_value' => ['required', 'numeric', 'min:0'],
            'existing_liabilities_value' => ['required', 'numeric', 'min:0'],
            'share_capital' => ['required', 'numeric', 'min:0'],
        ]);

        AccountingSetting::instance()->forceFill([
            'opening_fiscal_year' => filled($data['opening_fiscal_year'] ?? null) ? (int) $data['opening_fiscal_year'] : null,
            'opening_cash_balance' => round((float) $data['opening_cash_balance'], 2),
            'opening_inventory_value' => round((float) $data['opening_inventory_value'], 2),
            'outstanding_customer_balances' => round((float) $data['outstanding_customer_balances'], 2),
            'outstanding_supplier_balances' => round((float) $data['outstanding_supplier_balances'], 2),
            'existing_assets_value' => round((float) $data['existing_assets_value'], 2),
            'existing_liabilities_value' => round((float) $data['existing_liabilities_value'], 2),
            'share_capital' => round((float) $data['share_capital'], 2),
        ])->save();

        return back()->with('success', 'Company financial information saved.');
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
        if (in_array($account->id, AccountingSetting::instance()->referencedAccountIds(), true)) {
            return back()->with('error', 'This account is used in the accounting configuration. Choose a different default before deleting it.');
        }

        if ($account->children()->exists() || $account->journalLines()->exists() || $account->invoiceItems()->exists()) {
            return back()->with('error', 'This account cannot be deleted because it has child accounts or posted transactions.');
        }

        $account->delete();

        return redirect()
            ->route('accounts.index')
            ->with('success', 'Account deleted.');
    }
}
