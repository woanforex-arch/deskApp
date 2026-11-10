<?php

use App\Enums\AccountType;
use App\Enums\JournalEntryStatus;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Services\Accounting\LedgerService;
use Illuminate\Support\Carbon;

function postedEntry(array $lines, string $date = '2026-01-10'): JournalEntry
{
    $entry = JournalEntry::factory()->create([
        'entry_date' => $date,
        'status' => JournalEntryStatus::Posted,
    ]);

    foreach ($lines as $line) {
        $entry->lines()->create([
            'account_id' => $line['account']->id,
            'description' => $line['description'] ?? null,
            'debit' => $line['debit'] ?? 0,
            'credit' => $line['credit'] ?? 0,
        ]);
    }

    return $entry;
}

it('computes account balances from posted lines only', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    postedEntry([
        ['account' => $cash, 'debit' => 1000],
        ['account' => $revenue, 'credit' => 1000],
    ]);

    $draft = JournalEntry::factory()->draft()->create();
    $draft->lines()->create(['account_id' => $cash->id, 'debit' => 500]);

    $balances = app(LedgerService::class)->accountBalances();

    expect($balances->firstWhere('code', '1100')->balance())->toBe(1000.0)
        ->and($balances->firstWhere('code', '4100')->balance())->toBe(1000.0);
});

it('builds a balanced trial balance', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    postedEntry([
        ['account' => $cash, 'debit' => 2500],
        ['account' => $revenue, 'credit' => 2500],
    ]);

    $trial = app(LedgerService::class)->trialBalance();

    expect($trial['totals']['debit'])->toBe(2500.0)
        ->and($trial['totals']['credit'])->toBe(2500.0)
        ->and($trial['totals']['difference'])->toBe(0.0)
        ->and($trial['totals']['balanced'])->toBeTrue();
});

it('filters the trial balance by date range', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    postedEntry([
        ['account' => $cash, 'debit' => 1000],
        ['account' => $revenue, 'credit' => 1000],
    ], '2026-01-05');

    postedEntry([
        ['account' => $cash, 'debit' => 700],
        ['account' => $revenue, 'credit' => 700],
    ], '2026-02-05');

    $trial = app(LedgerService::class)->trialBalance(
        Carbon::parse('2026-01-01'),
        Carbon::parse('2026-01-31'),
    );

    expect($trial['totals']['debit'])->toBe(1000.0)
        ->and($trial['totals']['balanced'])->toBeTrue();
});

it('calculates profit and loss for a period', function () {
    $cash = Account::factory()->ofType(AccountType::Asset)->create(['code' => '1100']);
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100', 'name' => 'Revenue']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5200', 'name' => 'Salaries']);

    postedEntry([
        ['account' => $cash, 'debit' => 5000],
        ['account' => $revenue, 'credit' => 5000],
    ], '2026-01-10');

    postedEntry([
        ['account' => $expense, 'debit' => 2000],
        ['account' => $cash, 'credit' => 2000],
    ], '2026-01-20');

    postedEntry([
        ['account' => $cash, 'debit' => 900],
        ['account' => $revenue, 'credit' => 900],
    ], '2026-02-01');

    $report = app(LedgerService::class)->profitAndLoss(
        Carbon::parse('2026-01-01'),
        Carbon::parse('2026-01-31'),
    );

    expect($report['totals']['revenue'])->toBe(5000.0)
        ->and($report['totals']['expenses'])->toBe(2000.0)
        ->and($report['totals']['net_income'])->toBe(3000.0)
        ->and($report['revenue'])->toHaveCount(1)
        ->and($report['expenses'])->toHaveCount(1);
});

it('builds sales summaries and customer statements from invoices and receipts', function () {
    $customer = Contact::factory()->customer()->create(['name' => 'Acme Trading']);

    Invoice::factory()->sent()->create([
        'contact_id' => $customer->id,
        'issue_date' => '2025-12-15',
        'due_date' => '2026-01-14',
        'subtotal' => 500,
        'total' => 500,
    ]);

    $openingInvoice = Invoice::factory()->sent()->create([
        'contact_id' => $customer->id,
        'issue_date' => '2026-01-05',
        'due_date' => '2026-02-04',
        'subtotal' => 1000,
        'total' => 1000,
    ]);

    Payment::factory()->create([
        'invoice_id' => $openingInvoice->id,
        'contact_id' => $customer->id,
        'paid_on' => '2026-01-20',
        'amount' => 200,
    ]);

    $service = app(LedgerService::class);
    $from = Carbon::parse('2026-01-01');
    $to = Carbon::parse('2026-02-28');

    $sales = $service->salesReport($from, $to);
    $statement = $service->customerStatement($customer->id, $from, $to);

    expect($sales['totals']['count'])->toBe(1)
        ->and($sales['totals']['total'])->toBe(1000.0)
        ->and($sales['by_customer'][0]['customer'])->toBe('Acme Trading')
        ->and($statement['opening_balance'])->toBe(500.0)
        ->and($statement['totals']['debit'])->toBe(1000.0)
        ->and($statement['totals']['credit'])->toBe(200.0)
        ->and($statement['totals']['closing'])->toBe(1300.0)
        ->and($statement['rows'])->toHaveCount(2);
});

it('returns zero profit and loss when there are no postings', function () {
    $report = app(LedgerService::class)->profitAndLoss(
        Carbon::parse('2026-01-01'),
        Carbon::parse('2026-01-31'),
    );

    expect($report['totals'])->toMatchArray([
        'revenue' => 0.0,
        'expenses' => 0.0,
        'net_income' => 0.0,
    ]);
});
