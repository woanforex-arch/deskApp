<?php

use App\Enums\AccountType;
use App\Enums\InvoiceStatus;
use App\Enums\JournalEntryStatus;
use App\Http\Controllers\ReportController;
use App\Jobs\SendInvoiceReminder;
use App\Models\Account;
use App\Models\AccountingSetting;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Bill;
use App\Models\BillItem;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\User;
use App\Models\VendorPayment;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

it('redirects guests to the login screen', function () {
    $this->get('/dashboard')->assertRedirect('/login');
    $this->get('/invoices')->assertRedirect('/login');
});

it('renders the login and registration screens', function () {
    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Auth/Login'));

    $this->get('/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Auth/Register'));
});

it('authenticates a user through the web guard', function () {
    $user = User::factory()->create(['password' => 'password']);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
});

it('rejects invalid web credentials', function () {
    $user = User::factory()->create(['password' => 'password']);

    $this->from('/login')->post('/login', [
        'email' => $user->email,
        'password' => 'wrong',
    ])->assertRedirect('/login')->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('blocks deactivated users from signing in', function () {
    $user = User::factory()->create(['password' => 'password', 'is_active' => false]);

    $this->from('/login')->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect('/login')
        ->assertSessionHasErrors('email', 'This account has been deactivated. Contact an administrator to restore access.');

    $this->assertGuest();
});

it('edits and deletes currencies from the web UI', function () {
    Currency::create(['code' => 'USD', 'name' => 'US Dollar', 'rate_to_base' => 1, 'is_base' => true, 'is_active' => true]);
    $eur = Currency::create(['code' => 'EUR', 'name' => 'Euro', 'symbol' => '€', 'rate_to_base' => 1.1, 'is_active' => true]);
    ExchangeRate::create(['currency_code' => 'EUR', 'rate' => 1.1, 'effective_date' => '2026-01-01', 'source' => 'manual']);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/currencies')
        ->put("/currencies/{$eur->id}", [
            'code' => 'EUR',
            'name' => 'Euro (updated)',
            'symbol' => '€',
            'rate_to_base' => 1.08,
        ])->assertRedirect('/currencies');

    $eur->refresh();

    expect($eur->name)->toBe('Euro (updated)')
        ->and((float) $eur->rate_to_base)->toBe(1.08);

    // In-use currencies cannot change their code.
    Invoice::factory()->create(['currency' => 'EUR']);

    $this->actingAs($user)
        ->from('/currencies')
        ->put("/currencies/{$eur->id}", [
            'code' => 'EUX',
            'name' => 'Euro (updated)',
        ])->assertRedirect('/currencies')
        ->assertSessionHas('error');

    expect($eur->refresh()->code)->toBe('EUR');

    // Deletion guards.
    $base = Currency::query()->where('is_base', true)->firstOrFail();
    $this->actingAs($user)
        ->from('/currencies')
        ->delete("/currencies/{$base->id}")
        ->assertRedirect('/currencies')
        ->assertSessionHas('error');

    expect(Currency::query()->where('code', 'USD')->exists())->toBeTrue();

    $this->actingAs($user)
        ->from('/currencies')
        ->delete("/currencies/{$eur->id}")
        ->assertRedirect('/currencies')
        ->assertSessionHas('error');

    expect(Currency::query()->where('code', 'EUR')->exists())->toBeTrue();

    // Unused currencies (and their rates) delete cleanly.
    $jpy = Currency::create(['code' => 'JPY', 'name' => 'Japanese Yen', 'rate_to_base' => 150, 'is_active' => true]);
    ExchangeRate::create(['currency_code' => 'JPY', 'rate' => 150, 'effective_date' => '2026-01-01', 'source' => 'manual']);

    $this->actingAs($user)
        ->from('/currencies')
        ->delete("/currencies/{$jpy->id}")
        ->assertRedirect('/currencies');

    expect(Currency::query()->where('code', 'JPY')->exists())->toBeFalse()
        ->and(ExchangeRate::query()->where('currency_code', 'JPY')->exists())->toBeFalse();
});

it('saves accounting settings from the currencies page', function () {
    // Defaults surface before anything is saved.
    $this->actingAs(User::factory()->create())
        ->get('/currencies')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Currencies/Index')
            ->where('settings.accounting_method', 'accrual')
            ->where('settings.decimal_places', 2)
            ->where('settings.date_format', 'Y-m-d')
            ->where('settings.time_zone', 'UTC')
            ->where('dateFormats.0', 'Y-m-d')
            ->where('accountingMethods.1', 'cash')
        );

    $this->actingAs(User::factory()->create())
        ->from('/currencies')
        ->put('/currencies/settings', [
            'fy_start_date' => '2026-01-01',
            'fy_end_date' => '2026-12-31',
            'accounting_method' => 'cash',
            'decimal_places' => 3,
            'date_format' => 'd/m/Y',
            'time_zone' => 'Africa/Accra',
        ])->assertRedirect('/currencies')
        ->assertSessionHas('success', 'Accounting settings saved.');

    $settings = AccountingSetting::instance();

    expect($settings->fy_start_date->toDateString())->toBe('2026-01-01')
        ->and($settings->fy_end_date->toDateString())->toBe('2026-12-31')
        ->and($settings->accounting_method)->toBe('cash')
        ->and($settings->decimal_places)->toBe(3)
        ->and($settings->date_format)->toBe('d/m/Y')
        ->and($settings->time_zone)->toBe('Africa/Accra');

    // Unknown date formats are rejected.
    $this->actingAs(User::factory()->create())
        ->from('/currencies')
        ->put('/currencies/settings', [
            'fy_start_date' => null,
            'fy_end_date' => null,
            'accounting_method' => 'accrual',
            'decimal_places' => 2,
            'date_format' => 'Y.m.d',
            'time_zone' => 'UTC',
        ])->assertRedirect('/currencies')
        ->assertSessionHasErrors('date_format');

    // A financial year cannot end before it starts.
    $this->actingAs(User::factory()->create())
        ->from('/currencies')
        ->put('/currencies/settings', [
            'fy_start_date' => '2026-04-01',
            'fy_end_date' => '2026-03-31',
            'accounting_method' => 'accrual',
            'decimal_places' => 2,
            'date_format' => 'Y-m-d',
            'time_zone' => 'UTC',
        ])->assertRedirect('/currencies')
        ->assertSessionHas('error', 'Financial year end must come after the start date.');

    expect(AccountingSetting::instance()->accounting_method)->toBe('cash');
});

it('creates bills as draft when a non-approver requests direct approval', function () {
    $vendor = Contact::factory()->create(['type' => 'vendor']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5310']);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post('/bills', [
            'contact_id' => $vendor->id,
            'bill_date' => '2026-02-01',
            'due_date' => '2026-02-28',
            'status' => 'approved',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'February rent', 'quantity' => 1, 'unit_price' => 500],
            ],
        ])
        ->assertRedirect();

    $bill = Bill::query()->where('contact_id', $vendor->id)->firstOrFail();

    expect($bill->status)->toBe('draft')
        ->and($bill->approved_by)->toBeNull();

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->post('/bills', [
            'contact_id' => $vendor->id,
            'bill_date' => '2026-03-01',
            'due_date' => '2026-03-31',
            'status' => 'approved',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'March rent', 'quantity' => 1, 'unit_price' => 400],
            ],
        ])
        ->assertRedirect();

    $posted = Bill::query()->whereDate('bill_date', '2026-03-01')->firstOrFail();

    expect($posted->status)->toBe('approved');
});

it('creates a vendor while creating a bill from the web UI', function () {
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5311']);

    $this->actingAs(User::factory()->create())
        ->post('/bills', [
            'vendor_name' => 'Kofi Supplies',
            'vendor_email' => 'kofi@example.test',
            'vendor_phone' => '+233 20 333 4444',
            'bill_date' => '2026-11-12',
            'due_date' => '2026-12-12',
            'status' => 'draft',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'Packaging', 'quantity' => 3, 'unit_price' => 50],
            ],
        ])
        ->assertRedirect();

    $vendor = Contact::query()->where('email', 'kofi@example.test')->firstOrFail();
    $bill = Bill::query()->where('contact_id', $vendor->id)->firstOrFail();

    expect($vendor->name)->toBe('Kofi Supplies')
        ->and($vendor->phone)->toBe('+233 20 333 4444')
        ->and($vendor->type->value)->toBe('vendor')
        ->and((float) $bill->total)->toBe(150.0)
        ->and($bill->status)->toBe('draft');
});

it('logs a user out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/logout')->assertRedirect('/');

    $this->assertGuest();
});

it('renders the dashboard with live metrics', function () {
    $this->actingAs(User::factory()->create())
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->has('metrics')
            ->has('metrics.cash')
            ->has('metrics.monthly_revenue', 6)
            ->has('metrics.trial_balance')
            ->has('metrics.recent_invoices'));
});

it('renders the chart of accounts page', function () {
    Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100', 'name' => 'Cash']);

    $this->actingAs(User::factory()->create())
        ->get('/accounts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Accounts/Index')
            ->has('accounts', 1)
            ->has('summary', 5)
            ->has('types', 5));
});

it('exposes accounting configuration and financial settings on the chart of accounts page', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100', 'name' => 'Cash']);

    AccountingSetting::instance()->forceFill([
        'default_cash_account_id' => $cash->id,
        'opening_cash_balance' => 1500,
        'share_capital' => 1500,
    ])->save();

    $this->actingAs(User::factory()->create())
        ->get('/accounts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Accounts/Index')
            ->where('settings.default_cash_account_id', $cash->id)
            ->where('settings.opening_cash_balance', 1500)
            ->where('settings.share_capital', 1500)
            ->has('bankAccounts'));
});

it('saves the default ledger accounts used by automated postings', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $receivable = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1200']);
    $sales = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    $this->actingAs(User::factory()->create())
        ->put('/accounts/configuration', [
            'default_cash_account_id' => $cash->id,
            'default_receivable_account_id' => $receivable->id,
            'default_sales_account_id' => $sales->id,
            'default_payable_account_id' => null,
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'Accounting configuration saved.');

    $settings = AccountingSetting::instance();

    expect($settings->default_cash_account_id)->toBe($cash->id)
        ->and($settings->default_receivable_account_id)->toBe($receivable->id)
        ->and($settings->default_sales_account_id)->toBe($sales->id)
        ->and($settings->default_payable_account_id)->toBeNull();
});

it('rejects accounting configuration that references an unknown account', function () {
    $this->actingAs(User::factory()->create())
        ->put('/accounts/configuration', ['default_cash_account_id' => 999])
        ->assertSessionHasErrors('default_cash_account_id');

    expect(AccountingSetting::instance()->default_cash_account_id)->toBeNull();
});

it('saves the opening company financial information', function () {
    $this->actingAs(User::factory()->create())
        ->put('/accounts/financials', [
            'opening_fiscal_year' => 2026,
            'opening_cash_balance' => 10000,
            'opening_inventory_value' => 2500,
            'outstanding_customer_balances' => 750,
            'outstanding_supplier_balances' => 1250,
            'existing_assets_value' => 5000,
            'existing_liabilities_value' => 2000,
            'share_capital' => 15000,
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'Company financial information saved.');

    $settings = AccountingSetting::instance();

    expect($settings->opening_fiscal_year)->toBe(2026)
        ->and((float) $settings->opening_cash_balance)->toBe(10000.0)
        ->and((float) $settings->opening_inventory_value)->toBe(2500.0)
        ->and((float) $settings->outstanding_customer_balances)->toBe(750.0)
        ->and((float) $settings->outstanding_supplier_balances)->toBe(1250.0)
        ->and((float) $settings->existing_assets_value)->toBe(5000.0)
        ->and((float) $settings->existing_liabilities_value)->toBe(2000.0)
        ->and((float) $settings->share_capital)->toBe(15000.0);
});

it('validates the opening company financial information', function () {
    $this->actingAs(User::factory()->create())
        ->put('/accounts/financials', [
            'opening_fiscal_year' => 1800,
            'opening_cash_balance' => -10,
            'opening_inventory_value' => 'not-a-number',
        ])
        ->assertSessionHasErrors([
            'opening_fiscal_year',
            'opening_cash_balance',
            'opening_inventory_value',
        ]);
});

it('protects accounts that are used in the accounting configuration from deletion', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);

    AccountingSetting::instance()->forceFill(['default_cash_account_id' => $cash->id])->save();

    $this->actingAs(User::factory()->create())
        ->delete("/accounts/{$cash->id}")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Account::query()->whereKey($cash->id)->exists())->toBeTrue();
});

it('protects the ledger account behind the configured default bank account from deletion', function () {
    $gl = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1110']);
    $bank = BankAccount::create([
        'name' => 'Operating account',
        'gl_account_id' => $gl->id,
        'currency' => 'USD',
    ]);

    AccountingSetting::instance()->forceFill(['default_bank_account_id' => $bank->id])->save();

    $this->actingAs(User::factory()->create())
        ->delete("/accounts/{$gl->id}")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect(Account::query()->whereKey($gl->id)->exists())->toBeTrue();
});

it('renders the invoices index with filters and stats', function () {
    Invoice::factory()->sent()->create(['total' => 1000, 'subtotal' => 1000]);

    $this->actingAs(User::factory()->create())
        ->get('/invoices')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Invoices/Index')
            ->has('invoices.data', 1)
            ->has('stats')
            ->has('statuses', 5)
            ->where('filters.status', null));
});

it('renders a single invoice with its contact, items, and payments', function () {
    $contact = Contact::factory()->customer()->create();
    $invoice = Invoice::factory()->sent()->create([
        'contact_id' => $contact->id,
        'total' => 500,
        'subtotal' => 500,
    ]);

    InvoiceItem::factory()->for($invoice)->create([
        'description' => 'Advisory',
        'quantity' => 1,
        'unit_price' => 500,
        'tax_rate' => 0,
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/invoices/{$invoice->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Invoices/Show')
            ->where('invoice.number', $invoice->number)
            ->where('invoice.contact.name', $contact->name)
            ->has('invoice.items', 1)
            ->has('invoice.payments'));
});

it('renders the transaction receipts page with receipt stats and open invoices', function () {
    $customer = Contact::factory()->customer()->create();
    $invoice = Invoice::factory()->sent()->create([
        'contact_id' => $customer->id,
        'total' => 900,
        'subtotal' => 900,
        'amount_paid' => 0,
    ]);

    $payment = Payment::factory()->create([
        'invoice_id' => $invoice->id,
        'contact_id' => $customer->id,
        'paid_on' => '2026-11-05',
        'amount' => 250,
        'method' => 'bank_transfer',
        'reference' => 'RCT-1001',
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/transactions/receipts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Receipts')
            ->has('receipts.data', 1)
            ->where('receipts.data.0.id', $payment->id)
            ->where('receipts.data.0.invoice_number', $invoice->number)
            ->where('receipts.data.0.method_label', 'Bank transfer')
            ->where('filters.search', null)
            ->has('stats')
            ->has('invoices')
            ->has('customers')
            ->has('accounts')
            ->has('currencies')
            ->has('nextNumber')
            ->has('methods', 5));
});

it('reports week and month receipt stats used by the filter tiles', function () {
    $this->travelTo('2026-11-11 10:00:00');

    $customer = Contact::factory()->customer()->create();
    $invoice = Invoice::factory()->sent()->create([
        'contact_id' => $customer->id,
        'total' => 900,
        'subtotal' => 900,
        'amount_paid' => 0,
    ]);

    Payment::factory()->create([
        'invoice_id' => $invoice->id,
        'contact_id' => $customer->id,
        'paid_on' => '2026-11-10',
        'amount' => 125,
        'method' => 'cash',
    ]);

    Payment::factory()->create([
        'invoice_id' => $invoice->id,
        'contact_id' => $customer->id,
        'paid_on' => '2026-11-04',
        'amount' => 75,
        'method' => 'cash',
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/transactions/receipts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('stats.total', 200)
            ->where('stats.month', 200)
            ->where('stats.week_count', 1));

    $this->actingAs(User::factory()->create())
        ->get('/transactions/receipts?from=2026-11-10&to=2026-11-10')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('receipts.data', 1)
            ->where('receipts.data.0.amount', 125)
            ->where('filters.from', '2026-11-10')
            ->where('filters.to', '2026-11-10'));
});

it('records a sales receipt with a partial payment from the web UI', function () {
    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4300']);

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'contact_id' => $customer->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-12-11',
            'status' => 'sent',
            'currency' => 'USD',
            'terms' => 'Net 30',
            'ship_to' => '12 High Street, Accra, Ghana',
            'salesperson' => 'Ama Boateng',
            'ship_via' => 'Courier',
            'promised_date' => '2026-11-15',
            'delivery_status' => 'In transit',
            'sales_type' => 'Product',
            'notes' => 'Hotel stay and dinner',
            'items' => [
                ['account_id' => $revenue->id, 'description' => 'Deluxe room', 'quantity' => 2, 'unit_price' => 200, 'tax_rate' => 25],
            ],
            'payment' => [
                'amount' => 150,
                'paid_on' => '2026-11-11',
                'method' => 'cash',
                'reference' => 'CASH-100',
            ],
        ])
        ->assertRedirect('/transactions/receipts')
        ->assertSessionHas('success');

    $invoice = Invoice::query()->where('contact_id', $customer->id)->firstOrFail();

    expect((float) $invoice->subtotal)->toBe(400.0)
        ->and((float) $invoice->tax_total)->toBe(100.0)
        ->and((float) $invoice->total)->toBe(500.0)
        ->and((float) $invoice->amount_paid)->toBe(150.0)
        ->and($invoice->status)->toBe(InvoiceStatus::Sent)
        ->and($invoice->ship_to)->toBe('12 High Street, Accra, Ghana')
        ->and($invoice->salesperson)->toBe('Ama Boateng')
        ->and($invoice->ship_via)->toBe('Courier')
        ->and($invoice->promised_date?->toDateString())->toBe('2026-11-15')
        ->and($invoice->delivery_status)->toBe('In transit')
        ->and($invoice->sales_type)->toBe('Product')
        ->and($invoice->terms)->toBe('Net 30');

    $payment = Payment::query()->where('invoice_id', $invoice->id)->firstOrFail();

    expect((float) $payment->amount)->toBe(150.0)
        ->and($payment->method->value)->toBe('cash')
        ->and($payment->reference)->toBe('CASH-100')
        ->and($payment->receipt_number)->toStartWith('RCT-2026-');
});

it('applies a discount to a sales receipt and posts a balanced discount entry', function () {
    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4300']);

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'contact_id' => $customer->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'status' => 'sent',
            'currency' => 'USD',
            'discount' => 50,
            'items' => [
                ['account_id' => $revenue->id, 'description' => 'Deluxe room', 'quantity' => 2, 'unit_price' => 200, 'tax_rate' => 25],
            ],
            'payment' => [
                'amount' => 450,
                'paid_on' => '2026-11-11',
                'method' => 'cash',
            ],
        ])
        ->assertRedirect('/transactions/receipts')
        ->assertSessionHas('success');

    $invoice = Invoice::query()->where('contact_id', $customer->id)->firstOrFail();

    expect((float) $invoice->subtotal)->toBe(400.0)
        ->and((float) $invoice->tax_total)->toBe(100.0)
        ->and((float) $invoice->discount)->toBe(50.0)
        ->and((float) $invoice->total)->toBe(450.0)
        ->and((float) $invoice->amount_paid)->toBe(450.0)
        ->and($invoice->balanceDue())->toBe(0.0)
        ->and($invoice->status)->toBe(InvoiceStatus::Paid);

    $entry = JournalEntry::query()
        ->where('source_type', Invoice::class)
        ->where('source_id', $invoice->id)
        ->firstOrFail();

    expect((float) $entry->lines()->sum('debit'))->toBe((float) $entry->lines()->sum('credit'));

    $discountLine = $entry->lines()->where('description', 'like', 'Discount on %')->first();

    expect($discountLine)->not->toBeNull()
        ->and((float) $discountLine->debit)->toBe(50.0);

    $payment = Payment::query()->where('invoice_id', $invoice->id)->firstOrFail();

    $this->actingAs($user)
        ->get("/transactions/receipts/{$payment->id}/print")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/PrintReceipt')
            ->where('receipt.invoice.discount', 50)
            ->where('receipt.invoice.total', 450)
            ->where('receipt.invoice.balance_due', 0));
});

it('rejects a sales receipt discount larger than the receipt total', function () {
    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create();

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'contact_id' => $customer->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'currency' => 'USD',
            'discount' => 150,
            'items' => [
                ['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 0],
        ])
        ->assertSessionHasErrors('discount');

    expect(Invoice::query()->where('contact_id', $customer->id)->exists())->toBeFalse();
});

it('prints a receipt for a recorded payment', function () {
    $user = User::factory()->create();
    $invoice = Invoice::factory()->sent()->withItems(1)->create([
        'number' => 'INV-2026-0042',
        'sales_type' => 'Wholesale',
        'salesperson' => 'Ama Boateng',
        'terms' => 'Net 15',
        'subtotal' => 200,
        'tax_total' => 0,
        'total' => 200,
        'amount_paid' => 200,
    ]);

    $payment = Payment::factory()->create([
        'invoice_id' => $invoice->id,
        'contact_id' => $invoice->contact_id,
        'receipt_number' => 'RCT-2026-0007',
        'amount' => 200,
        'paid_on' => '2026-11-11',
        'method' => 'bank_transfer',
        'reference' => 'TRX-9981',
        'currency' => 'USD',
    ]);

    $this->actingAs($user)
        ->get("/transactions/receipts/{$payment->id}/print")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/PrintReceipt')
            ->where('receipt.receipt_number', 'RCT-2026-0007')
            ->where('receipt.amount', 200)
            ->where('receipt.method', 'Bank transfer')
            ->where('receipt.invoice.number', 'INV-2026-0042')
            ->where('receipt.invoice.sales_type', 'Wholesale')
            ->has('receipt.invoice.items', 1));
});

it('creates a new customer and saves a sales receipt as a draft', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'customer_name' => 'Kofi Mensah',
            'customer_email' => 'kofi@example.com',
            'customer_phone' => '+233200000000',
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'status' => 'draft',
            'currency' => 'GHS',
            'items' => [
                ['description' => 'Pool day pass', 'quantity' => 3, 'unit_price' => 50, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 0],
        ])
        ->assertRedirect('/transactions/receipts')
        ->assertSessionHas('success');

    $customer = Contact::query()->where('email', 'kofi@example.com')->firstOrFail();
    $invoice = Invoice::query()->where('contact_id', $customer->id)->firstOrFail();

    expect($customer->name)->toBe('Kofi Mensah')
        ->and($customer->phone)->toBe('+233200000000')
        ->and($invoice->status)->toBe(InvoiceStatus::Draft)
        ->and((float) $invoice->total)->toBe(150.0)
        ->and((float) $invoice->amount_paid)->toBe(0.0);

    expect(Payment::query()->where('invoice_id', $invoice->id)->exists())->toBeFalse();
});

it('rejects a sales receipt payment larger than the receipt total', function () {
    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create();

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'contact_id' => $customer->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'currency' => 'USD',
            'items' => [
                ['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 150, 'method' => 'cash'],
        ])
        ->assertSessionHasErrors('payment.amount');

    expect(Invoice::query()->where('contact_id', $customer->id)->exists())->toBeFalse();
});

it('rejects a sales receipt payment on a draft receipt', function () {
    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create();

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'contact_id' => $customer->id,
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'status' => 'draft',
            'currency' => 'USD',
            'items' => [
                ['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 50, 'method' => 'cash'],
        ])
        ->assertSessionHasErrors('payment.amount');

    expect(Invoice::query()->where('contact_id', $customer->id)->exists())->toBeFalse();
});

it('requires a customer when recording a sales receipt', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/transactions/receipts', [
            'issue_date' => '2026-11-11',
            'due_date' => '2026-11-11',
            'currency' => 'USD',
            'items' => [
                ['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
        ])
        ->assertSessionHasErrors('customer_name');
});

it('renders the transaction payments page with vendor payments and open bills', function () {
    $vendor = Contact::factory()->vendor()->create();
    $bill = Bill::create([
        'contact_id' => $vendor->id,
        'number' => 'BILL-2026-0001',
        'bill_date' => '2026-11-01',
        'due_date' => '2026-11-30',
        'status' => 'approved',
        'currency' => 'USD',
        'subtotal' => 500,
        'tax_total' => 0,
        'total' => 500,
        'amount_paid' => 0,
    ]);

    $payment = VendorPayment::create([
        'bill_id' => $bill->id,
        'contact_id' => $vendor->id,
        'paid_on' => '2026-11-06',
        'amount' => 200,
        'method' => 'bank_transfer',
        'reference' => 'VP-1001',
        'currency' => 'USD',
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/transactions/payments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Payments')
            ->has('payments.data', 1)
            ->where('payments.data.0.id', $payment->id)
            ->where('payments.data.0.bill', 'BILL-2026-0001')
            ->has('stats')
            ->has('bills')
            ->has('vendors')
            ->has('accounts')
            ->has('nextBillNumber')
            ->where('canApprove', false)
            ->has('methods', 5));
});

it('settles an existing open bill from the payments page', function () {
    $this->travelTo('2026-11-11 10:00:00');

    $user = User::factory()->create(['role' => 'approver']);
    $vendor = Contact::factory()->vendor()->create(['name' => 'Accra Office Supplies']);
    $bill = Bill::create([
        'contact_id' => $vendor->id,
        'number' => 'BILL-2026-0100',
        'bill_date' => '2026-11-01',
        'due_date' => '2026-11-10',
        'status' => 'approved',
        'currency' => 'USD',
        'subtotal' => 750,
        'tax_total' => 0,
        'total' => 750,
        'amount_paid' => 0,
    ]);

    BillItem::create([
        'bill_id' => $bill->id,
        'description' => 'Office supplies',
        'quantity' => 1,
        'unit_price' => 750,
        'tax_rate' => 0,
    ]);

    $this->actingAs($user)
        ->get('/transactions/payments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Payments')
            ->has('bills', 1)
            ->where('bills.0.id', $bill->id)
            ->where('bills.0.number', 'BILL-2026-0100')
            ->where('bills.0.contact', 'Accra Office Supplies')
            ->where('bills.0.status', 'approved')
            ->where('bills.0.bill_date', '2026-11-01')
            ->where('bills.0.due_date', '2026-11-10')
            ->where('bills.0.is_overdue', true)
            ->where('bills.0.balance_due', 750));

    $this->actingAs($user)
        ->post('/vendor-payments', [
            'bill_id' => $bill->id,
            'contact_id' => $vendor->id,
            'paid_on' => '2026-11-11',
            'amount' => 750,
            'method' => 'bank_transfer',
            'reference' => 'BILL-SETTLE-1',
            'notes' => 'Settled from the payments page.',
            'currency' => 'USD',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $bill->refresh();

    expect((float) $bill->amount_paid)->toBe(750.0)
        ->and($bill->balanceDue())->toBe(0.0)
        ->and($bill->status)->toBe('paid');

    $payment = VendorPayment::query()->where('bill_id', $bill->id)->firstOrFail();

    expect($payment->reference)->toBe('BILL-SETTLE-1')
        ->and($payment->payment_number)->toStartWith('VPAY-2026-')
        ->and($payment->method)->toBe('bank_transfer')
        ->and((float) $payment->amount)->toBe(750.0);

    $entry = JournalEntry::query()
        ->where('source_type', VendorPayment::class)
        ->where('source_id', $payment->id)
        ->firstOrFail();

    $lines = $entry->lines()->with('account')->get();
    $payableLine = $lines->first(fn ($line) => $line->account?->code === '2100');
    $cashLine = $lines->first(fn ($line) => $line->account?->code === '1100');

    expect($payableLine)->not->toBeNull()
        ->and((float) $payableLine->debit)->toBe(750.0)
        ->and($cashLine)->not->toBeNull()
        ->and((float) $cashLine->credit)->toBe(750.0);

    $this->actingAs($user)
        ->get('/transactions/payments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Payments')
            ->has('bills', 0)
            ->has('payments.data', 1)
            ->where('payments.data.0.bill', 'BILL-2026-0100')
            ->where('payments.data.0.payment_number', $payment->payment_number));
});

it('blocks a non-approver from settling an open bill', function () {
    $user = User::factory()->create(['role' => 'accountant']);
    $vendor = Contact::factory()->vendor()->create();
    $bill = Bill::create([
        'contact_id' => $vendor->id,
        'number' => 'BILL-2026-0101',
        'bill_date' => '2026-11-01',
        'due_date' => '2026-11-10',
        'status' => 'approved',
        'currency' => 'USD',
        'subtotal' => 300,
        'tax_total' => 0,
        'total' => 300,
        'amount_paid' => 0,
    ]);

    BillItem::create([
        'bill_id' => $bill->id,
        'description' => 'Stationery',
        'quantity' => 1,
        'unit_price' => 300,
        'tax_rate' => 0,
    ]);

    $this->actingAs($user)
        ->post('/vendor-payments', [
            'bill_id' => $bill->id,
            'contact_id' => $vendor->id,
            'paid_on' => '2026-11-11',
            'amount' => 300,
            'method' => 'bank_transfer',
            'reference' => 'BILL-SETTLE-BLOCKED',
            'currency' => 'USD',
        ])
        ->assertSessionHasErrors('amount');

    expect((float) $bill->fresh()->amount_paid)->toBe(0.0)
        ->and($bill->fresh()->balanceDue())->toBe(300.0)
        ->and(VendorPayment::query()->where('bill_id', $bill->id)->exists())->toBeFalse();
});

it('creates an expense with line items and an immediate payment', function () {
    $vendor = Contact::factory()->vendor()->create();
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5320']);
    $bank = BankAccount::create([
        'name' => 'Operating account',
        'currency' => 'USD',
        'opening_balance' => 0,
        'current_balance' => 0,
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->post('/transactions/payments', [
            'contact_id' => $vendor->id,
            'bill_date' => '2026-11-11',
            'due_date' => '2026-11-30',
            'status' => 'approved',
            'currency' => 'USD',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'Office supplies', 'quantity' => 2, 'unit_price' => 100, 'tax_rate' => 10],
            ],
            'payment' => [
                'amount' => 110,
                'paid_on' => '2026-11-11',
                'method' => 'bank_transfer',
                'reference' => 'PAY-9001',
                'bank_account_id' => $bank->id,
            ],
        ])
        ->assertRedirect('/transactions/payments')
        ->assertSessionHas('success');

    $bill = Bill::query()->where('contact_id', $vendor->id)->firstOrFail();

    expect((float) $bill->subtotal)->toBe(200.0)
        ->and((float) $bill->tax_total)->toBe(20.0)
        ->and((float) $bill->total)->toBe(220.0)
        ->and((float) $bill->amount_paid)->toBe(110.0)
        ->and($bill->status)->toBe('partial')
        ->and($bill->journal_entry_id)->not->toBeNull();

    $payment = VendorPayment::query()->where('bill_id', $bill->id)->firstOrFail();

    expect((float) $payment->amount)->toBe(110.0)
        ->and($payment->reference)->toBe('PAY-9001')
        ->and($payment->payment_number)->toStartWith('VPAY-2026-')
        ->and($payment->bank_account_id)->toBe($bank->id);
});

it('creates a vendor while recording an expense', function () {
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5350']);

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->post('/transactions/payments', [
            'vendor_name' => 'Kofi Supplies',
            'vendor_email' => 'kofi@supplies.test',
            'vendor_phone' => '+233200000000',
            'bill_date' => '2026-11-11',
            'due_date' => '2026-11-30',
            'status' => 'approved',
            'currency' => 'USD',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'Cleaning supplies', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 0],
        ])
        ->assertRedirect('/transactions/payments')
        ->assertSessionHas('success');

    $vendor = Contact::query()->where('email', 'kofi@supplies.test')->firstOrFail();

    expect($vendor->name)->toBe('Kofi Supplies')
        ->and($vendor->phone)->toBe('+233200000000')
        ->and($vendor->type->value)->toBe('vendor')
        ->and($vendor->is_active)->toBeTrue();

    $bill = Bill::query()->where('contact_id', $vendor->id)->firstOrFail();

    expect((float) $bill->total)->toBe(100.0)
        ->and($bill->status)->toBe('approved');
});

it('requires a vendor or a new vendor name when recording an expense', function () {
    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->post('/transactions/payments', [
            'bill_date' => '2026-11-11',
            'due_date' => '2026-11-30',
            'status' => 'approved',
            'currency' => 'USD',
            'items' => [
                ['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 0],
        ])
        ->assertSessionHasErrors('vendor_name');
});

it('rejects an expense payment larger than the expense total', function () {
    $vendor = Contact::factory()->vendor()->create();
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5330']);

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->post('/transactions/payments', [
            'contact_id' => $vendor->id,
            'bill_date' => '2026-11-11',
            'due_date' => '2026-11-30',
            'status' => 'approved',
            'currency' => 'USD',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 150, 'method' => 'cash'],
        ])
        ->assertSessionHasErrors('payment.amount');

    expect(Bill::query()->where('contact_id', $vendor->id)->exists())->toBeFalse();
});

it('blocks an immediate payment from a non-approver', function () {
    $vendor = Contact::factory()->vendor()->create();
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5340']);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post('/transactions/payments', [
            'contact_id' => $vendor->id,
            'bill_date' => '2026-11-11',
            'due_date' => '2026-11-30',
            'status' => 'approved',
            'currency' => 'USD',
            'items' => [
                ['account_id' => $expense->id, 'description' => 'Stationery', 'quantity' => 1, 'unit_price' => 100, 'tax_rate' => 0],
            ],
            'payment' => ['amount' => 50, 'method' => 'cash'],
        ])
        ->assertSessionHasErrors('payment.amount');

    expect(Bill::query()->where('contact_id', $vendor->id)->exists())->toBeFalse();
});

it('renders the contacts page with stats and types', function () {
    Contact::factory()->count(2)->create();

    $this->actingAs(User::factory()->create())
        ->get('/contacts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Contacts/Index')
            ->has('contacts.data', 2)
            ->has('stats')
            ->has('types', 3));
});

it('renders the journal page with a trial balance', function () {
    $this->actingAs(User::factory()->create())
        ->get('/journal')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Journal/Index')
            ->has('entries.data')
            ->has('trialBalance')
            ->where('trialBalance.balanced', true)
            ->has('statuses', 3));
});

it('renders every financial report page', function () {
    Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100', 'name' => 'Cash']);
    $user = User::factory()->create();

    foreach (array_keys(ReportController::REPORTS) as $report) {
        $this->actingAs($user)
            ->get("/reports/{$report}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Show')
                ->where('report.key', $report)
                ->has('data')
                ->has('filters')
                ->has('options'));
    }
});

it('enforces role based access to administrative controls', function () {
    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->get('/platform')
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'approver']))
        ->get('/platform')
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->get('/platform')
        ->assertOk();
});

it('renders the api tokens page', function () {
    $user = User::factory()->create();
    $user->createToken('existing');

    $this->actingAs($user)
        ->get('/api-tokens')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('ApiTokens/Index')
            ->has('tokens', 1)
            ->where('tokens.0.name', 'existing')
            ->has('apiBaseUrl'));
});

it('marks a draft invoice as sent from the web UI', function () {
    $invoice = Invoice::factory()->create();

    $this->actingAs(User::factory()->create())
        ->post("/invoices/{$invoice->id}/send")
        ->assertRedirect();

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Sent);
});

it('does not send invoices that are already sent', function () {
    $invoice = Invoice::factory()->sent()->create();

    $this->actingAs(User::factory()->create())
        ->post("/invoices/{$invoice->id}/send")
        ->assertRedirect()
        ->assertSessionHas('error');
});

it('queues a reminder for open invoices from the web UI', function () {
    Queue::fake();

    $invoice = Invoice::factory()->overdue()->create();

    $this->actingAs(User::factory()->create())
        ->post("/invoices/{$invoice->id}/reminder")
        ->assertRedirect()
        ->assertSessionHas('success');

    Queue::assertPushed(SendInvoiceReminder::class);
});

it('creates and revokes api tokens from the web UI', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/api-tokens', [
            'name' => 'Reporting',
            'abilities' => ['read', 'write'],
        ])
        ->assertRedirect()
        ->assertSessionHas('plain_text_token')
        ->assertSessionHas('success');

    $this->assertDatabaseHas('personal_access_tokens', ['name' => 'Reporting']);

    $token = $user->tokens()->where('name', 'Reporting')->firstOrFail();

    $this->actingAs($user)
        ->delete("/api-tokens/{$token->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->id]);
});

it('validates api token creation', function () {
    $this->actingAs(User::factory()->create())
        ->post('/api-tokens', ['name' => '', 'abilities' => []])
        ->assertSessionHasErrors(['name', 'abilities']);
});

it('creates, updates, and deletes accounts from the web UI', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/accounts', [
            'code' => '1150',
            'name' => 'Petty cash',
            'type' => 'asset',
            'category' => 'cash',
            'currency' => 'USD',
            'is_control' => true,
            'opening_balance' => 250,
            'description' => 'Branch float',
            'is_active' => true,
        ])
        ->assertRedirect('/accounts')
        ->assertSessionHas('success');

    $account = Account::query()->where('code', '1150')->firstOrFail();

    expect($account->category)->toBe('cash')
        ->and($account->currency)->toBe('USD')
        ->and((bool) $account->is_control)->toBeTrue()
        ->and((float) $account->opening_balance)->toBe(250.0);

    $this->actingAs($user)
        ->put("/accounts/{$account->id}", [
            'code' => '1150',
            'name' => 'Petty cash float',
            'type' => 'asset',
            'category' => 'current_asset',
            'currency' => 'EUR',
            'is_control' => false,
            'opening_balance' => 100,
            'is_active' => false,
        ])
        ->assertRedirect('/accounts');

    $account->refresh();

    expect($account->name)->toBe('Petty cash float')
        ->and($account->category)->toBe('current_asset')
        ->and($account->currency)->toBe('EUR')
        ->and((bool) $account->is_control)->toBeFalse()
        ->and((float) $account->opening_balance)->toBe(100.0)
        ->and($account->is_active)->toBeFalse();

    $this->actingAs($user)
        ->delete("/accounts/{$account->id}")
        ->assertRedirect('/accounts');

    $this->assertDatabaseMissing('accounts', ['id' => $account->id]);
});

it('creates, updates, and deletes contacts from the web UI', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/contacts', [
            'name' => 'Northwind Traders',
            'email' => 'billing@northwind.test',
            'phone' => '+1 555 0100',
            'type' => 'customer',
            'city' => 'Seattle',
            'country' => 'United States',
            'is_active' => true,
        ])
        ->assertRedirect('/contacts')
        ->assertSessionHas('success');

    $contact = Contact::query()->where('email', 'billing@northwind.test')->firstOrFail();

    $this->actingAs($user)
        ->put("/contacts/{$contact->id}", [
            'name' => 'Northwind Traders Ltd',
            'type' => 'both',
            'is_active' => true,
        ])
        ->assertRedirect('/contacts');

    expect($contact->fresh()->name)->toBe('Northwind Traders Ltd');

    $this->actingAs($user)
        ->delete("/contacts/{$contact->id}")
        ->assertRedirect('/contacts');

    $this->assertDatabaseMissing('contacts', ['id' => $contact->id]);
});

it('creates an invoice and records a payment from the web UI', function () {
    $user = User::factory()->create();
    $contact = Contact::factory()->customer()->create();

    $this->actingAs($user)
        ->post('/invoices', [
            'contact_id' => $contact->id,
            'issue_date' => '2026-11-01',
            'due_date' => '2026-11-30',
            'status' => 'sent',
            'currency' => 'USD',
            'notes' => 'Web created invoice',
            'items' => [
                ['description' => 'Consulting', 'quantity' => 2, 'unit_price' => 250, 'tax_rate' => 0],
            ],
        ])
        ->assertRedirect();

    $invoice = Invoice::query()->where('contact_id', $contact->id)->firstOrFail();

    expect((float) $invoice->total)->toBe(500.0)
        ->and($invoice->status)->toBe(InvoiceStatus::Sent);

    $this->actingAs($user)
        ->post("/invoices/{$invoice->id}/payments", [
            'paid_on' => '2026-11-05',
            'amount' => 200,
            'method' => 'bank_transfer',
            'reference' => 'WEB-PAY-1',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect((float) $invoice->fresh()->amount_paid)->toBe(200.0);
});

it('creates a customer while creating an invoice from the web UI', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/invoices', [
            'customer_name' => 'Akosua Mensah',
            'customer_email' => 'akosua@example.test',
            'customer_phone' => '+233 20 111 2222',
            'issue_date' => '2026-11-12',
            'due_date' => '2026-12-12',
            'status' => 'draft',
            'currency' => 'USD',
            'items' => [
                ['description' => 'Design work', 'quantity' => 1, 'unit_price' => 400, 'tax_rate' => 0],
            ],
        ])
        ->assertRedirect();

    $contact = Contact::query()->where('email', 'akosua@example.test')->firstOrFail();
    $invoice = Invoice::query()->where('contact_id', $contact->id)->firstOrFail();

    expect($contact->name)->toBe('Akosua Mensah')
        ->and($contact->phone)->toBe('+233 20 111 2222')
        ->and($contact->type->value)->toBe('customer')
        ->and((float) $invoice->total)->toBe(400.0)
        ->and($invoice->status)->toBe(InvoiceStatus::Draft);
});

it('settles an existing open invoice from the receipts page', function () {
    $this->travelTo('2026-11-11 10:00:00');

    $user = User::factory()->create();
    $customer = Contact::factory()->customer()->create(['name' => 'Ama Boateng']);
    $invoice = Invoice::factory()->sent()->create([
        'contact_id' => $customer->id,
        'issue_date' => '2026-11-01',
        'due_date' => '2026-11-10',
        'currency' => 'USD',
        'subtotal' => 500,
        'tax_total' => 0,
        'total' => 500,
        'amount_paid' => 0,
    ]);

    $this->actingAs($user)
        ->get('/transactions/receipts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Receipts')
            ->has('invoices', 1)
            ->where('invoices.0.id', $invoice->id)
            ->where('invoices.0.number', $invoice->number)
            ->where('invoices.0.contact', 'Ama Boateng')
            ->where('invoices.0.status', 'sent')
            ->where('invoices.0.issue_date', '2026-11-01')
            ->where('invoices.0.due_date', '2026-11-10')
            ->where('invoices.0.balance_due', 500));

    $this->actingAs($user)
        ->post("/invoices/{$invoice->id}/payments", [
            'paid_on' => '2026-11-11',
            'amount' => 500,
            'method' => 'cash',
            'reference' => 'CASH-APPLY-1',
            'notes' => 'Settled from the receipts page.',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $invoice->refresh();

    expect((float) $invoice->amount_paid)->toBe(500.0)
        ->and($invoice->balanceDue())->toBe(0.0)
        ->and($invoice->status)->toBe(InvoiceStatus::Paid)
        ->and($invoice->paid_at)->not->toBeNull();

    $payment = Payment::query()->where('invoice_id', $invoice->id)->firstOrFail();

    expect($payment->receipt_number)->toStartWith('RCT-2026-')
        ->and($payment->method->value)->toBe('cash')
        ->and((float) $payment->amount)->toBe(500.0);

    $entry = JournalEntry::query()
        ->where('source_type', Payment::class)
        ->where('source_id', $payment->id)
        ->firstOrFail();

    $lines = $entry->lines()->with('account')->get();
    $cashLine = $lines->first(fn ($line) => $line->account?->code === '1100');
    $receivableLine = $lines->first(fn ($line) => $line->account?->code === '1200');

    expect($cashLine)->not->toBeNull()
        ->and((float) $cashLine->debit)->toBe(500.0)
        ->and($receivableLine)->not->toBeNull()
        ->and((float) $receivableLine->credit)->toBe(500.0);

    $this->actingAs($user)
        ->get('/transactions/receipts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/Receipts')
            ->has('invoices', 0)
            ->has('receipts.data', 1)
            ->where('receipts.data.0.receipt_number', $payment->receipt_number)
            ->where('receipts.data.0.invoice_number', $invoice->number));

    $this->actingAs($user)
        ->get("/transactions/receipts/{$payment->id}/print")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Transactions/PrintReceipt')
            ->where('receipt.receipt_number', $payment->receipt_number)
            ->where('receipt.invoice.balance_due', 0));
});

it('deletes only draft invoices from the web UI', function () {
    $user = User::factory()->create();
    $draft = Invoice::factory()->create();
    $sent = Invoice::factory()->sent()->create();

    $this->actingAs($user)
        ->delete("/invoices/{$draft->id}")
        ->assertRedirect('/invoices');

    $this->assertDatabaseMissing('invoices', ['id' => $draft->id]);

    $this->actingAs($user)
        ->delete("/invoices/{$sent->id}")
        ->assertRedirect()
        ->assertSessionHas('error');

    $this->assertDatabaseHas('invoices', ['id' => $sent->id]);
});

it('creates and posts a balanced journal entry from the web UI', function () {
    $user = User::factory()->create();
    $debit = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1500']);
    $credit = Account::factory()->ofType(AccountType::Equity)->create(['code' => '3100']);

    $this->actingAs($user)
        ->post('/journal', [
            'entry_date' => '2026-11-02',
            'memo' => 'Owner contribution',
            'status' => 'draft',
            'lines' => [
                ['account_id' => $debit->id, 'description' => 'Bank', 'debit' => 1000, 'credit' => 0],
                ['account_id' => $credit->id, 'description' => 'Capital', 'debit' => 0, 'credit' => 1000],
            ],
        ])
        ->assertRedirect('/journal')
        ->assertSessionHas('success');

    $entry = JournalEntry::query()->where('memo', 'Owner contribution')->firstOrFail();

    expect($entry->isBalanced())->toBeTrue();

    $this->actingAs($user)
        ->post("/journal/{$entry->id}/post")
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($entry->fresh()->status)->toBe(JournalEntryStatus::Posted);
});

it('deletes a void journal entry together with its reversal from the web UI', function () {
    $user = User::factory()->create();
    $debit = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1510']);
    $credit = Account::factory()->ofType(AccountType::Equity)->create(['code' => '3110']);

    $entry = JournalEntry::create([
        'reference' => JournalEntry::generateReference(),
        'entry_date' => '2026-11-02',
        'memo' => 'Duplicate to purge',
        'status' => JournalEntryStatus::Draft,
        'created_by' => $user->id,
    ]);

    $entry->lines()->createMany([
        ['account_id' => $debit->id, 'description' => 'Bank', 'debit' => 500, 'credit' => 0],
        ['account_id' => $credit->id, 'description' => 'Capital', 'debit' => 0, 'credit' => 500],
    ]);

    $this->actingAs($user)->post("/journal/{$entry->id}/post")->assertSessionHas('success');
    $this->actingAs($user)->post("/journal/{$entry->id}/void")->assertSessionHas('success');

    $entry->refresh();
    $reversalId = $entry->reversal_of_id;

    expect($entry->status)->toBe(JournalEntryStatus::Void)
        ->and($reversalId)->not->toBeNull();

    $this->actingAs($user)
        ->delete("/journal/{$entry->id}/void")
        ->assertRedirect()
        ->assertSessionHas('success');

    $this->assertDatabaseMissing('journal_entries', ['id' => $entry->id]);
    $this->assertDatabaseMissing('journal_entries', ['id' => $reversalId]);
});

it('refuses to delete a void entry request for a posted journal entry', function () {
    $user = User::factory()->create();
    $debit = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1520']);
    $credit = Account::factory()->ofType(AccountType::Equity)->create(['code' => '3120']);

    $entry = JournalEntry::create([
        'reference' => JournalEntry::generateReference(),
        'entry_date' => '2026-11-02',
        'memo' => 'Posted only',
        'status' => JournalEntryStatus::Draft,
        'created_by' => $user->id,
    ]);

    $entry->lines()->createMany([
        ['account_id' => $debit->id, 'description' => 'Bank', 'debit' => 750, 'credit' => 0],
        ['account_id' => $credit->id, 'description' => 'Capital', 'debit' => 0, 'credit' => 750],
    ]);

    $this->actingAs($user)->post("/journal/{$entry->id}/post");

    $this->actingAs($user)
        ->delete("/journal/{$entry->id}/void")
        ->assertRedirect()
        ->assertSessionHas('error');

    $this->assertDatabaseHas('journal_entries', ['id' => $entry->id]);
});

it('filters journal entries by date and sorts the results', function () {
    $user = User::factory()->create();

    $older = JournalEntry::factory()->create([
        'reference' => 'JE-202601-0001',
        'entry_date' => '2026-01-05',
        'memo' => 'Older entry',
        'status' => JournalEntryStatus::Posted,
    ]);

    $newer = JournalEntry::factory()->create([
        'reference' => 'JE-202602-0002',
        'entry_date' => '2026-02-10',
        'memo' => 'Newer entry',
        'status' => JournalEntryStatus::Posted,
    ]);

    $this->actingAs($user)
        ->get('/journal?from=2026-02-01&to=2026-02-28&sort=entry_date&direction=asc')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Journal/Index')
            ->has('entries.data', 1)
            ->where('entries.data.0.id', $newer->id)
            ->where('filters.from', '2026-02-01')
            ->where('filters.to', '2026-02-28')
            ->where('filters.sort', 'entry_date')
            ->where('filters.direction', 'asc'));

    $this->actingAs($user)
        ->get('/journal?sort=entry_date&direction=asc')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('entries.data.0.id', $older->id)
            ->where('entries.data.1.id', $newer->id));

    $this->actingAs($user)
        ->get('/journal')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('entries.data.0.id', $newer->id)
            ->where('entries.data.1.id', $older->id));
});

it('scopes the journal trial balance to the active filters', function () {
    $user = User::factory()->create();
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1540']);
    $capital = Account::factory()->ofType(AccountType::Equity)->create(['code' => '3140']);

    $january = JournalEntry::factory()->create([
        'reference' => 'JE-202601-0100',
        'entry_date' => '2026-01-05',
        'memo' => 'January capital',
        'status' => JournalEntryStatus::Posted,
    ]);
    $january->lines()->createMany([
        ['account_id' => $cash->id, 'description' => 'Bank', 'debit' => 120, 'credit' => 0],
        ['account_id' => $capital->id, 'description' => 'Capital', 'debit' => 0, 'credit' => 120],
    ]);

    $february = JournalEntry::factory()->create([
        'reference' => 'JE-202602-0101',
        'entry_date' => '2026-02-10',
        'memo' => 'February capital',
        'status' => JournalEntryStatus::Posted,
    ]);
    $february->lines()->createMany([
        ['account_id' => $cash->id, 'description' => 'Bank', 'debit' => 480, 'credit' => 0],
        ['account_id' => $capital->id, 'description' => 'Capital', 'debit' => 0, 'credit' => 480],
    ]);

    $assertDebit = fn (Assert $page, float $expected) => $page
        ->where('trialBalance.debit', fn ($value) => (float) $value === $expected)
        ->where('trialBalance.credit', fn ($value) => (float) $value === $expected)
        ->where('trialBalance.difference', fn ($value) => (float) $value === 0.0);
    $assertZero = fn (Assert $page) => $page
        ->where('trialBalance.debit', fn ($value) => (float) $value === 0.0)
        ->where('trialBalance.credit', fn ($value) => (float) $value === 0.0)
        ->where('trialBalance.difference', fn ($value) => (float) $value === 0.0)
        ->where('trialBalance.balanced', true);

    $this->actingAs($user)
        ->get('/journal?from=2026-02-01&to=2026-02-28')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $assertDebit($page, 480.0));

    $this->actingAs($user)
        ->get('/journal?search=February')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $assertDebit($page, 480.0));

    $this->actingAs($user)
        ->get('/journal?status=posted')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $assertDebit($page, 600.0));

    $this->actingAs($user)
        ->get('/journal?status=draft')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $assertZero($page));
});

it('blocks write actions for read-only roles', function () {
    $viewer = User::factory()->create(['role' => 'viewer']);

    $this->actingAs($viewer)
        ->get('/invoices')
        ->assertOk();

    $this->actingAs($viewer)
        ->post('/invoices', [])
        ->assertForbidden();

    $this->actingAs($viewer)
        ->post('/journal', [])
        ->assertForbidden();

    $this->actingAs($viewer)
        ->post('/contacts', [])
        ->assertForbidden();
});

it('still allows write roles to create records', function () {
    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post('/contacts', ['name' => 'Gate Write Co', 'type' => 'customer'])
        ->assertRedirect();

    expect(Contact::query()->where('name', 'Gate Write Co')->exists())->toBeTrue();
});

it('records a spend-money cheque and posts it to the ledger', function () {
    $glBank = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1110']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5310']);
    $bank = BankAccount::create([
        'name' => 'Checking',
        'currency' => 'GHS',
        'opening_balance' => 1000,
        'current_balance' => 1000,
        'is_active' => true,
        'gl_account_id' => $glBank->id,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post('/banking/cheques', [
            'bank_account_id' => $bank->id,
            'cheque_date' => '2026-02-01',
            'cheque_number' => '000101',
            'pay_to' => 'ECG',
            'amount' => 300,
            'memo' => 'Utilities',
            'lines' => [
                ['account_id' => $expense->id, 'amount' => 220, 'memo' => 'Power'],
                ['account_id' => $expense->id, 'amount' => 80, 'memo' => 'Water'],
            ],
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $transaction = BankTransaction::query()->where('reference', '000101')->firstOrFail();

    expect($transaction->type)->toBe('withdrawal')
        ->and((float) $transaction->amount)->toBe(300.0)
        ->and($transaction->source)->toBe('cheque')
        ->and($transaction->journal_entry_id)->not->toBeNull()
        ->and((float) $bank->refresh()->current_balance)->toBe(700.0);

    $entry = JournalEntry::find($transaction->journal_entry_id);

    expect(round($entry->lines()->where('debit', '>', 0)->sum('debit'), 2))->toBe(300.0)
        ->and(round($entry->lines()->where('credit', '>', 0)->sum('credit'), 2))->toBe(300.0);
});

it('rejects a cheque whose allocations do not balance', function () {
    $glBank = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1111']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5311']);
    $bank = BankAccount::create([
        'name' => 'Savings',
        'currency' => 'USD',
        'opening_balance' => 500,
        'current_balance' => 500,
        'is_active' => true,
        'gl_account_id' => $glBank->id,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post('/banking/cheques', [
            'bank_account_id' => $bank->id,
            'cheque_date' => '2026-02-01',
            'cheque_number' => '000102',
            'pay_to' => 'Vendor',
            'amount' => 300,
            'lines' => [
                ['account_id' => $expense->id, 'amount' => 100],
            ],
        ])
        ->assertSessionHasErrors('lines');

    expect(BankTransaction::query()->where('reference', '000102')->exists())->toBeFalse()
        ->and((float) $bank->refresh()->current_balance)->toBe(500.0);
});
