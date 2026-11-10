<?php

use App\Enums\AccountType;
use App\Enums\InvoiceStatus;
use App\Enums\JournalEntryStatus;
use App\Http\Controllers\ReportController;
use App\Jobs\SendInvoiceReminder;
use App\Models\Account;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\JournalEntry;
use App\Models\User;
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
