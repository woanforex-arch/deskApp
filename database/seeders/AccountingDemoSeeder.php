<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AccountingPeriod;
use App\Models\ApprovalWorkflow;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Budget;
use App\Models\Cashbook;
use App\Models\ClosingChecklist;
use App\Models\ClosingTask;
use App\Models\Company;
use App\Models\CostCenter;
use App\Models\Currency;
use App\Models\Department;
use App\Models\Employee;
use App\Models\ExchangeRate;
use App\Models\FixedAsset;
use App\Models\Integration;
use App\Models\InventoryItem;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\Project;
use App\Models\ScheduledReport;
use App\Models\TaxRate;
use App\Models\TaxRemittance;
use App\Models\User;
use App\Models\Webhook;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class AccountingDemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('email', 'admin@ledgerly.test')->first();

        $company = Company::updateOrCreate(
            ['code' => 'LEDGERLY'],
            [
                'name' => 'Ledgerly Demo Co',
                'base_currency' => 'USD',
                'tax_number' => 'US-8841-9920',
                'registration_number' => 'DE-2024-4417',
                'physical_address' => '500 Market Street, San Francisco, CA',
                'is_active' => true,
            ],
        );

        $branch = Branch::updateOrCreate(
            ['code' => 'HQ'],
            [
                'company_id' => $company->id,
                'name' => 'Headquarters',
                'address' => '500 Market Street, San Francisco, CA',
                'manager' => 'Avery Chen',
                'is_active' => true,
            ],
        );

        $finance = Department::updateOrCreate(
            ['code' => 'FIN'],
            ['branch_id' => $branch->id, 'name' => 'Finance', 'manager' => 'Jordan Ellis', 'is_active' => true],
        );

        $operations = Department::updateOrCreate(
            ['code' => 'OPS'],
            ['branch_id' => $branch->id, 'name' => 'Operations', 'manager' => 'Mia Torres', 'is_active' => true],
        );

        CostCenter::updateOrCreate(
            ['code' => 'CC-FIN'],
            ['branch_id' => $branch->id, 'department_id' => $finance->id, 'name' => 'Finance & Admin', 'is_active' => true],
        );

        CostCenter::updateOrCreate(
            ['code' => 'CC-OPS'],
            ['branch_id' => $branch->id, 'department_id' => $operations->id, 'name' => 'Delivery', 'is_active' => true],
        );

        Project::updateOrCreate(
            ['code' => 'PRJ-001'],
            [
                'company_id' => $company->id,
                'name' => 'Client Portal Revamp',
                'status' => 'active',
                'budget' => 75000,
                'start_date' => now()->startOfYear()->toDateString(),
                'end_date' => now()->endOfYear()->toDateString(),
                'description' => 'Design and build a self-service client portal.',
            ],
        );

        $currencies = [
            ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$', 'rate_to_base' => 1, 'is_base' => true],
            ['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€', 'rate_to_base' => 1.08, 'is_base' => false],
            ['code' => 'GBP', 'name' => 'British Pound', 'symbol' => '£', 'rate_to_base' => 1.27, 'is_base' => false],
            ['code' => 'NGN', 'name' => 'Nigerian Naira', 'symbol' => '₦', 'rate_to_base' => 0.00065, 'is_base' => false],
        ];

        foreach ($currencies as $currency) {
            Currency::updateOrCreate(
                ['code' => $currency['code']],
                [...$currency, 'is_active' => true],
            );

            if (! $currency['is_base']) {
                $effectiveDate = now()->subDay()->startOfDay();
                $existingRate = ExchangeRate::query()
                    ->where('currency_code', $currency['code'])
                    ->whereDate('effective_date', $effectiveDate->toDateString())
                    ->first();

                if ($existingRate) {
                    $existingRate->update(['rate' => $currency['rate_to_base'], 'source' => 'seed']);
                } else {
                    ExchangeRate::create([
                        'currency_code' => $currency['code'],
                        'effective_date' => $effectiveDate->toDateString(),
                        'rate' => $currency['rate_to_base'],
                        'source' => 'seed',
                    ]);
                }
            }
        }

        $gl = Account::query()->pluck('id', 'code');

        BankAccount::updateOrCreate(
            ['account_number' => '000123456789'],
            [
                'name' => 'Operating Account',
                'bank_name' => 'First Ledger Bank',
                'gl_account_id' => $gl['1110'] ?? null,
                'currency' => 'USD',
                'opening_balance' => 150000,
                'current_balance' => 150000,
                'iban' => 'US00LEDG000123456789',
                'is_active' => true,
            ],
        );

        BankAccount::updateOrCreate(
            ['account_number' => '000987654321'],
            [
                'name' => 'Tax Reserve',
                'bank_name' => 'First Ledger Bank',
                'gl_account_id' => $gl['1110'] ?? null,
                'currency' => 'USD',
                'opening_balance' => 25000,
                'current_balance' => 25000,
                'is_active' => true,
            ],
        );

        Cashbook::updateOrCreate(
            ['code' => 'PC-001'],
            [
                'name' => 'Office Petty Cash',
                'gl_account_id' => $gl['1120'] ?? null,
                'type' => 'petty_cash',
                'currency' => 'USD',
                'balance' => 500,
                'custodian' => 'Jordan Ellis',
                'is_active' => true,
            ],
        );

        InventoryItem::updateOrCreate(
            ['sku' => 'WIDGET-100'],
            [
                'name' => 'Consulting Toolkit Licence',
                'description' => 'Annual licence for the client delivery toolkit.',
                'category' => 'Software',
                'unit' => 'licence',
                'cost_method' => 'weighted_average',
                'unit_cost' => 25,
                'quantity_on_hand' => 120,
                'reorder_level' => 25,
                'inventory_account_id' => $gl['1300'] ?? null,
                'cogs_account_id' => $gl['5100'] ?? null,
                'is_active' => true,
            ],
        );

        InventoryItem::updateOrCreate(
            ['sku' => 'HARDWARE-200'],
            [
                'name' => 'Field Tablet',
                'description' => 'Rugged tablet used by delivery teams.',
                'category' => 'Hardware',
                'unit' => 'unit',
                'cost_method' => 'weighted_average',
                'unit_cost' => 420,
                'quantity_on_hand' => 8,
                'reorder_level' => 10,
                'inventory_account_id' => $gl['1300'] ?? null,
                'cogs_account_id' => $gl['5100'] ?? null,
                'is_active' => true,
            ],
        );

        FixedAsset::updateOrCreate(
            ['code' => 'FA-0001'],
            [
                'name' => 'Design Workstations',
                'category' => 'Computer equipment',
                'purchase_date' => now()->subMonths(5)->toDateString(),
                'cost' => 6000,
                'salvage_value' => 0,
                'useful_life_years' => 3,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 0,
                'book_value' => 6000,
                'status' => 'active',
                'location' => 'San Francisco HQ',
                'assigned_to' => 'Operations',
                'asset_account_id' => $gl['1500'] ?? null,
                'depreciation_account_id' => $gl['5700'] ?? null,
                'accumulated_account_id' => $gl['1510'] ?? null,
            ],
        );

        $employees = [
            ['employee_number' => 'EMP-001', 'name' => 'Mia Torres', 'email' => 'mia@ledgerly.test', 'department_id' => $operations->id, 'position' => 'Delivery Lead', 'hire_date' => now()->subYears(2)->toDateString(), 'gross_salary' => 7200, 'bank_account' => '000123456789'],
            ['employee_number' => 'EMP-002', 'name' => 'Noah Kim', 'email' => 'noah@ledgerly.test', 'department_id' => $operations->id, 'position' => 'Senior Consultant', 'hire_date' => now()->subMonths(16)->toDateString(), 'gross_salary' => 5800, 'bank_account' => '000123456789'],
            ['employee_number' => 'EMP-003', 'name' => 'Priya Raman', 'email' => 'priya@ledgerly.test', 'department_id' => $finance->id, 'position' => 'Financial Analyst', 'hire_date' => now()->subMonths(9)->toDateString(), 'gross_salary' => 5000, 'bank_account' => '000123456789'],
        ];

        foreach ($employees as $employee) {
            Employee::updateOrCreate(
                ['employee_number' => $employee['employee_number']],
                [...$employee, 'pay_frequency' => 'monthly', 'is_active' => true],
            );
        }

        $period = now()->format('Y-m');
        $run = PayrollRun::updateOrCreate(
            ['period' => $period],
            [
                'pay_date' => now()->endOfMonth()->toDateString(),
                'status' => 'draft',
                'created_by' => $admin?->id,
            ],
        );

        $grossTotal = 0.0;
        $deductionsTotal = 0.0;
        $netTotal = 0.0;

        foreach (Employee::query()->where('is_active', true)->get() as $employee) {
            $gross = (float) $employee->gross_salary;
            $tax = round($gross * 0.10, 2);
            $social = round($gross * 0.05, 2);
            $net = round($gross - $tax - $social, 2);

            PayrollItem::updateOrCreate(
                ['payroll_run_id' => $run->id, 'employee_id' => $employee->id],
                [
                    'gross' => $gross,
                    'income_tax' => $tax,
                    'social_security' => $social,
                    'other_deductions' => 0,
                    'net' => $net,
                ],
            );

            $grossTotal += $gross;
            $deductionsTotal += $tax + $social;
            $netTotal += $net;
        }

        $run->forceFill([
            'gross_total' => round($grossTotal, 2),
            'deductions_total' => round($deductionsTotal, 2),
            'net_total' => round($netTotal, 2),
        ])->save();

        $fiscalYear = (int) now()->format('Y');
        $budget = Budget::updateOrCreate(
            ['name' => 'Operating Budget '.$fiscalYear, 'fiscal_year' => $fiscalYear],
            [
                'branch_id' => $branch->id,
                'department_id' => $finance->id,
                'status' => 'approved',
                'notes' => 'Annual operating plan approved by the board.',
                'created_by' => $admin?->id,
            ],
        );

        if (! $budget->lines()->exists()) {
            $budgetAccounts = [
                ['code' => '5200', 'monthly' => 18000],
                ['code' => '5300', 'monthly' => 2400],
                ['code' => '5500', 'monthly' => 450],
                ['code' => '5600', 'monthly' => 2500],
            ];

            foreach ($budgetAccounts as $line) {
                $accountId = $gl[$line['code']] ?? null;
                if (! $accountId) {
                    continue;
                }

                foreach (range(1, 12) as $month) {
                    $budget->lines()->create([
                        'account_id' => $accountId,
                        'month' => $month,
                        'amount' => $line['monthly'],
                    ]);
                }
            }
        }

        $vat = TaxRate::updateOrCreate(
            ['code' => 'VAT10'],
            ['name' => 'VAT 10%', 'rate' => 10, 'type' => 'vat', 'account_id' => $gl['2200'] ?? null, 'is_active' => true],
        );

        TaxRate::updateOrCreate(
            ['code' => 'ST5'],
            ['name' => 'Sales Tax 5%', 'rate' => 5, 'type' => 'sales_tax', 'account_id' => $gl['2200'] ?? null, 'is_active' => true],
        );

        TaxRate::updateOrCreate(
            ['code' => 'PAYE'],
            ['name' => 'Payroll Income Tax', 'rate' => 10, 'type' => 'payroll', 'account_id' => $gl['2200'] ?? null, 'is_active' => true],
        );

        TaxRemittance::updateOrCreate(
            ['name' => 'VAT return', 'period' => $period],
            [
                'tax_rate_id' => $vat->id,
                'due_date' => now()->addDays(20)->toDateString(),
                'amount' => 3200,
                'status' => 'pending',
            ],
        );

        ApprovalWorkflow::updateOrCreate(
            ['name' => 'Invoice approval over $5,000'],
            ['type' => 'invoice', 'threshold' => 5000, 'approver_role' => 'admin', 'is_active' => true, 'description' => 'Requires admin sign-off for large sales invoices.'],
        );

        ApprovalWorkflow::updateOrCreate(
            ['name' => 'Bill approval over $2,500'],
            ['type' => 'bill', 'threshold' => 2500, 'approver_role' => 'admin', 'is_active' => true, 'description' => 'Vendor bills above the threshold require admin approval.'],
        );

        ApprovalWorkflow::updateOrCreate(
            ['name' => 'Payroll sign-off'],
            ['type' => 'payroll', 'threshold' => 0, 'approver_role' => 'admin', 'is_active' => true, 'description' => 'Every payroll run must be approved before posting.'],
        );

        $accountingPeriod = AccountingPeriod::updateOrCreate(
            ['name' => now()->format('F Y')],
            [
                'start_date' => now()->startOfMonth()->toDateString(),
                'end_date' => now()->endOfMonth()->toDateString(),
                'status' => 'open',
                'notes' => 'Current open accounting period.',
            ],
        );

        $checklist = ClosingChecklist::updateOrCreate(
            ['name' => 'Month-end close '.now()->format('F Y')],
            [
                'accounting_period_id' => $accountingPeriod->id,
                'status' => 'in_progress',
                'assigned_to' => $admin?->id,
                'due_date' => now()->addDays(7)->toDateString(),
            ],
        );

        $tasks = [
            ['title' => 'Reconcile all bank accounts', 'owner' => 'Jordan Ellis', 'status' => 'done'],
            ['title' => 'Review accounts receivable aging', 'owner' => 'Jordan Ellis', 'status' => 'in_progress'],
            ['title' => 'Post payroll and statutory accruals', 'owner' => 'Avery Chen', 'status' => 'pending'],
            ['title' => 'Review inventory valuation', 'owner' => 'Mia Torres', 'status' => 'pending'],
            ['title' => 'Lock the accounting period', 'owner' => 'Avery Chen', 'status' => 'pending'],
        ];

        foreach ($tasks as $task) {
            ClosingTask::updateOrCreate(
                ['closing_checklist_id' => $checklist->id, 'title' => $task['title']],
                [
                    'owner' => $task['owner'],
                    'status' => $task['status'],
                    'completed_at' => $task['status'] === 'done' ? now() : null,
                ],
            );
        }

        Integration::updateOrCreate(
            ['name' => 'QuickBooks Online'],
            [
                'type' => 'erp',
                'provider' => 'quickbooks',
                'config' => ['realm' => 'demo-realm', 'sync' => ['invoices', 'contacts']],
                'status' => 'connected',
                'last_synced_at' => now()->subHours(3),
            ],
        );

        Integration::updateOrCreate(
            ['name' => 'Stripe Billing'],
            [
                'type' => 'payments',
                'provider' => 'stripe',
                'config' => ['account' => 'acct_demo'],
                'status' => 'disconnected',
            ],
        );

        Webhook::updateOrCreate(
            ['name' => 'Ledgerly partner events', 'url' => 'https://example.test/hooks/ledgerly'],
            ['event' => 'invoice.paid', 'secret' => 'whsec_demo', 'is_active' => true],
        );

        ScheduledReport::updateOrCreate(
            ['name' => 'Monthly board pack', 'report' => 'profit-loss'],
            [
                'recipients' => 'board@ledgerly.test',
                'frequency' => 'monthly',
                'next_run_at' => Carbon::now()->addMonth()->startOfMonth(),
                'last_sent_at' => now()->startOfMonth()->subDay(),
                'filters' => ['from' => now()->startOfMonth()->toDateString()],
                'is_active' => true,
            ],
        );

        if ($admin) {
            $admin->forceFill([
                'role' => 'admin',
                'branch_id' => $branch->id,
                'department_id' => $finance->id,
            ])->save();
        }

        User::query()->where('email', 'accountant@ledgerly.test')->first()?->forceFill([
            'branch_id' => $branch->id,
            'department_id' => $finance->id,
        ])->save();
    }
}
