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
use App\Http\Controllers\Api\VendorPaymentController;
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

        Route::apiResource('accounts', AccountController::class)->only(['index', 'show']);
        Route::apiResource('contacts', ContactController::class)->only(['index', 'show']);
        Route::apiResource('invoices', InvoiceController::class)->only(['index', 'show']);
        Route::apiResource('journal-entries', JournalEntryController::class)->only(['index', 'show']);

        Route::middleware('can:write')->group(function (): void {
            Route::apiResource('accounts', AccountController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('contacts', ContactController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('invoices', InvoiceController::class)->only(['store', 'destroy']);
            Route::apiResource('journal-entries', JournalEntryController::class)->only(['store']);
            Route::apiResource('bills', BillController::class)->only(['store', 'destroy']);
            Route::apiResource('credit-notes', CreditNoteController::class)->only(['store', 'destroy']);
            Route::post('credit-notes/{creditNote}/post', [CreditNoteController::class, 'post'])->name('credit-notes.post');
        });

        Route::apiResource('bills', BillController::class)->only(['index', 'show']);
        Route::post('bills/{bill}/approve', [BillController::class, 'approve'])->middleware('can:approve')->name('bills.approve');
        Route::post('bills/{bill}/payments', [BillController::class, 'payment'])->middleware('can:write')->name('bills.payments.store');

        Route::apiResource('credit-notes', CreditNoteController::class)->only(['index', 'show']);

        Route::apiResource('bank-accounts', BankAccountController::class)->only(['index', 'show']);
        Route::post('bank-accounts', [BankAccountController::class, 'store'])->middleware('can:write')->name('bank-accounts.store');
        Route::put('bank-accounts/{bankAccount}', [BankAccountController::class, 'update'])->middleware('can:write')->name('bank-accounts.update');
        Route::patch('bank-accounts/{bankAccount}', [BankAccountController::class, 'update'])->middleware('can:write');
        Route::post('bank-accounts/{bankAccount}/transactions', [BankAccountController::class, 'transactions'])->middleware('can:write')->name('bank-accounts.transactions.store');
        Route::post('bank-accounts/{bankAccount}/reconciliations', [BankAccountController::class, 'reconciliations'])->middleware('can:write')->name('bank-accounts.reconciliations.store');
        Route::post('bank-transactions/{bankTransaction}/match', [BankAccountController::class, 'match'])->middleware('can:write')->name('bank-transactions.match');
        Route::post('bank-transactions/{bankTransaction}/unmatch', [BankAccountController::class, 'unmatch'])->middleware('can:write')->name('bank-transactions.unmatch');
        Route::post('bank-reconciliations/{bankReconciliation}/complete', [BankAccountController::class, 'completeReconciliation'])->middleware('can:write')->name('bank-reconciliations.complete');
        Route::post('bank-transfers', [BankAccountController::class, 'transfers'])->middleware('can:write')->name('bank-transfers.store');

        Route::apiResource('inventory-items', InventoryController::class)->only(['index', 'show']);
        Route::post('inventory-items', [InventoryController::class, 'store'])->middleware('can:write')->name('inventory-items.store');
        Route::post('inventory-items/{inventoryItem}/movements', [InventoryController::class, 'movement'])->middleware('can:write')->name('inventory-items.movements.store');

        Route::apiResource('fixed-assets', FixedAssetController::class)->only(['index', 'show']);
        Route::post('fixed-assets', [FixedAssetController::class, 'store'])->middleware('can:write')->name('fixed-assets.store');
        Route::post('fixed-assets/{fixedAsset}/depreciate', [FixedAssetController::class, 'depreciate'])->middleware('can:write')->name('fixed-assets.depreciate');
        Route::post('fixed-assets/{fixedAsset}/dispose', [FixedAssetController::class, 'dispose'])->middleware('can:write')->name('fixed-assets.dispose');
        Route::post('fixed-assets/{fixedAsset}/revalue', [FixedAssetController::class, 'revalue'])->middleware('can:write')->name('fixed-assets.revalue');

        Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
        Route::post('payroll/employees', [PayrollController::class, 'storeEmployee'])->middleware('can:write')->name('payroll.employees.store');
        Route::post('payroll/runs', [PayrollController::class, 'storeRun'])->middleware('can:write')->name('payroll.runs.store');
        Route::get('payroll/runs/{payrollRun}', [PayrollController::class, 'showRun'])->name('payroll.runs.show');
        Route::post('payroll/runs/{payrollRun}/process', [PayrollController::class, 'process'])->middleware('can:write')->name('payroll.runs.process');

        Route::apiResource('budgets', BudgetController::class)->only(['index', 'show']);
        Route::post('budgets', [BudgetController::class, 'store'])->middleware('can:write')->name('budgets.store');
        Route::patch('budgets/{budget}/status', [BudgetController::class, 'status'])->middleware('can:write')->name('budgets.status');

        Route::get('tax', [TaxController::class, 'index'])->name('tax.index');
        Route::post('tax/rates', [TaxController::class, 'storeRate'])->middleware('can:write')->name('tax.rates.store');
        Route::post('tax/remittances', [TaxController::class, 'storeRemittance'])->middleware('can:write')->name('tax.remittances.store');
        Route::post('tax/remittances/{taxRemittance}/remit', [TaxController::class, 'remit'])->middleware('can:write')->name('tax.remittances.remit');

        Route::post('invoices/{invoice}/payments', [InvoiceController::class, 'payment'])->middleware('can:write')->name('invoices.payments.store');
        Route::post('invoices/{invoice}/send', [InvoiceController::class, 'send'])->middleware('can:write')->name('invoices.send');

        Route::apiResource('vendor-payments', VendorPaymentController::class)->only(['index', 'show']);
        Route::put('vendor-payments/{vendorPayment}', [VendorPaymentController::class, 'update'])->middleware('can:write')->name('vendor-payments.update');
        Route::delete('vendor-payments/{vendorPayment}', [VendorPaymentController::class, 'destroy'])->middleware('can:write')->name('vendor-payments.destroy');
        Route::post('invoices/{invoice}/reminders', [InvoiceController::class, 'reminder'])->middleware('can:write')->name('invoices.reminders.store');
        Route::post('journal-entries/{journalEntry}/post', [JournalEntryController::class, 'post'])->middleware('can:write')->name('journal-entries.post');

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
            Route::get('{cashbook}', [CashbookController::class, 'show'])->name('show');
            Route::post('/', [CashbookController::class, 'store'])->middleware('can:write')->name('store');
            Route::post('transactions', [CashbookController::class, 'storeTransaction'])->middleware('can:write')->name('transactions.store');
        });

        Route::prefix('currencies')->name('currencies.')->group(function (): void {
            Route::get('/', [CurrencyController::class, 'index'])->name('index');
            Route::get('settings', [CurrencyController::class, 'settings'])->name('settings.show');
            Route::middleware('can:write')->group(function (): void {
                Route::post('/', [CurrencyController::class, 'store'])->name('store');
                Route::post('rates', [CurrencyController::class, 'storeRate'])->name('rates.store');
                Route::put('settings', [CurrencyController::class, 'updateSettings'])->name('settings.update');
                Route::put('{currency}', [CurrencyController::class, 'update'])->name('update');
                Route::delete('{currency}', [CurrencyController::class, 'destroy'])->name('destroy');
                Route::patch('{currency}/toggle', [CurrencyController::class, 'toggle'])->name('toggle');
            });
            Route::patch('settings', [CurrencyController::class, 'updateSettings'])->middleware('can:write');
            Route::patch('{currency}', [CurrencyController::class, 'update'])->middleware('can:write');
        });

        Route::prefix('recurring-transactions')->name('recurring-transactions.')->group(function (): void {
            Route::get('/', [RecurringTransactionController::class, 'index'])->name('index');
            Route::middleware('can:write')->group(function (): void {
                Route::post('/', [RecurringTransactionController::class, 'store'])->name('store');
                Route::post('run-due', [RecurringTransactionController::class, 'runDue'])->name('run-due');
                Route::post('{recurringTransaction}/run', [RecurringTransactionController::class, 'run'])->name('run');
                Route::patch('{recurringTransaction}/toggle', [RecurringTransactionController::class, 'toggle'])->name('toggle');
            });
        });

        Route::prefix('revenue-schedules')->name('revenue-schedules.')->group(function (): void {
            Route::get('/', [RevenueScheduleController::class, 'index'])->name('index');
            Route::post('/', [RevenueScheduleController::class, 'store'])->middleware('can:write')->name('store');
            Route::post('{revenueSchedule}/recognize', [RevenueScheduleController::class, 'recognize'])->middleware('can:write')->name('recognize');
        });

        Route::prefix('organisation')->name('organisation.')->group(function (): void {
            Route::get('/', [OrganisationController::class, 'index'])->name('index');
            Route::get('companies/{company}', [OrganisationController::class, 'showCompany'])->name('companies.show');
            Route::middleware('can:write')->group(function (): void {
                Route::post('companies', [OrganisationController::class, 'storeCompany'])->name('companies.store');
                Route::put('companies/{company}', [OrganisationController::class, 'updateCompany'])->name('companies.update');
                Route::post('branches', [OrganisationController::class, 'storeBranch'])->name('branches.store');
                Route::post('departments', [OrganisationController::class, 'storeDepartment'])->name('departments.store');
                Route::post('cost-centers', [OrganisationController::class, 'storeCostCenter'])->name('cost-centers.store');
                Route::post('projects', [OrganisationController::class, 'storeProject'])->name('projects.store');
            });
            Route::delete('companies/{company}', [OrganisationController::class, 'destroyCompany'])->middleware('can:admin')->name('companies.destroy');
            Route::delete('branches/{branch}', [OrganisationController::class, 'destroyBranch'])->middleware('can:admin')->name('branches.destroy');
            Route::post('users/{user}/role', [OrganisationController::class, 'updateUserRole'])->middleware('can:admin')->name('users.role');
            Route::patch('companies/{company}', [OrganisationController::class, 'updateCompany'])->middleware('can:write');
        });

        Route::prefix('controls')->name('controls.')->group(function (): void {
            Route::get('/', [ControlController::class, 'index'])->name('index');
            Route::middleware('can:write')->group(function (): void {
                Route::post('periods', [ControlController::class, 'storePeriod'])->name('periods.store');
                Route::post('periods/{accountingPeriod}/close', [ControlController::class, 'closePeriod'])->name('periods.close');
                Route::post('periods/{accountingPeriod}/reopen', [ControlController::class, 'reopenPeriod'])->name('periods.reopen');
                Route::post('posting-rules', [ControlController::class, 'storeRule'])->name('rules.store');
                Route::post('workflows', [ControlController::class, 'storeWorkflow'])->name('workflows.store');
            });
            Route::post('approvals/{approvalRequest}/decide', [ControlController::class, 'decide'])->middleware('can:approve')->name('approvals.decide');
        });

        Route::apiResource('documents', DocumentController::class)->only(['index', 'show']);
        Route::post('documents', [DocumentController::class, 'store'])->middleware('can:write')->name('documents.store');
        Route::put('documents/{document}', [DocumentController::class, 'update'])->middleware('can:write')->name('documents.update');
        Route::delete('documents/{document}', [DocumentController::class, 'destroy'])->middleware('can:write')->name('documents.destroy');

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
