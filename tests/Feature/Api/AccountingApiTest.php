<?php

use App\Enums\AccountType;
use App\Enums\InvoiceStatus;
use App\Enums\JournalEntryStatus;
use App\Jobs\SendInvoiceReminder;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Sanctum::actingAs(User::factory()->create());
});

it('lists accounts with pagination metadata', function () {
    Account::factory()->count(3)->create();

    $this->getJson('/api/v1/accounts')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonStructure([
            'data' => [['id', 'code', 'name', 'type', 'balance']],
            'links',
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
        ]);
});

it('filters accounts by type and search term', function () {
    Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100', 'name' => 'Cash', 'category' => 'cash']);
    Account::factory()->ofType(AccountType::Expense)->create(['code' => '5100', 'name' => 'Rent', 'category' => 'operating_expense']);

    $this->getJson('/api/v1/accounts?type=asset')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.code', '1100');

    $this->getJson('/api/v1/accounts?category=cash')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.code', '1100');

    $this->getJson('/api/v1/accounts?search=Rent')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Rent');
});

it('creates, updates, and deletes an account', function () {
    $response = $this->postJson('/api/v1/accounts', [
        'code' => '6100',
        'name' => 'Travel',
        'type' => 'expense',
        'category' => 'operating_expense',
        'currency' => 'USD',
        'is_control' => false,
        'opening_balance' => 0,
        'description' => 'Client travel',
        'is_active' => true,
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.code', '6100')
        ->assertJsonPath('data.type', 'expense')
        ->assertJsonPath('data.category', 'operating_expense')
        ->assertJsonPath('data.currency', 'USD')
        ->assertJsonPath('data.normal_balance', 'debit');

    $account = Account::query()->where('code', '6100')->firstOrFail();

    $this->putJson("/api/v1/accounts/{$account->id}", [
        'name' => 'Business Travel',
    ])->assertOk()->assertJsonPath('data.name', 'Business Travel');

    $this->deleteJson("/api/v1/accounts/{$account->id}")->assertNoContent();

    $this->assertDatabaseMissing('accounts', ['id' => $account->id]);
});

it('prevents deleting an account with children', function () {
    $parent = Account::factory()->create();
    Account::factory()->create(['parent_id' => $parent->id]);

    $this->deleteJson("/api/v1/accounts/{$parent->id}")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'This account cannot be deleted because it has child accounts or posted transactions.');
});

it('lists and creates contacts', function () {
    Contact::factory()->count(2)->create();

    $this->getJson('/api/v1/contacts')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->postJson('/api/v1/contacts', [
        'name' => 'Acme Co',
        'email' => 'billing@acme.test',
        'type' => 'customer',
        'city' => 'Austin',
        'country' => 'United States',
    ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Acme Co')
        ->assertJsonPath('data.type_label', 'Customer');
});

it('creates an invoice with line items and calculated totals', function () {
    $contact = Contact::factory()->customer()->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create();

    $response = $this->postJson('/api/v1/invoices', [
        'contact_id' => $contact->id,
        'issue_date' => '2026-01-10',
        'due_date' => '2026-02-09',
        'status' => 'sent',
        'items' => [
            [
                'account_id' => $revenue->id,
                'description' => 'Consulting',
                'quantity' => 2,
                'unit_price' => 500,
                'tax_rate' => 10,
            ],
            [
                'description' => 'Support',
                'quantity' => 1,
                'unit_price' => 250,
                'tax_rate' => 0,
            ],
        ],
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.subtotal', 1250)
        ->assertJsonPath('data.tax_total', 100)
        ->assertJsonPath('data.total', 1350)
        ->assertJsonPath('data.status', 'sent')
        ->assertJsonCount(2, 'data.items');

    $this->assertDatabaseHas('invoices', [
        'contact_id' => $contact->id,
        'total' => 1350,
        'status' => 'sent',
    ]);
});

it('validates invoice items and dates', function () {
    $contact = Contact::factory()->customer()->create();

    $this->postJson('/api/v1/invoices', [
        'contact_id' => $contact->id,
        'issue_date' => '2026-02-10',
        'due_date' => '2026-01-10',
        'items' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors(['due_date', 'items']);
});

it('records a payment and marks the invoice paid', function () {
    $invoice = Invoice::factory()
        ->sent()
        ->create(['total' => 500, 'subtotal' => 500]);

    $response = $this->postJson("/api/v1/invoices/{$invoice->id}/payments", [
        'paid_on' => now()->toDateString(),
        'amount' => 500,
        'method' => 'bank_transfer',
        'reference' => 'PMT-001',
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('payment.amount', 500)
        ->assertJsonPath('invoice.status', 'paid')
        ->assertJsonPath('invoice.amount_paid', 500)
        ->assertJsonPath('invoice.balance_due', 0);

    expect($invoice->fresh()->status)->toBe(InvoiceStatus::Paid);
});

it('rejects overpayments and payments on drafts', function () {
    $invoice = Invoice::factory()->sent()->create(['total' => 100, 'subtotal' => 100]);

    $this->postJson("/api/v1/invoices/{$invoice->id}/payments", [
        'paid_on' => now()->toDateString(),
        'amount' => 150,
        'method' => 'cash',
    ])->assertUnprocessable()->assertJsonValidationErrors('amount');

    $draft = Invoice::factory()->create(['total' => 100, 'subtotal' => 100]);

    $this->postJson("/api/v1/invoices/{$draft->id}/payments", [
        'paid_on' => now()->toDateString(),
        'amount' => 50,
        'method' => 'cash',
    ])->assertUnprocessable()->assertJsonValidationErrors('amount');
});

it('marks a draft invoice as sent and queues reminders', function () {
    Queue::fake();

    $draft = Invoice::factory()->withItems(1)->create();

    $this->postJson("/api/v1/invoices/{$draft->id}/send")
        ->assertOk()
        ->assertJsonPath('data.status', 'sent');

    $this->postJson("/api/v1/invoices/{$draft->id}/reminders")->assertAccepted();

    Queue::assertPushed(SendInvoiceReminder::class);
});

it('creates and posts a balanced journal entry', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100', 'name' => 'Cash']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100', 'name' => 'Revenue']);

    $response = $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-15',
        'memo' => 'Consulting sale',
        'status' => 'draft',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => 1000],
            ['account_id' => $revenue->id, 'credit' => 1000],
        ],
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.is_balanced', true)
        ->assertJsonPath('data.total_debit', 1000)
        ->assertJsonPath('data.total_credit', 1000);

    $entryId = $response->json('data.id');

    $this->postJson("/api/v1/journal-entries/{$entryId}/post")
        ->assertOk()
        ->assertJsonPath('data.status', 'posted')
        ->assertJsonPath('data.is_balanced', true);

    expect($entryId)->not->toBeNull();
});

it('rejects unbalanced journal entries', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create();

    $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-15',
        'memo' => 'Broken entry',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => 1000],
            ['account_id' => $revenue->id, 'credit' => 900],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors('lines');
});

it('rejects lines that contain both a debit and a credit', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create();

    $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-15',
        'memo' => 'Invalid line',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => 100, 'credit' => 100],
            ['account_id' => $cash->id, 'debit' => 0, 'credit' => 0],
        ],
    ])->assertUnprocessable()->assertJsonValidationErrors('lines.0.debit');
});

it('reports a balanced trial balance from posted entries', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-15',
        'memo' => 'Sale',
        'status' => 'posted',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => 2500],
            ['account_id' => $revenue->id, 'credit' => 2500],
        ],
    ])->assertCreated();

    $this->getJson('/api/v1/reports/trial-balance')
        ->assertOk()
        ->assertJsonPath('data.totals.debit', 2500)
        ->assertJsonPath('data.totals.credit', 2500)
        ->assertJsonPath('data.totals.balanced', true);
});

it('returns profit and loss totals for a date range', function () {
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100', 'name' => 'Revenue']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5200', 'name' => 'Salaries']);
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);

    $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-10',
        'memo' => 'Revenue',
        'status' => 'posted',
        'lines' => [
            ['account_id' => $cash->id, 'debit' => 5000],
            ['account_id' => $revenue->id, 'credit' => 5000],
        ],
    ])->assertCreated();

    $this->postJson('/api/v1/journal-entries', [
        'entry_date' => '2026-01-12',
        'memo' => 'Payroll',
        'status' => 'posted',
        'lines' => [
            ['account_id' => $expense->id, 'debit' => 2000],
            ['account_id' => $cash->id, 'credit' => 2000],
        ],
    ])->assertCreated();

    $this->getJson('/api/v1/reports/profit-loss?from=2026-01-01&to=2026-01-31')
        ->assertOk()
        ->assertJsonPath('data.totals.revenue', 5000)
        ->assertJsonPath('data.totals.expenses', 2000)
        ->assertJsonPath('data.totals.net_income', 3000);
});

it('deletes only draft invoices', function () {
    $draft = Invoice::factory()->create();
    $sent = Invoice::factory()->sent()->create();

    $this->deleteJson("/api/v1/invoices/{$draft->id}")->assertNoContent();
    $this->deleteJson("/api/v1/invoices/{$sent->id}")->assertUnprocessable();

    $this->assertDatabaseMissing('invoices', ['id' => $draft->id]);
    $this->assertDatabaseHas('invoices', ['id' => $sent->id]);
});

it('only posts non-void journal entries', function () {
    $entry = JournalEntry::factory()->create([
        'status' => JournalEntryStatus::Void,
    ]);

    $this->postJson("/api/v1/journal-entries/{$entry->id}/post")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});
