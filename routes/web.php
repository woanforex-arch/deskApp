<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\BankingController;
use App\Http\Controllers\BillController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\CashbookController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\ControlController;
use App\Http\Controllers\CostAllocationController;
use App\Http\Controllers\CreditNoteController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FixedAssetController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\JournalEntryController;
use App\Http\Controllers\OrganisationController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\RecurringTransactionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RevenueScheduleController;
use App\Http\Controllers\TaxController;
use App\Http\Controllers\VendorPaymentController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('register', [RegisteredUserController::class, 'store']);
});

Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    // Ledger & accounts
    Route::get('accounts', [AccountController::class, 'index'])->name('accounts.index');
    Route::post('accounts', [AccountController::class, 'store'])->name('accounts.store');
    Route::put('accounts/{account}', [AccountController::class, 'update'])->name('accounts.update');
    Route::delete('accounts/{account}', [AccountController::class, 'destroy'])->name('accounts.destroy');
    Route::get('journal', [JournalEntryController::class, 'index'])->name('journal.index');
    Route::post('journal', [JournalEntryController::class, 'store'])->name('journal.store');
    Route::post('journal/{journalEntry}/post', [JournalEntryController::class, 'post'])->name('journal.post');
    Route::put('journal/{journalEntry}', [JournalEntryController::class, 'update'])->name('journal.update');
    Route::delete('journal/{journalEntry}', [JournalEntryController::class, 'destroy'])->name('journal.destroy');
    Route::post('journal/{journalEntry}/duplicate', [JournalEntryController::class, 'duplicate'])->name('journal.duplicate');
    Route::post('journal/{journalEntry}/void', [JournalEntryController::class, 'void'])->name('journal.void');
    Route::delete('journal/{journalEntry}/void', [JournalEntryController::class, 'destroyVoid'])->name('journal.void.destroy');
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/{report}', [ReportController::class, 'show'])->name('reports.show');

    // Receivables
    Route::get('invoices', [InvoiceController::class, 'index'])->name('invoices.index');
    Route::post('invoices', [InvoiceController::class, 'store'])->name('invoices.store');
    Route::get('invoices/{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
    Route::delete('invoices/{invoice}', [InvoiceController::class, 'destroy'])->name('invoices.destroy');
    Route::post('invoices/{invoice}/send', [InvoiceController::class, 'send'])->name('invoices.send');
    Route::post('invoices/{invoice}/reminder', [InvoiceController::class, 'reminder'])->name('invoices.reminder');
    Route::post('invoices/{invoice}/payments', [InvoiceController::class, 'payment'])->name('invoices.payments.store');
    Route::get('credit-notes', [CreditNoteController::class, 'index'])->name('credit-notes.index');
    Route::post('credit-notes', [CreditNoteController::class, 'store'])->name('credit-notes.store');
    Route::post('credit-notes/{creditNote}/post', [CreditNoteController::class, 'post'])->name('credit-notes.post');
    Route::delete('credit-notes/{creditNote}', [CreditNoteController::class, 'destroy'])->name('credit-notes.destroy');

    // Payables
    Route::get('bills', [BillController::class, 'index'])->name('bills.index');
    Route::post('bills', [BillController::class, 'store'])->name('bills.store');
    Route::get('bills/{bill}', [BillController::class, 'show'])->name('bills.show');
    Route::post('bills/{bill}/approve', [BillController::class, 'approve'])->middleware('can:approve')->name('bills.approve');
    Route::post('bills/{bill}/payments', [BillController::class, 'payment'])->name('bills.payment');
    Route::delete('bills/{bill}', [BillController::class, 'destroy'])->name('bills.destroy');
    Route::get('vendor-payments', [VendorPaymentController::class, 'index'])->name('vendor-payments.index');
    Route::post('vendor-payments', [VendorPaymentController::class, 'store'])->name('vendor-payments.store');

    // Banking & cash
    Route::get('banking', [BankingController::class, 'index'])->name('banking.index');
    Route::post('banking/accounts', [BankingController::class, 'storeAccount'])->name('banking.accounts.store');
    Route::post('banking/transactions', [BankingController::class, 'storeTransaction'])->name('banking.transactions.store');
    Route::post('banking/transactions/{bankTransaction}/match', [BankingController::class, 'match'])->name('banking.transactions.match');
    Route::post('banking/transactions/{bankTransaction}/unmatch', [BankingController::class, 'unmatch'])->name('banking.transactions.unmatch');
    Route::post('banking/reconciliations', [BankingController::class, 'storeReconciliation'])->name('banking.reconciliations.store');
    Route::post('banking/reconciliations/{bankReconciliation}/complete', [BankingController::class, 'completeReconciliation'])->name('banking.reconciliations.complete');
    Route::post('banking/transfers', [BankingController::class, 'storeTransfer'])->name('banking.transfers.store');
    Route::get('cashbooks', [CashbookController::class, 'index'])->name('cashbooks.index');
    Route::post('cashbooks', [CashbookController::class, 'store'])->name('cashbooks.store');
    Route::post('cashbooks/transactions', [CashbookController::class, 'storeTransaction'])->name('cashbooks.transactions.store');

    // Inventory & assets
    Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
    Route::post('inventory', [InventoryController::class, 'store'])->name('inventory.store');
    Route::post('inventory/{inventoryItem}/movements', [InventoryController::class, 'movement'])->name('inventory.movements.store');
    Route::get('fixed-assets', [FixedAssetController::class, 'index'])->name('fixed-assets.index');
    Route::post('fixed-assets', [FixedAssetController::class, 'store'])->name('fixed-assets.store');
    Route::post('fixed-assets/{fixedAsset}/depreciate', [FixedAssetController::class, 'depreciate'])->name('fixed-assets.depreciate');
    Route::post('fixed-assets/{fixedAsset}/dispose', [FixedAssetController::class, 'dispose'])->name('fixed-assets.dispose');
    Route::post('fixed-assets/{fixedAsset}/revalue', [FixedAssetController::class, 'revalue'])->name('fixed-assets.revalue');

    // Payroll & tax
    Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
    Route::post('payroll/employees', [PayrollController::class, 'storeEmployee'])->name('payroll.employees.store');
    Route::post('payroll/runs', [PayrollController::class, 'storeRun'])->name('payroll.runs.store');
    Route::post('payroll/runs/{payrollRun}/process', [PayrollController::class, 'process'])->name('payroll.runs.process');
    Route::get('tax', [TaxController::class, 'index'])->name('tax.index');
    Route::post('tax/rates', [TaxController::class, 'storeRate'])->name('tax.rates.store');
    Route::post('tax/remittances', [TaxController::class, 'storeRemittance'])->name('tax.remittances.store');
    Route::post('tax/remittances/{taxRemittance}/remit', [TaxController::class, 'remit'])->name('tax.remittances.remit');

    // Planning & revenue
    Route::get('budgets', [BudgetController::class, 'index'])->name('budgets.index');
    Route::post('budgets', [BudgetController::class, 'store'])->name('budgets.store');
    Route::post('budgets/{budget}/status', [BudgetController::class, 'status'])->name('budgets.status');
    Route::get('revenue-schedules', [RevenueScheduleController::class, 'index'])->name('revenue-schedules.index');
    Route::post('revenue-schedules', [RevenueScheduleController::class, 'store'])->name('revenue-schedules.store');
    Route::post('revenue-schedules/{revenueSchedule}/recognize', [RevenueScheduleController::class, 'recognize'])->name('revenue-schedules.recognize');
    Route::get('recurring-transactions', [RecurringTransactionController::class, 'index'])->name('recurring-transactions.index');
    Route::post('recurring-transactions', [RecurringTransactionController::class, 'store'])->name('recurring-transactions.store');
    Route::post('recurring-transactions/{recurringTransaction}/run', [RecurringTransactionController::class, 'run'])->name('recurring-transactions.run');
    Route::post('recurring-transactions/run-due', [RecurringTransactionController::class, 'runDue'])->name('recurring-transactions.run-due');
    Route::post('recurring-transactions/{recurringTransaction}/toggle', [RecurringTransactionController::class, 'toggle'])->name('recurring-transactions.toggle');

    // Organisation, currency, controls, platform
    Route::get('organisation', [OrganisationController::class, 'index'])->name('organisation.index');
    Route::get('organisation/register', [OrganisationController::class, 'register'])->name('organisation.register');
    Route::post('organisation/companies', [OrganisationController::class, 'storeCompany'])->name('organisation.companies.store');
    Route::get('organisation/companies/{company}/logo', [OrganisationController::class, 'serveLogo'])->name('organisation.companies.logo');
    Route::put('organisation/companies/{company}', [OrganisationController::class, 'updateCompany'])->name('organisation.companies.update');
    Route::patch('organisation/companies/{company}', [OrganisationController::class, 'updateCompany']);
    Route::delete('organisation/companies/{company}', [OrganisationController::class, 'deleteCompany'])->middleware('can:admin')->name('organisation.companies.destroy');
    Route::post('organisation/branches', [OrganisationController::class, 'storeBranch'])->name('organisation.branches.store');
    Route::delete('organisation/branches/{branch}', [OrganisationController::class, 'deleteBranch'])->middleware('can:admin')->name('organisation.branches.destroy');
    Route::post('organisation/departments', [OrganisationController::class, 'storeDepartment'])->name('organisation.departments.store');
    Route::post('organisation/cost-centers', [OrganisationController::class, 'storeCostCenter'])->name('organisation.cost-centers.store');
    Route::post('organisation/projects', [OrganisationController::class, 'storeProject'])->name('organisation.projects.store');
    Route::post('organisation/users/{user}/role', [OrganisationController::class, 'updateUserRole'])->middleware('can:admin')->name('organisation.users.role');
    Route::get('currencies', [CurrencyController::class, 'index'])->name('currencies.index');
    Route::post('currencies', [CurrencyController::class, 'store'])->name('currencies.store');
    Route::post('currencies/rates', [CurrencyController::class, 'storeRate'])->name('currencies.rates.store');
    Route::put('currencies/{currency}', [CurrencyController::class, 'update'])->name('currencies.update');
    Route::delete('currencies/{currency}', [CurrencyController::class, 'destroy'])->name('currencies.destroy');
    Route::post('currencies/{currency}/toggle', [CurrencyController::class, 'toggle'])->name('currencies.toggle');
    Route::get('controls', [ControlController::class, 'index'])->name('controls.index');
    Route::post('controls/periods', [ControlController::class, 'storePeriod'])->name('controls.periods.store');
    Route::post('controls/periods/{accountingPeriod}/close', [ControlController::class, 'closePeriod'])->name('controls.periods.close');
    Route::post('controls/periods/{accountingPeriod}/reopen', [ControlController::class, 'reopenPeriod'])->name('controls.periods.reopen');
    Route::post('controls/posting-rules', [ControlController::class, 'storeRule'])->name('controls.posting-rules.store');
    Route::post('controls/workflows', [ControlController::class, 'storeWorkflow'])->name('controls.workflows.store');
    Route::post('controls/approvals/{approvalRequest}/decide', [ControlController::class, 'decide'])->middleware('can:approve')->name('controls.approvals.decide');
    Route::get('platform', [PlatformController::class, 'index'])->middleware('can:admin')->name('platform.index');

    Route::middleware('can:admin')->prefix('platform')->group(function () {
        Route::post('integrations', [PlatformController::class, 'storeIntegration'])->name('platform.integrations.store');
        Route::post('integrations/{integration}/sync', [PlatformController::class, 'syncIntegration'])->name('platform.integrations.sync');
        Route::post('webhooks', [PlatformController::class, 'storeWebhook'])->name('platform.webhooks.store');
        Route::post('webhooks/{webhook}/test', [PlatformController::class, 'testWebhook'])->name('platform.webhooks.test');
        Route::post('scheduled-reports', [PlatformController::class, 'storeScheduledReport'])->name('platform.scheduled-reports.store');
        Route::post('imports', [PlatformController::class, 'storeImport'])->name('platform.imports.store');
        Route::post('backups', [PlatformController::class, 'storeBackup'])->name('platform.backups.store');
        Route::post('closing-checklists', [PlatformController::class, 'storeChecklist'])->name('platform.closing.store');
        Route::post('closing-checklists/{closingChecklist}/tasks', [PlatformController::class, 'storeChecklistTask'])->name('platform.closing.tasks.store');
        Route::post('closing-checklists/{closingChecklist}/tasks/{closingTask}/complete', [PlatformController::class, 'completeChecklistTask'])->name('platform.closing.tasks.complete');
    });

    // Cost allocation, documents, audit
    Route::get('cost-allocations', [CostAllocationController::class, 'index'])->name('cost-allocations.index');
    Route::post('cost-allocations', [CostAllocationController::class, 'store'])->name('cost-allocations.store');
    Route::post('cost-allocations/{costAllocation}/run', [CostAllocationController::class, 'run'])->name('cost-allocations.run');
    Route::get('documents', [AttachmentController::class, 'index'])->name('documents.index');
    Route::post('documents', [AttachmentController::class, 'store'])->name('documents.store');
    Route::post('documents/{attachment}/ocr', [AttachmentController::class, 'updateOcr'])->name('documents.ocr');
    Route::delete('documents/{attachment}', [AttachmentController::class, 'destroy'])->name('documents.destroy');
    Route::get('audit', [AuditLogController::class, 'index'])->name('audit.index');

    // Contacts & API tokens
    Route::get('contacts', [ContactController::class, 'index'])->name('contacts.index');
    Route::post('contacts', [ContactController::class, 'store'])->name('contacts.store');
    Route::put('contacts/{contact}', [ContactController::class, 'update'])->name('contacts.update');
    Route::delete('contacts/{contact}', [ContactController::class, 'destroy'])->name('contacts.destroy');
    Route::get('api-tokens', [ApiTokenController::class, 'index'])->name('api-tokens.index');
    Route::post('api-tokens', [ApiTokenController::class, 'store'])->name('api-tokens.store');
    Route::delete('api-tokens/{token}', [ApiTokenController::class, 'destroy'])->name('api-tokens.destroy');
});
