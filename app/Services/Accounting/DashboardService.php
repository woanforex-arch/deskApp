<?php

namespace App\Services\Accounting;

use App\Enums\AccountType;
use App\Enums\InvoiceStatus;
use App\Enums\JournalEntryStatus;
use App\Models\Account;
use App\Models\Invoice;
use App\Models\JournalEntry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function __construct(private readonly LedgerService $ledger) {}

    /**
     * @return array<string, mixed>
     */
    public function metrics(): array
    {
        return Cache::remember('dashboard.metrics', now()->addMinutes(5), fn () => $this->buildMetrics());
    }

    /**
     * @return array<string, mixed>
     */
    private function buildMetrics(): array
    {
        $today = Carbon::today();
        $yearStart = $today->copy()->startOfYear();
        $ledger = $this->ledger->accountBalances();

        $cash = $ledger->firstWhere('code', '1100')?->balance() ?? 0.0;
        $expensesYtd = $ledger
            ->where('type', AccountType::Expense)
            ->sum(fn (Account $account) => $account->balance());

        $revenueYtd = (float) Invoice::query()
            ->where('status', '!=', InvoiceStatus::Void->value)
            ->whereDate('issue_date', '>=', $yearStart->toDateString())
            ->sum('total');

        $openInvoices = Invoice::query()->open();
        $receivables = (float) (clone $openInvoices)->sum(DB::raw('total - amount_paid'));

        $overdueQuery = Invoice::query()->where(function ($query) use ($today): void {
            $query->where('status', InvoiceStatus::Overdue->value)
                ->orWhere(function ($query) use ($today): void {
                    $query->where('status', InvoiceStatus::Sent->value)
                        ->whereDate('due_date', '<', $today->toDateString());
                });
        });

        $overdueCount = (clone $overdueQuery)->count();
        $overdueAmount = (float) (clone $overdueQuery)->sum(DB::raw('total - amount_paid'));

        $trialBalanceDebit = round((float) $ledger->sum(fn (Account $account) => (float) $account->total_debit), 2);
        $trialBalanceCredit = round((float) $ledger->sum(fn (Account $account) => (float) $account->total_credit), 2);

        return [
            'cash' => round($cash, 2),
            'revenue_ytd' => round($revenueYtd, 2),
            'expenses_ytd' => round($expensesYtd, 2),
            'receivables' => round($receivables, 2),
            'overdue_count' => $overdueCount,
            'overdue_amount' => round($overdueAmount, 2),
            'invoice_count' => Invoice::query()->where('status', '!=', InvoiceStatus::Void->value)->count(),
            'open_invoice_count' => (clone $openInvoices)->count(),
            'posted_entries' => JournalEntry::query()->where('status', JournalEntryStatus::Posted->value)->count(),
            'draft_entries' => JournalEntry::query()->where('status', JournalEntryStatus::Draft->value)->count(),
            'account_count' => Account::query()->count(),
            'monthly_revenue' => $this->monthlyRevenue($today),
            'recent_invoices' => $this->recentInvoices(),
            'expense_breakdown' => $this->expenseBreakdown($ledger),
            'trial_balance' => [
                'debit' => $trialBalanceDebit,
                'credit' => $trialBalanceCredit,
                'difference' => round($trialBalanceDebit - $trialBalanceCredit, 2),
                'balanced' => abs($trialBalanceDebit - $trialBalanceCredit) < 0.005,
            ],
        ];
    }

    /**
     * @return array<int, array{month: string, label: string, total: float}>
     */
    private function monthlyRevenue(Carbon $today): array
    {
        $start = $today->copy()->startOfMonth()->subMonths(5);

        $invoices = Invoice::query()
            ->where('status', '!=', InvoiceStatus::Void->value)
            ->whereDate('issue_date', '>=', $start->toDateString())
            ->get(['issue_date', 'total']);

        return collect(range(5, 0))
            ->map(function (int $monthsAgo) use ($invoices, $today): array {
                $month = $today->copy()->startOfMonth()->subMonths($monthsAgo);

                $total = $invoices
                    ->filter(fn (Invoice $invoice) => $invoice->issue_date?->isSameMonth($month))
                    ->sum(fn (Invoice $invoice) => (float) $invoice->total);

                return [
                    'month' => $month->format('M'),
                    'label' => $month->format('M Y'),
                    'total' => round($total, 2),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentInvoices(): array
    {
        return Invoice::query()
            ->with('contact:id,name')
            ->orderByDesc('issue_date')
            ->limit(6)
            ->get()
            ->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'contact' => $invoice->contact?->name,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'due_date' => $invoice->due_date?->toDateString(),
                'status' => $invoice->status->value,
                'status_label' => $invoice->status->label(),
                'total' => (float) $invoice->total,
                'balance_due' => $invoice->balanceDue(),
                'currency' => $invoice->currency,
            ])
            ->all();
    }

    /**
     * @param  Collection<int, Account>  $ledger
     * @return array<int, array{code: string, name: string, total: float}>
     */
    private function expenseBreakdown($ledger): array
    {
        return $ledger
            ->where('type', AccountType::Expense)
            ->map(fn (Account $account) => [
                'code' => $account->code,
                'name' => $account->name,
                'total' => $account->balance(),
            ])
            ->filter(fn (array $account) => $account['total'] > 0)
            ->sortByDesc('total')
            ->take(5)
            ->values()
            ->all();
    }
}
