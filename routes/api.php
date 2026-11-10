<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BankAccountController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\CashbookController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ControlController;
use App\Http\Controllers\Api\CreditNoteController;
use App\Http\Controllers\Api\CurrencyController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\FixedAssetController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\OrganisationController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\PlatformController;
use App\Http\Controllers\Api\RecurringTransactionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RevenueScheduleController;
use App\Http\Controllers\Api\TaxController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.')->group(function () {
    Route::get('/', fn () => response()->json([
        'name' => 'Ledgerly Accounting API',
        'version' => 'v1',
        'authentication' => 'Bearer token (Laravel Sanctum)',
        'documentation' => url('/api-tokens'),
    ]));

    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:6,1')->name('auth.register');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:6,1')->name('auth.login');

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::apiResource('accounts', AccountController::class);
        Route::apiResource('contacts', ContactController::class);
        Route::apiResource('invoices', InvoiceController::class)->only(['index', 'store', 'show', 'destroy']);
        Route::apiResource('journal-entries', JournalEntryController::class)->only(['index', 'store', 'show']);

        Route::apiResource('bills', BillController::class)->only(['index', 'store', 'show', 'destroy']);
        Route::post('bills/{bill}/approve', [BillController::class, 'approve'])->middleware('can:approve')->name('bills.approve');
        Route::post('bills/{bill}/payments', [BillController::class, 'payment'])->name('bills.payments.store');

        Route::apiResource('credit-notes', CreditNoteController::class)->only(['index', 'store', 'show', 'destroy']);
        Route::post('credit-notes/{creditNote}/post', [CreditNoteController::class, 'post'])->name('credit-notes.post');

        Route::apiResource('bank-accounts', BankAccountController::class)->only(['index', 'store', 'show', 'update']);
        Route::post('bank-accounts/{bankAccount}/transactions', [BankAccountController::class, 'transactions'])->name('bank-accounts.transactions.store');
        Route::post('bank-accounts/{bankAccount}/reconciliations', [BankAccountController::class, 'reconciliations'])->name('bank-accounts.reconciliations.store');
        Route::post('bank-transactions/{bankTransaction}/match', [BankAccountController::class, 'match'])->name('bank-transactions.match');
        Route::post('bank-transactions/{bankTransaction}/unmatch', [BankAccountController::class, 'unmatch'])->name('bank-transactions.unmatch');
        Route::post('bank-reconciliations/{bankReconciliation}/complete', [BankAccountController::class, 'completeReconciliation'])->name('bank-reconciliations.complete');
        Route::post('bank-transfers', [BankAccountController::class, 'transfers'])->name('bank-transfers.store');

        Route::apiResource('inventory-items', InventoryController::class)->only(['index', 'store', 'show']);
        Route::post('inventory-items/{inventoryItem}/movements', [InventoryController::class, 'movement'])->name('inventory-items.movements.store');

        Route::apiResource('fixed-assets', FixedAssetController::class)->only(['index', 'store', 'show']);
        Route::post('fixed-assets/{fixedAsset}/depreciate', [FixedAssetController::class, 'depreciate'])->name('fixed-assets.depreciate');
        Route::post('fixed-assets/{fixedAsset}/dispose', [FixedAssetController::class, 'dispose'])->name('fixed-assets.dispose');
        Route::post('fixed-assets/{fixedAsset}/revalue', [FixedAssetController::class, 'revalue'])->name('fixed-assets.revalue');

        Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
        Route::post('payroll/employees', [PayrollController::class, 'storeEmployee'])->name('payroll.employees.store');
        Route::post('payroll/runs', [PayrollController::class, 'storeRun'])->name('payroll.runs.store');
        Route::get('payroll/runs/{payrollRun}', [PayrollController::class, 'showRun'])->name('payroll.runs.show');
        Route::post('payroll/runs/{payrollRun}/process', [PayrollController::class, 'process'])->name('payroll.runs.process');

        Route::apiResource('budgets', BudgetController::class)->only(['index', 'store', 'show']);
        Route::patch('budgets/{budget}/status', [BudgetController::class, 'status'])->name('budgets.status');

        Route::get('tax', [TaxController::class, 'index'])->name('tax.index');
        Route::post('tax/rates', [TaxController::class, 'storeRate'])->name('tax.rates.store');
        Route::post('tax/remittances', [TaxController::class, 'storeRemittance'])->name('tax.remittances.store');
        Route::post('tax/remittances/{taxRemittance}/remit', [TaxController::class, 'remit'])->name('tax.remittances.remit');

        Route::post('invoices/{invoice}/payments', [InvoiceController::class, 'payment'])->name('invoices.payments.store');
        Route::post('invoices/{invoice}/send', [InvoiceController::class, 'send'])->name('invoices.send');
        Route::post('invoices/{invoice}/reminders', [InvoiceController::class, 'reminder'])->name('invoices.reminders.store');
        Route::post('journal-entries/{journalEntry}/post', [JournalEntryController::class, 'post'])->name('journal-entries.post');

        Route::get('reports/dashboard', [ReportController::class, 'dashboard'])->name('reports.dashboard');
        Route::get('reports/trial-balance', [ReportController::class, 'trialBalance'])->name('reports.trial-balance');
        Route::get('reports/profit-loss', [ReportController::class, 'profitAndLoss'])->name('reports.profit-loss');
        Route::get('reports/balance-sheet', [ReportController::class, 'balanceSheet'])->name('reports.balance-sheet');
        Route::get('reports/cash-flow', [ReportController::class, 'cashFlow'])->name('reports.cash-flow');
        Route::get('reports/general-ledger', [ReportController::class, 'generalLedger'])->name('reports.general-ledger');
        Route::get('reports/sales', [ReportController::class, 'sales'])->name('reports.sales');
        Route::get('reports/expenses', [ReportController::class, 'expenses'])->name('reports.expenses');
        Route::get('reports/customer-statement', [ReportController::class, 'customerStatement'])->name('reports.customer-statement');
        Route::get('reports/aging', [ReportController::class, 'aging'])->name('reports.aging');
        Route::get('reports/bank-reconciliation', [ReportController::class, 'bankReconciliation'])->name('reports.bank-reconciliation');
        Route::get('reports/fixed-asset-register', [ReportController::class, 'fixedAssetRegister'])->name('reports.fixed-asset-register');
        Route::get('reports/vat', [ReportController::class, 'vat'])->name('reports.vat');
        Route::get('reports/budget-vs-actual', [ReportController::class, 'budgetVsActual'])->name('reports.budget-vs-actual');
        Route::get('reports/dimensions', [ReportController::class, 'dimensions'])->name('reports.dimensions');
        Route::get('reports/audit', [ReportController::class, 'audit'])->name('reports.audit');

        Route::prefix('cashbooks')->name('cashbooks.')->group(function (): void {
            Route::get('/', [CashbookController::class, 'index'])->name('index');
            Route::post('/', [CashbookController::class, 'store'])->name('store');
            Route::get('{cashbook}', [CashbookController::class, 'show'])->name('show');
            Route::post('transactions', [CashbookController::class, 'storeTransaction'])->name('transactions.store');
        });

        Route::prefix('currencies')->name('currencies.')->group(function (): void {
            Route::get('/', [CurrencyController::class, 'index'])->name('index');
            Route::post('/', [CurrencyController::class, 'store'])->name('store');
            Route::post('rates', [CurrencyController::class, 'storeRate'])->name('rates.store');
            Route::get('settings', [CurrencyController::class, 'settings'])->name('settings.show');
            Route::put('settings', [CurrencyController::class, 'updateSettings'])->name('settings.update');
            Route::patch('settings', [CurrencyController::class, 'updateSettings']);
            Route::put('{currency}', [CurrencyController::class, 'update'])->name('update');
            Route::patch('{currency}', [CurrencyController::class, 'update']);
            Route::delete('{currency}', [CurrencyController::class, 'destroy'])->name('destroy');
            Route::patch('{currency}/toggle', [CurrencyController::class, 'toggle'])->name('toggle');
        });

        Route::prefix('recurring-transactions')->name('recurring-transactions.')->group(function (): void {
            Route::get('/', [RecurringTransactionController::class, 'index'])->name('index');
            Route::post('/', [RecurringTransactionController::class, 'store'])->name('store');
            Route::post('run-due', [RecurringTransactionController::class, 'runDue'])->name('run-due');
            Route::post('{recurringTransaction}/run', [RecurringTransactionController::class, 'run'])->name('run');
            Route::patch('{recurringTransaction}/toggle', [RecurringTransactionController::class, 'toggle'])->name('toggle');
        });

        Route::prefix('revenue-schedules')->name('revenue-schedules.')->group(function (): void {
            Route::get('/', [RevenueScheduleController::class, 'index'])->name('index');
            Route::post('/', [RevenueScheduleController::class, 'store'])->name('store');
            Route::post('{revenueSchedule}/recognize', [RevenueScheduleController::class, 'recognize'])->name('recognize');
        });

        Route::prefix('organisation')->name('organisation.')->group(function (): void {
            Route::get('/', [OrganisationController::class, 'index'])->name('index');
            Route::post('companies', [OrganisationController::class, 'storeCompany'])->name('companies.store');
            Route::put('companies/{company}', [OrganisationController::class, 'updateCompany'])->name('companies.update');
            Route::patch('companies/{company}', [OrganisationController::class, 'updateCompany']);
            Route::get('companies/{company}', [OrganisationController::class, 'showCompany'])->name('companies.show');
            Route::delete('companies/{company}', [OrganisationController::class, 'destroyCompany'])->middleware('can:admin')->name('companies.destroy');
            Route::post('branches', [OrganisationController::class, 'storeBranch'])->name('branches.store');
            Route::delete('branches/{branch}', [OrganisationController::class, 'destroyBranch'])->middleware('can:admin')->name('branches.destroy');
            Route::post('departments', [OrganisationController::class, 'storeDepartment'])->name('departments.store');
            Route::post('cost-centers', [OrganisationController::class, 'storeCostCenter'])->name('cost-centers.store');
            Route::post('projects', [OrganisationController::class, 'storeProject'])->name('projects.store');
            Route::post('users/{user}/role', [OrganisationController::class, 'updateUserRole'])->middleware('can:admin')->name('users.role');
        });

        Route::prefix('controls')->name('controls.')->group(function (): void {
            Route::get('/', [ControlController::class, 'index'])->name('index');
            Route::post('periods', [ControlController::class, 'storePeriod'])->name('periods.store');
            Route::post('periods/{accountingPeriod}/close', [ControlController::class, 'closePeriod'])->name('periods.close');
            Route::post('periods/{accountingPeriod}/reopen', [ControlController::class, 'reopenPeriod'])->name('periods.reopen');
            Route::post('posting-rules', [ControlController::class, 'storeRule'])->name('rules.store');
            Route::post('workflows', [ControlController::class, 'storeWorkflow'])->name('workflows.store');
            Route::post('approvals/{approvalRequest}/decide', [ControlController::class, 'decide'])->middleware('can:approve')->name('approvals.decide');
        });

        Route::apiResource('documents', DocumentController::class)->only(['index', 'store', 'show', 'update', 'destroy']);

        Route::prefix('platform')->name('platform.')->middleware('can:admin')->group(function (): void {
            Route::get('/', [PlatformController::class, 'index'])->name('index');
            Route::post('integrations', [PlatformController::class, 'storeIntegration'])->name('integrations.store');
            Route::post('integrations/{integration}/sync', [PlatformController::class, 'syncIntegration'])->name('integrations.sync');
            Route::post('webhooks', [PlatformController::class, 'storeWebhook'])->name('webhooks.store');
            Route::post('webhooks/{webhook}/test', [PlatformController::class, 'testWebhook'])->name('webhooks.test');
            Route::post('scheduled-reports', [PlatformController::class, 'storeScheduledReport'])->name('scheduled-reports.store');
            Route::post('imports', [PlatformController::class, 'storeImport'])->name('imports.store');
            Route::post('backups', [PlatformController::class, 'storeBackup'])->name('backups.store');
            Route::post('checklists', [PlatformController::class, 'storeChecklist'])->name('checklists.store');
            Route::post('checklists/{closingChecklist}/tasks', [PlatformController::class, 'storeChecklistTask'])->name('checklists.tasks.store');
            Route::post('checklists/{closingChecklist}/tasks/{closingTask}/complete', [PlatformController::class, 'completeChecklistTask'])->name('checklists.tasks.complete');
        });
    });
});
