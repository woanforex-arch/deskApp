<?php

use App\Models\Account;
use App\Models\ApprovalWorkflow;
use App\Models\BankAccount;
use App\Models\Budget;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Employee;
use App\Models\FixedAsset;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\PayrollItem;
use App\Models\Payment;
use App\Models\TaxRate;
use App\Models\User;
use App\Services\Accounting\LedgerService;
use Illuminate\Support\Facades\Hash;

it('seeds a complete demo workspace', function () {
    $this->seed();

    expect(User::query()->count())->toBe(2)
        ->and(Account::query()->count())->toBe(32)
        ->and(Contact::query()->count())->toBe(8)
        ->and(Invoice::query()->count())->toBe(18)
        ->and(Payment::query()->count())->toBe(10)
        ->and(JournalEntry::query()->count())->toBe(23);
});

it('seeds demo users with the documented credentials', function () {
    $this->seed();

    $this->assertDatabaseHas('users', [
        'email' => 'admin@ledgerly.test',
        'name' => 'Avery Chen',
    ]);

    $this->assertDatabaseHas('users', [
        'email' => 'accountant@ledgerly.test',
        'name' => 'Jordan Ellis',
    ]);

    expect(Hash::check(
        'password',
        User::query()->where('email', 'admin@ledgerly.test')->firstOrFail()->password,
    ))->toBeTrue();
});

it('seeds a balanced ledger', function () {
    $this->seed();

    $trial = app(LedgerService::class)->trialBalance();

    expect($trial['totals']['balanced'])->toBeTrue()
        ->and($trial['totals']['difference'])->toBe(0.0)
        ->and($trial['totals']['debit'])->toBeGreaterThan(0);
});

it('seeds the extended accounting modules', function () {
    $this->seed();

    expect(BankAccount::query()->count())->toBe(2)
        ->and(Currency::query()->count())->toBe(4)
        ->and(InventoryItem::query()->count())->toBe(2)
        ->and(FixedAsset::query()->count())->toBe(1)
        ->and(Employee::query()->count())->toBe(3)
        ->and(PayrollItem::query()->count())->toBe(3)
        ->and(Budget::query()->count())->toBe(1)
        ->and(TaxRate::query()->count())->toBe(3)
        ->and(ApprovalWorkflow::query()->count())->toBe(3)
        ->and(User::query()->where('email', 'admin@ledgerly.test')->firstOrFail()->role)->toBe('admin');
});

it('seeds posted journal entries with balanced debits and credits', function () {
    $this->seed();

    JournalEntry::query()->withSum('lines as debit_total', 'debit')->withSum('lines as credit_total', 'credit')
        ->get()
        ->each(function (JournalEntry $entry): void {
            expect((float) $entry->debit_total)->toBe((float) $entry->credit_total)
                ->and($entry->isBalanced())->toBeTrue();
        });
});

it('does not duplicate records when seeded twice', function () {
    $this->seed();
    $this->seed();

    expect(User::query()->count())->toBe(2)
        ->and(Account::query()->count())->toBe(32)
        ->and(Contact::query()->count())->toBe(8)
        ->and(Invoice::query()->count())->toBe(18)
        ->and(JournalEntry::query()->count())->toBe(23);
});
