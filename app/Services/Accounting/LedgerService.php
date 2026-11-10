<?php

namespace App\Services\Accounting;

use App\Enums\AccountType;
use App\Enums\JournalEntryStatus;
use App\Models\Account;
use App\Models\BankAccount;
use App\Models\Bill;
use App\Models\Budget;
use App\Models\Contact;
use App\Models\CreditNote;
use App\Models\FixedAsset;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Payment;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LedgerService
{
    /**
     * Return every account with its posted debit, credit, and normal balance.
     *
     * @return Collection<int, Account>
     */
    public function accountBalances(?CarbonInterface $from = null, ?CarbonInterface $to = null): Collection
    {
        return Account::query()
            ->withSum(['journalLines as total_debit' => fn (Builder $query) => $this->constrainPostedLines($query, $from, $to)], 'debit')
            ->withSum(['journalLines as total_credit' => fn (Builder $query) => $this->constrainPostedLines($query, $from, $to)], 'credit')
            ->orderBy('code')
            ->get();
    }

    /**
     * @return array{
     *     accounts: array<int, array<string, mixed>>,
     *     totals: array{debit: float, credit: float, difference: float, balanced: bool}
     * }
     */
    public function trialBalance(?CarbonInterface $from = null, ?CarbonInterface $to = null): array
    {
        $accounts = $this->accountBalances($from, $to)
            ->map(fn (Account $account) => [
                'id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type->value,
                'type_label' => $account->type->label(),
                'debit' => round((float) $account->total_debit, 2),
                'credit' => round((float) $account->total_credit, 2),
                'balance' => $account->balance(),
            ])
            ->values();

        $debit = round((float) $accounts->sum('debit'), 2);
        $credit = round((float) $accounts->sum('credit'), 2);
        $difference = round($debit - $credit, 2);

        return [
            'accounts' => $accounts->all(),
            'totals' => [
                'debit' => $debit,
                'credit' => $credit,
                'difference' => $difference,
                'balanced' => abs($difference) < 0.005,
            ],
        ];
    }

    /**
     * @return array{
     *     from: string,
     *     to: string,
     *     revenue: array<int, array<string, mixed>>,
     *     expenses: array<int, array<string, mixed>>,
     *     totals: array{revenue: float, expenses: float, net_income: float}
     * }
     */
    public function profitAndLoss(CarbonInterface $from, CarbonInterface $to): array
    {
        $accounts = $this->accountBalances($from, $to);

        $revenue = $accounts
            ->where('type', AccountType::Revenue)
            ->map(fn (Account $account) => $this->reportLine($account))
            ->values();

        $expenses = $accounts
            ->where('type', AccountType::Expense)
            ->map(fn (Account $account) => $this->reportLine($account))
            ->values();

        $totalRevenue = round((float) $revenue->sum('amount'), 2);
        $totalExpenses = round((float) $expenses->sum('amount'), 2);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => $revenue->all(),
            'expenses' => $expenses->all(),
            'totals' => [
                'revenue' => $totalRevenue,
                'expenses' => $totalExpenses,
                'net_income' => round($totalRevenue - $totalExpenses, 2),
            ],
        ];
    }

    /**
     * Balance sheet as of a given date. Revenue and expense balances are
     * presented as current-period earnings inside equity so the statement
     * balances before year-end close.
     *
     * @return array<string, mixed>
     */
    public function balanceSheet(?CarbonInterface $asOf = null): array
    {
        $asOf ??= Carbon::today();
        $accounts = $this->accountBalances(null, $asOf);

        $assets = $accounts->where('type', AccountType::Asset)
            ->map(fn (Account $account) => $this->reportLine($account))->values();
        $liabilities = $accounts->where('type', AccountType::Liability)
            ->map(fn (Account $account) => $this->reportLine($account))->values();
        $equity = $accounts->where('type', AccountType::Equity)
            ->map(fn (Account $account) => $this->reportLine($account))->values();

        $netIncome = round(
            $accounts->where('type', AccountType::Revenue)->sum(fn (Account $account) => $account->balance())
            - $accounts->where('type', AccountType::Expense)->sum(fn (Account $account) => $account->balance()),
            2,
        );

        if (abs($netIncome) > 0.004) {
            $equity->push(['code' => '3900', 'name' => 'Current period earnings', 'amount' => $netIncome]);
        }

        $totalAssets = round((float) $assets->sum('amount'), 2);
        $totalLiabilities = round((float) $liabilities->sum('amount'), 2);
        $totalEquity = round((float) $equity->sum('amount'), 2);

        return [
            'as_of' => $asOf->toDateString(),
            'assets' => $assets->all(),
            'liabilities' => $liabilities->all(),
            'equity' => $equity->all(),
            'totals' => [
                'assets' => $totalAssets,
                'liabilities' => $totalLiabilities,
                'equity' => $totalEquity,
                'liabilities_and_equity' => round($totalLiabilities + $totalEquity, 2),
                'difference' => round($totalAssets - $totalLiabilities - $totalEquity, 2),
                'balanced' => abs($totalAssets - $totalLiabilities - $totalEquity) < 0.005,
            ],
        ];
    }

    /**
     * Direct-method cash flow statement built from movements in cash accounts.
     *
     * @return array<string, mixed>
     */
    public function cashFlow(CarbonInterface $from, CarbonInterface $to): array
    {
        $cashIds = $this->cashAccountIds();
        $sections = [
            'operating' => [],
            'investing' => [],
            'financing' => [],
        ];

        $entries = JournalEntry::query()
            ->where('status', JournalEntryStatus::Posted->value)
            ->whereDate('entry_date', '>=', $from->toDateString())
            ->whereDate('entry_date', '<=', $to->toDateString())
            ->whereHas('lines', fn (Builder $query) => $query->whereIn('account_id', $cashIds))
            ->with(['lines.account'])
            ->orderBy('entry_date')
            ->get();

        foreach ($entries as $entry) {
            $cashLines = $entry->lines->whereIn('account_id', $cashIds);
            $change = round((float) $cashLines->sum('debit') - (float) $cashLines->sum('credit'), 2);

            if (abs($change) < 0.005) {
                continue;
            }

            $counterTypes = $entry->lines
                ->whereNotIn('account_id', $cashIds)
                ->map(fn ($line) => $line->account?->type)
                ->filter();

            $category = 'operating';
            if ($counterTypes->contains(AccountType::Liability) || $counterTypes->contains(AccountType::Equity)) {
                $category = 'financing';
            } elseif ($counterTypes->contains(AccountType::Asset)) {
                $category = 'investing';
            }

            $sections[$category][] = [
                'date' => $entry->entry_date?->toDateString(),
                'reference' => $entry->reference,
                'memo' => $entry->memo,
                'amount' => $change,
            ];
        }

        $opening = $this->cashBalanceBefore($from, $cashIds);
        $totals = [];
        foreach ($sections as $key => $items) {
            $totals[$key] = round((float) collect($items)->sum('amount'), 2);
        }
        $netChange = round(array_sum($totals), 2);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'opening_cash' => $opening,
            'sections' => collect($sections)->map(fn (array $items, string $key) => [
                'key' => $key,
                'label' => ucfirst($key).' activities',
                'items' => $items,
                'total' => $totals[$key],
            ])->values()->all(),
            'net_change' => $netChange,
            'closing_cash' => round($opening + $netChange, 2),
        ];
    }

    /**
     * Opening cash balance across all cash and bank accounts.
     *
     * @param  array<int, int>  $cashIds
     */
    private function cashBalanceBefore(CarbonInterface $date, array $cashIds): float
    {
        if ($cashIds === []) {
            return 0.0;
        }

        $debit = (float) \App\Models\JournalLine::query()
            ->whereIn('account_id', $cashIds)
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '<', $date->toDateString()))
            ->sum('debit');
        $credit = (float) \App\Models\JournalLine::query()
            ->whereIn('account_id', $cashIds)
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '<', $date->toDateString()))
            ->sum('credit');

        return round($debit - $credit, 2);
    }

    /**
     * @return array<int, int>
     */
    private function cashAccountIds(): array
    {
        return Account::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('code', ['1100', '1110', '1120'])
                ->orWhere('category', 'cash'))
            ->pluck('id')
            ->all();
    }

    /**
     * Chronological ledger detail for one account with a running balance.
     *
     * @return array<string, mixed>
     */
    public function generalLedger(int $accountId, CarbonInterface $from, CarbonInterface $to): array
    {
        $account = Account::query()->findOrFail($accountId);
        $creditNormal = ! $account->type->isDebitNormal();

        $opening = $account->journalLines()
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '<', $from->toDateString()))
            ->selectRaw('COALESCE(SUM(debit), 0) as debit, COALESCE(SUM(credit), 0) as credit')
            ->first();

        $openingBalance = $creditNormal
            ? round((float) $opening->credit - (float) $opening->debit, 2)
            : round((float) $opening->debit - (float) $opening->credit, 2);

        $lines = $account->journalLines()
            ->with('journalEntry')
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '>=', $from->toDateString())
                ->whereDate('entry_date', '<=', $to->toDateString()))
            ->get()
            ->sortBy(fn ($line) => ($line->journalEntry?->entry_date?->toDateString() ?? '').'-'.str_pad((string) $line->id, 10, '0', STR_PAD_LEFT))
            ->values();

        $running = $openingBalance;
        $rows = $lines->map(function ($line) use (&$running, $creditNormal) {
            $movement = $creditNormal
                ? (float) $line->credit - (float) $line->debit
                : (float) $line->debit - (float) $line->credit;
            $running = round($running + $movement, 2);

            return [
                'id' => $line->id,
                'date' => $line->journalEntry?->entry_date?->toDateString(),
                'reference' => $line->journalEntry?->reference,
                'memo' => $line->journalEntry?->memo,
                'description' => $line->description,
                'debit' => round((float) $line->debit, 2),
                'credit' => round((float) $line->credit, 2),
                'balance' => $running,
            ];
        });

        return [
            'account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name, 'type' => $account->type->label()],
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'opening_balance' => $openingBalance,
            'lines' => $rows->all(),
            'totals' => [
                'debit' => round((float) $rows->sum('debit'), 2),
                'credit' => round((float) $rows->sum('credit'), 2),
                'closing' => $running,
            ],
        ];
    }

    /**
     * Ageing analysis for receivables or payables.
     *
     * @return array<string, mixed>
     */
    public function aging(string $type = 'receivable', ?CarbonInterface $asOf = null): array
    {
        $asOf ??= Carbon::today();
        $buckets = [
            'current' => ['label' => 'Current', 'min' => null, 'max' => 0, 'total' => 0.0],
            'days_1_30' => ['label' => '1–30 days', 'min' => 1, 'max' => 30, 'total' => 0.0],
            'days_31_60' => ['label' => '31–60 days', 'min' => 31, 'max' => 60, 'total' => 0.0],
            'days_61_90' => ['label' => '61–90 days', 'min' => 61, 'max' => 90, 'total' => 0.0],
            'days_over_90' => ['label' => '90+ days', 'min' => 91, 'max' => null, 'total' => 0.0],
        ];

        $rows = [];

        if ($type === 'payable') {
            $documents = Bill::query()->with('contact')
                ->whereIn('status', ['approved', 'partial'])
                ->where('total', '>', 0)
                ->get();
        } else {
            $documents = Invoice::query()->with('contact')
                ->whereIn('status', ['sent', 'overdue'])
                ->get();
        }

        foreach ($documents as $document) {
            $balance = $document->balanceDue();
            if ($balance <= 0.005) {
                continue;
            }

            $due = $document->due_date;
            $days = $due ? (int) $due->diffInDays($asOf, false) : 0;
            $bucket = 'current';
            foreach ($buckets as $key => $definition) {
                if ($definition['min'] !== null && $days >= $definition['min']
                    && ($definition['max'] === null || $days <= $definition['max'])) {
                    $bucket = $key;
                    break;
                }
            }
            if ($days <= 0) {
                $bucket = 'current';
            }

            $buckets[$bucket]['total'] = round($buckets[$bucket]['total'] + $balance, 2);

            $name = $document->contact?->name ?? 'Unknown';
            $rows[$name] ??= [
                'contact' => $name,
                'current' => 0.0,
                'days_1_30' => 0.0,
                'days_31_60' => 0.0,
                'days_61_90' => 0.0,
                'days_over_90' => 0.0,
                'total' => 0.0,
                'documents' => [],
            ];
            $rows[$name][$bucket] = round($rows[$name][$bucket] + $balance, 2);
            $rows[$name]['total'] = round($rows[$name]['total'] + $balance, 2);
            $rows[$name]['documents'][] = [
                'id' => $document->id,
                'number' => $document->number,
                'due_date' => $due?->toDateString(),
                'days_overdue' => max($days, 0),
                'balance' => $balance,
                'currency' => $document->currency,
            ];
        }

        $rows = collect($rows)->sortByDesc('total')->values();

        return [
            'type' => $type,
            'as_of' => $asOf->toDateString(),
            'buckets' => collect($buckets)->values()->all(),
            'rows' => $rows->all(),
            'totals' => [
                'current' => round((float) $rows->sum('current'), 2),
                'days_1_30' => round((float) $rows->sum('days_1_30'), 2),
                'days_31_60' => round((float) $rows->sum('days_31_60'), 2),
                'days_61_90' => round((float) $rows->sum('days_61_90'), 2),
                'days_over_90' => round((float) $rows->sum('days_over_90'), 2),
                'total' => round((float) $rows->sum('total'), 2),
            ],
        ];
    }

    /**
     * VAT / tax return summary for a period.
     *
     * @return array<string, mixed>
     */
    public function vatReturn(CarbonInterface $from, CarbonInterface $to): array
    {
        $outputDebit = $this->sumAccount($this->accountByCode('2200'), 'debit', $from, $to);
        $outputCredit = $this->sumAccount($this->accountByCode('2200'), 'credit', $from, $to);
        $inputDebit = $this->sumAccount($this->accountByCode('1600'), 'debit', $from, $to);
        $inputCredit = $this->sumAccount($this->accountByCode('1600'), 'credit', $from, $to);

        $outputTax = round($outputCredit - $outputDebit, 2);
        $inputTax = round($inputDebit - $inputCredit, 2);
        $net = round($outputTax - $inputTax, 2);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'output_tax' => $outputTax,
            'input_tax' => $inputTax,
            'net_payable' => $net,
            'status' => $net >= 0 ? 'payable' : 'refundable',
        ];
    }

    private function accountByCode(string $code): ?Account
    {
        return Account::query()->where('code', $code)->first();
    }

    private function sumAccount(?Account $account, string $column, CarbonInterface $from, CarbonInterface $to): float
    {
        if (! $account) {
            return 0.0;
        }

        return round((float) $account->journalLines()
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '>=', $from->toDateString())
                ->whereDate('entry_date', '<=', $to->toDateString()))
            ->sum($column), 2);
    }

    /**
     * Budget versus actual for a single budget.
     *
     * @return array<string, mixed>
     */
    public function budgetVsActual(Budget $budget): array
    {
        $yearStart = Carbon::create($budget->fiscal_year, 1, 1)->startOfDay();
        $yearEnd = Carbon::create($budget->fiscal_year, 12, 31)->endOfDay();

        $lines = $budget->lines()->with('account')->get()->groupBy('account_id');

        $rows = $lines->map(function (Collection $group) use ($yearStart, $yearEnd) {
            $account = $group->first()->account;
            $budgetAmount = round((float) $group->sum('amount'), 2);
            $actual = $account ? $this->accountMovement($account, $yearStart, $yearEnd) : 0.0;

            return [
                'account_id' => $account?->id,
                'code' => $account?->code,
                'name' => $account?->name,
                'type' => $account?->type->label(),
                'budget' => $budgetAmount,
                'actual' => $actual,
                'variance' => round($budgetAmount - $actual, 2),
                'variance_percent' => $budgetAmount != 0 ? round((($budgetAmount - $actual) / abs($budgetAmount)) * 100, 1) : 0.0,
            ];
        })->sortBy('code')->values();

        return [
            'budget' => [
                'id' => $budget->id,
                'name' => $budget->name,
                'fiscal_year' => $budget->fiscal_year,
                'status' => $budget->status,
            ],
            'rows' => $rows->all(),
            'totals' => [
                'budget' => round((float) $rows->sum('budget'), 2),
                'actual' => round((float) $rows->sum('actual'), 2),
                'variance' => round((float) $rows->sum('variance'), 2),
            ],
        ];
    }

    /**
     * Actual movement on an account within a date range, expressed in the
     * account's normal direction.
     */
    private function accountMovement(Account $account, CarbonInterface $from, CarbonInterface $to): float
    {
        $query = $account->journalLines()
            ->whereHas('journalEntry', fn (Builder $builder) => $builder
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '>=', $from->toDateString())
                ->whereDate('entry_date', '<=', $to->toDateString()));

        $debit = (float) (clone $query)->sum('debit');
        $credit = (float) (clone $query)->sum('credit');

        return round($account->type->isDebitNormal() ? $debit - $credit : $credit - $debit, 2);
    }

    /**
     * Profit and loss sliced by a dimension (department, project, branch or
     * cost centre).
     *
     * @return array<string, mixed>
     */
    public function dimensionProfitAndLoss(string $dimension, int $id, CarbonInterface $from, CarbonInterface $to): array
    {
        $column = match ($dimension) {
            'department' => 'department_id',
            'project' => 'project_id',
            'branch' => 'branch_id',
            'cost_center' => 'cost_center_id',
            default => 'department_id',
        };

        $lines = \App\Models\JournalLine::query()
            ->with('account')
            ->where($column, $id)
            ->whereHas('journalEntry', fn (Builder $query) => $query
                ->where('status', JournalEntryStatus::Posted->value)
                ->whereDate('entry_date', '>=', $from->toDateString())
                ->whereDate('entry_date', '<=', $to->toDateString()))
            ->whereHas('account', fn (Builder $query) => $query->whereIn('type', [AccountType::Revenue->value, AccountType::Expense->value]))
            ->get()
            ->groupBy('account_id');

        $revenue = [];
        $expenses = [];

        foreach ($lines as $group) {
            $account = $group->first()->account;
            if (! $account) {
                continue;
            }
            $amount = $account->type->isDebitNormal()
                ? round((float) $group->sum('debit') - (float) $group->sum('credit'), 2)
                : round((float) $group->sum('credit') - (float) $group->sum('debit'), 2);

            if ($account->type === AccountType::Revenue) {
                $revenue[] = ['code' => $account->code, 'name' => $account->name, 'amount' => $amount];
            } else {
                $expenses[] = ['code' => $account->code, 'name' => $account->name, 'amount' => $amount];
            }
        }

        $totalRevenue = round((float) collect($revenue)->sum('amount'), 2);
        $totalExpenses = round((float) collect($expenses)->sum('amount'), 2);

        return [
            'dimension' => $dimension,
            'id' => $id,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => $revenue,
            'expenses' => $expenses,
            'totals' => [
                'revenue' => $totalRevenue,
                'expenses' => $totalExpenses,
                'net_income' => round($totalRevenue - $totalExpenses, 2),
            ],
        ];
    }

    /**
     * Sales analysis for invoices issued inside a period, with monthly and
     * customer summaries.
     *
     * @return array<string, mixed>
     */
    public function salesReport(CarbonInterface $from, CarbonInterface $to): array
    {
        $invoices = Invoice::query()
            ->with('contact')
            ->whereDate('issue_date', '>=', $from->toDateString())
            ->whereDate('issue_date', '<=', $to->toDateString())
            ->whereNotIn('status', ['draft', 'void'])
            ->orderBy('issue_date')
            ->orderBy('number')
            ->get();

        $rows = $invoices->map(fn (Invoice $invoice) => [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'date' => $invoice->issue_date?->toDateString(),
            'due_date' => $invoice->due_date?->toDateString(),
            'customer' => $invoice->contact?->name ?? 'Unknown',
            'status' => $invoice->status->value,
            'currency' => $invoice->currency,
            'subtotal' => round((float) $invoice->subtotal, 2),
            'tax' => round((float) $invoice->tax_total, 2),
            'total' => round((float) $invoice->total, 2),
            'paid' => round((float) $invoice->amount_paid, 2),
            'balance' => $invoice->balanceDue(),
        ]);

        $monthly = $rows
            ->groupBy(fn (array $row) => substr((string) $row['date'], 0, 7))
            ->map(fn (Collection $group, string $month) => [
                'month' => $month,
                'invoices' => $group->count(),
                'subtotal' => round((float) $group->sum('subtotal'), 2),
                'tax' => round((float) $group->sum('tax'), 2),
                'total' => round((float) $group->sum('total'), 2),
                'paid' => round((float) $group->sum('paid'), 2),
            ])
            ->sortBy('month')
            ->values();

        $byCustomer = $rows
            ->groupBy('customer')
            ->map(fn (Collection $group, string $customer) => [
                'customer' => $customer,
                'invoices' => $group->count(),
                'subtotal' => round((float) $group->sum('subtotal'), 2),
                'tax' => round((float) $group->sum('tax'), 2),
                'total' => round((float) $group->sum('total'), 2),
                'paid' => round((float) $group->sum('paid'), 2),
                'balance' => round((float) $group->sum('balance'), 2),
            ])
            ->sortByDesc('total')
            ->values();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'rows' => $rows->all(),
            'monthly' => $monthly->all(),
            'by_customer' => $byCustomer->all(),
            'totals' => [
                'count' => $rows->count(),
                'subtotal' => round((float) $rows->sum('subtotal'), 2),
                'tax' => round((float) $rows->sum('tax'), 2),
                'total' => round((float) $rows->sum('total'), 2),
                'paid' => round((float) $rows->sum('paid'), 2),
                'balance' => round((float) $rows->sum('balance'), 2),
            ],
        ];
    }

    /**
     * Spend analysis from posted expense accounts and approved vendor bills.
     *
     * @return array<string, mixed>
     */
    public function expenseReport(CarbonInterface $from, CarbonInterface $to): array
    {
        $byAccount = $this->accountBalances($from, $to)
            ->where('type', AccountType::Expense)
            ->map(fn (Account $account) => $this->reportLine($account))
            ->filter(fn (array $line) => abs($line['amount']) > 0.004)
            ->sortBy('code')
            ->values();

        $bills = Bill::query()
            ->with('contact')
            ->whereDate('bill_date', '>=', $from->toDateString())
            ->whereDate('bill_date', '<=', $to->toDateString())
            ->whereNotIn('status', ['draft', 'void', 'pending_approval'])
            ->orderBy('bill_date')
            ->get();

        $byVendor = $bills
            ->groupBy(fn (Bill $bill) => $bill->contact?->name ?? 'Unknown')
            ->map(fn (Collection $group, string $vendor) => [
                'vendor' => $vendor,
                'bills' => $group->count(),
                'subtotal' => round((float) $group->sum('subtotal'), 2),
                'tax' => round((float) $group->sum('tax_total'), 2),
                'total' => round((float) $group->sum('total'), 2),
                'paid' => round((float) $group->sum('amount_paid'), 2),
            ])
            ->sortByDesc('total')
            ->values();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'by_account' => $byAccount->all(),
            'by_vendor' => $byVendor->all(),
            'totals' => [
                'expenses' => round((float) $byAccount->sum('amount'), 2),
                'bills' => $bills->count(),
                'bill_total' => round((float) $bills->sum('total'), 2),
                'bill_paid' => round((float) $bills->sum('amount_paid'), 2),
            ],
        ];
    }

    /**
     * Fixed asset register with cost, accumulated depreciation and carrying
     * value totals.
     *
     * @return array<string, mixed>
     */
    public function fixedAssetRegister(?CarbonInterface $asOf = null): array
    {
        $asOf ??= Carbon::today();

        $assets = FixedAsset::query()
            ->orderBy('code')
            ->get()
            ->map(fn (FixedAsset $asset) => [
                'id' => $asset->id,
                'code' => $asset->code,
                'name' => $asset->name,
                'category' => $asset->category,
                'purchase_date' => $asset->purchase_date?->toDateString(),
                'cost' => round((float) $asset->cost, 2),
                'salvage_value' => round((float) $asset->salvage_value, 2),
                'useful_life_years' => (int) $asset->useful_life_years,
                'depreciation_method' => $asset->depreciation_method,
                'accumulated_depreciation' => round((float) $asset->accumulated_depreciation, 2),
                'book_value' => round((float) $asset->book_value, 2),
                'status' => $asset->status,
                'location' => $asset->location,
                'monthly_depreciation' => $asset->monthlyDepreciation(),
            ]);

        return [
            'as_of' => $asOf->toDateString(),
            'rows' => $assets->all(),
            'totals' => [
                'assets' => $assets->count(),
                'cost' => round((float) $assets->sum('cost'), 2),
                'accumulated_depreciation' => round((float) $assets->sum('accumulated_depreciation'), 2),
                'book_value' => round((float) $assets->sum('book_value'), 2),
                'monthly_depreciation' => round((float) $assets->sum('monthly_depreciation'), 2),
            ],
        ];
    }

    /**
     * Bank reconciliation position for every bank account.
     *
     * @return array<string, mixed>
     */
    public function bankReconciliationReport(?CarbonInterface $asOf = null): array
    {
        $asOf ??= Carbon::today();

        $accounts = BankAccount::query()
            ->with('glAccount')
            ->orderBy('name')
            ->get()
            ->map(function (BankAccount $account) use ($asOf) {
                $last = $account->reconciliations()
                    ->whereDate('statement_date', '<=', $asOf->toDateString())
                    ->orderByDesc('statement_date')
                    ->first();

                $unmatched = $account->transactions()->where('status', 'unmatched')->get();

                return [
                    'id' => $account->id,
                    'name' => $account->name,
                    'bank_name' => $account->bank_name,
                    'account_number' => $account->account_number,
                    'currency' => $account->currency,
                    'gl_account' => $account->glAccount ? $account->glAccount->code.' · '.$account->glAccount->name : null,
                    'book_balance' => round((float) $account->current_balance, 2),
                    'gl_balance' => $account->glAccount?->balance() ?? 0.0,
                    'statement_balance' => round((float) ($last?->statement_balance ?? $account->current_balance), 2),
                    'reconciliation_status' => $last?->status ?? 'not_started',
                    'last_reconciled_at' => $last?->statement_date?->toDateString(),
                    'unmatched_count' => $unmatched->count(),
                    'unmatched_amount' => round((float) $unmatched->sum(fn ($transaction) => abs((float) $transaction->amount)), 2),
                ];
            });

        return [
            'as_of' => $asOf->toDateString(),
            'rows' => $accounts->all(),
            'totals' => [
                'accounts' => $accounts->count(),
                'book_balance' => round((float) $accounts->sum('book_balance'), 2),
                'gl_balance' => round((float) $accounts->sum('gl_balance'), 2),
                'statement_balance' => round((float) $accounts->sum('statement_balance'), 2),
                'unmatched' => (int) $accounts->sum('unmatched_count'),
                'difference' => round((float) $accounts->sum('book_balance') - (float) $accounts->sum('statement_balance'), 2),
            ],
        ];
    }

    /**
     * Customer statement of account: opening balance, invoices, receipts and
     * credit notes in the period, with a running balance.
     *
     * @return array<string, mixed>
     */
    public function customerStatement(int $contactId, CarbonInterface $from, CarbonInterface $to): array
    {
        $contact = Contact::query()->findOrFail($contactId);

        $invoiceBefore = round((float) Invoice::query()
            ->where('contact_id', $contactId)
            ->whereDate('issue_date', '<', $from->toDateString())
            ->whereNotIn('status', ['draft', 'void'])
            ->sum('total'), 2);
        $paymentBefore = round((float) Payment::query()
            ->where('contact_id', $contactId)
            ->whereDate('paid_on', '<', $from->toDateString())
            ->sum('amount'), 2);
        $creditBefore = round((float) CreditNote::query()
            ->where('contact_id', $contactId)
            ->where('type', 'sales')
            ->where('status', 'posted')
            ->whereDate('issue_date', '<', $from->toDateString())
            ->sum('total'), 2);
        $opening = round($invoiceBefore - $paymentBefore - $creditBefore, 2);

        $invoices = Invoice::query()
            ->where('contact_id', $contactId)
            ->whereDate('issue_date', '>=', $from->toDateString())
            ->whereDate('issue_date', '<=', $to->toDateString())
            ->whereNotIn('status', ['draft', 'void'])
            ->orderBy('issue_date')
            ->get();

        $payments = Payment::query()
            ->where('contact_id', $contactId)
            ->whereDate('paid_on', '>=', $from->toDateString())
            ->whereDate('paid_on', '<=', $to->toDateString())
            ->orderBy('paid_on')
            ->get();

        $credits = CreditNote::query()
            ->where('contact_id', $contactId)
            ->where('type', 'sales')
            ->where('status', 'posted')
            ->whereDate('issue_date', '>=', $from->toDateString())
            ->whereDate('issue_date', '<=', $to->toDateString())
            ->orderBy('issue_date')
            ->get();

        $rows = collect();

        foreach ($invoices as $invoice) {
            $rows->push([
                'date' => $invoice->issue_date?->toDateString(),
                'type' => 'Invoice',
                'reference' => $invoice->number,
                'description' => 'Invoice issued · due '.($invoice->due_date?->toDateString() ?? '—'),
                'debit' => round((float) $invoice->total, 2),
                'credit' => 0.0,
            ]);
        }

        foreach ($payments as $payment) {
            $rows->push([
                'date' => $payment->paid_on?->toDateString(),
                'type' => 'Receipt',
                'reference' => $payment->receipt_number ?? $payment->reference,
                'description' => 'Payment received'.($payment->reference ? ' · '.$payment->reference : ''),
                'debit' => 0.0,
                'credit' => round((float) $payment->amount, 2),
            ]);
        }

        foreach ($credits as $credit) {
            $rows->push([
                'date' => $credit->issue_date?->toDateString(),
                'type' => 'Credit note',
                'reference' => $credit->number,
                'description' => $credit->reason ?? 'Credit note issued',
                'debit' => 0.0,
                'credit' => round((float) $credit->total, 2),
            ]);
        }

        $running = $opening;
        $rows = $rows
            ->sortBy(fn (array $row) => (string) $row['date'].'|'.$row['reference'])
            ->values()
            ->map(function (array $row) use (&$running) {
                $running = round($running + $row['debit'] - $row['credit'], 2);
                $row['balance'] = $running;

                return $row;
            });

        $debit = round((float) $rows->sum('debit'), 2);
        $credit = round((float) $rows->sum('credit'), 2);

        return [
            'contact' => [
                'id' => $contact->id,
                'name' => $contact->name,
                'email' => $contact->email,
                'phone' => $contact->phone,
                'address' => $contact->address,
                'city' => $contact->city,
                'country' => $contact->country,
                'tax_number' => $contact->tax_number,
            ],
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'opening_balance' => $opening,
            'rows' => $rows->all(),
            'totals' => [
                'debit' => $debit,
                'credit' => $credit,
                'closing' => round($opening + $debit - $credit, 2),
            ],
        ];
    }

    /**
     * @return array{code: string, name: string, amount: float}
     */
    private function reportLine(Account $account): array
    {
        return [
            'code' => $account->code,
            'name' => $account->name,
            'amount' => $account->balance(),
        ];
    }

    private function constrainPostedLines(Builder $query, ?CarbonInterface $from, ?CarbonInterface $to): Builder
    {
        return $query->whereHas('journalEntry', function (Builder $entry) use ($from, $to): void {
            $entry->where('status', JournalEntryStatus::Posted->value)
                ->when($from, fn (Builder $query) => $query->whereDate('entry_date', '>=', $from->toDateString()))
                ->when($to, fn (Builder $query) => $query->whereDate('entry_date', '<=', $to->toDateString()));
        });
    }
}
