<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Budget;
use App\Models\Contact;
use App\Models\CostCenter;
use App\Models\Department;
use App\Models\Project;
use App\Services\Accounting\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public const REPORTS = [
        'trial-balance' => ['name' => 'Trial balance', 'description' => 'Every account with posted debits and credits.', 'group' => 'Financial statements'],
        'balance-sheet' => ['name' => 'Balance sheet', 'description' => 'Assets, liabilities and equity at a point in time.', 'group' => 'Financial statements'],
        'profit-loss' => ['name' => 'Profit & loss', 'description' => 'Revenue less expenses for a period.', 'group' => 'Financial statements'],
        'cash-flow' => ['name' => 'Cash flow', 'description' => 'Operating, investing and financing cash movements.', 'group' => 'Financial statements'],
        'general-ledger' => ['name' => 'General ledger', 'description' => 'Chronological detail and running balance by account.', 'group' => 'Ledger'],
        'sales' => ['name' => 'Sales report', 'description' => 'Invoices issued, tax, collections and balances by month and customer.', 'group' => 'Receivables & payables'],
        'expenses' => ['name' => 'Expense report', 'description' => 'Posted expense accounts and approved vendor bills by vendor.', 'group' => 'Receivables & payables'],
        'customer-statement' => ['name' => 'Customer statement', 'description' => 'Statement of account with invoices, receipts and credit notes.', 'group' => 'Receivables & payables'],
        'aging-receivable' => ['name' => 'AR ageing', 'description' => 'Outstanding customer balances by age bucket.', 'group' => 'Receivables & payables'],
        'aging-payable' => ['name' => 'AP ageing', 'description' => 'Outstanding vendor balances by age bucket.', 'group' => 'Receivables & payables'],
        'bank-reconciliation' => ['name' => 'Bank reconciliation', 'description' => 'Book, GL and statement balances with unmatched items by account.', 'group' => 'Banking & cash'],
        'fixed-asset-register' => ['name' => 'Fixed asset register', 'description' => 'Asset cost, accumulated depreciation and carrying values.', 'group' => 'Assets'],
        'vat' => ['name' => 'VAT / tax return', 'description' => 'Output VAT, input VAT and net liability.', 'group' => 'Tax'],
        'budget-vs-actual' => ['name' => 'Budget vs actual', 'description' => 'Compare budgeted and posted amounts.', 'group' => 'Planning'],
        'department' => ['name' => 'Department P&L', 'description' => 'Revenue and expense by department.', 'group' => 'Dimensions'],
        'project' => ['name' => 'Project P&L', 'description' => 'Revenue and expense by project.', 'group' => 'Dimensions'],
        'branch' => ['name' => 'Branch P&L', 'description' => 'Revenue and expense by branch.', 'group' => 'Dimensions'],
        'cost-center' => ['name' => 'Cost centre P&L', 'description' => 'Revenue and expense by cost centre.', 'group' => 'Dimensions'],
        'audit' => ['name' => 'Audit history', 'description' => 'Immutable trail of system activity.', 'group' => 'Controls'],
    ];

    public function __construct(private readonly LedgerService $ledger) {}

    public function index(): Response
    {
        return Inertia::render('Reports/Index', [
            'reports' => collect(self::REPORTS)
                ->map(fn (array $meta, string $key) => ['key' => $key] + $meta)
                ->values(),
        ]);
    }

    public function show(Request $request, string $report): Response
    {
        abort_unless(array_key_exists($report, self::REPORTS), 404);

        $from = $request->filled('from')
            ? Carbon::parse($request->date('from'))
            : Carbon::today()->startOfYear();
        $to = $request->filled('to')
            ? Carbon::parse($request->date('to'))
            : Carbon::today();

        $filters = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'account_id' => $request->integer('account_id') ?: null,
            'budget_id' => $request->integer('budget_id') ?: null,
            'dimension_id' => $request->integer('dimension_id') ?: null,
            'contact_id' => $request->integer('contact_id') ?: null,
        ];

        $data = match ($report) {
            'trial-balance' => $this->ledger->trialBalance($from, $to),
            'balance-sheet' => $this->ledger->balanceSheet($to),
            'profit-loss' => $this->ledger->profitAndLoss($from, $to),
            'cash-flow' => $this->ledger->cashFlow($from, $to),
            'general-ledger' => $this->ledger->generalLedger(
                $filters['account_id'] ?: (int) Account::query()->orderBy('code')->value('id'),
                $from,
                $to,
            ),
            'sales' => $this->ledger->salesReport($from, $to),
            'expenses' => $this->ledger->expenseReport($from, $to),
            'customer-statement' => $this->customerStatementReport($filters['contact_id'], $from, $to),
            'aging-receivable' => $this->ledger->aging('receivable', $to),
            'aging-payable' => $this->ledger->aging('payable', $to),
            'bank-reconciliation' => $this->ledger->bankReconciliationReport($to),
            'fixed-asset-register' => $this->ledger->fixedAssetRegister($to),
            'vat' => $this->ledger->vatReturn($from, $to),
            'budget-vs-actual' => $this->budgetReport($filters['budget_id']),
            'department', 'project', 'branch', 'cost-center' => $this->dimensionReport($report, $filters['dimension_id'], $from, $to),
            'audit' => ['logs' => $this->auditLogs()],
            default => [],
        };

        return Inertia::render('Reports/Show', [
            'report' => ['key' => $report] + self::REPORTS[$report],
            'data' => $data,
            'filters' => $filters,
            'options' => [
                'accounts' => Account::query()->orderBy('code')->get(['id', 'code', 'name']),
                'budgets' => Budget::query()->orderByDesc('fiscal_year')->get(['id', 'name', 'fiscal_year']),
                'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
                'projects' => Project::query()->orderBy('name')->get(['id', 'name']),
                'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
                'costCenters' => CostCenter::query()->orderBy('name')->get(['id', 'name']),
                'customers' => Contact::query()->customers()->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    private function budgetReport(?int $budgetId): array
    {
        $budget = $budgetId
            ? Budget::query()->find($budgetId)
            : Budget::query()->orderByDesc('fiscal_year')->first();

        return $budget ? $this->ledger->budgetVsActual($budget) : ['rows' => [], 'totals' => ['budget' => 0, 'actual' => 0, 'variance' => 0]];
    }

    private function customerStatementReport(?int $contactId, Carbon $from, Carbon $to): array
    {
        $resolved = $contactId ?: (int) Contact::query()->customers()->orderBy('name')->value('id');

        if (! $resolved) {
            return [
                'contact' => null,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'opening_balance' => 0,
                'rows' => [],
                'totals' => ['debit' => 0, 'credit' => 0, 'closing' => 0],
            ];
        }

        return $this->ledger->customerStatement($resolved, $from, $to);
    }

    private function dimensionReport(string $report, ?int $id, Carbon $from, Carbon $to): array
    {
        $model = match ($report) {
            'department' => Department::class,
            'project' => Project::class,
            'cost-center' => CostCenter::class,
            default => Branch::class,
        };

        $resolved = $id ?: (int) $model::query()->orderBy('name')->value('id');

        if (! $resolved) {
            return ['revenue' => [], 'expenses' => [], 'totals' => ['revenue' => 0, 'expenses' => 0, 'net_income' => 0]];
        }

        $dimension = match ($report) {
            'department' => 'department',
            'project' => 'project',
            'cost-center' => 'cost_center',
            default => 'branch',
        };

        return $this->ledger->dimensionProfitAndLoss($dimension, $resolved, $from, $to);
    }

    private function auditLogs(): array
    {
        return AuditLog::query()
            ->with('user:id,name')
            ->orderByDesc('id')
            ->limit(250)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'user' => $log->user?->name,
                'subject' => $log->auditable_type ? class_basename($log->auditable_type).' #'.$log->auditable_id : null,
                'created_at' => $log->created_at?->toIso8601String(),
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
            ])
            ->all();
    }
}
