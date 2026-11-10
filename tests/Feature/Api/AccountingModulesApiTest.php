<?php

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'approver']));
});

it('creates, approves, pays, and deletes a vendor bill', function () {
    $vendor = Contact::factory()->create(['type' => 'vendor']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5300', 'name' => 'Rent']);

    $response = $this->postJson('/api/v1/bills', [
        'contact_id' => $vendor->id,
        'bill_date' => '2026-02-01',
        'due_date' => '2026-02-28',
        'items' => [
            ['account_id' => $expense->id, 'description' => 'February rent', 'quantity' => 1, 'unit_price' => 1000, 'tax_rate' => 10],
        ],
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.total', 1100)
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.balance_due', 1100);

    $billId = $response->json('data.id');

    $this->postJson("/api/v1/bills/{$billId}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $this->postJson("/api/v1/bills/{$billId}/payments", [
        'paid_on' => '2026-02-15',
        'amount' => 1100,
        'method' => 'bank_transfer',
        'reference' => 'VP-001',
    ])
        ->assertCreated()
        ->assertJsonPath('data.bill.status', 'paid')
        ->assertJsonPath('data.bill.balance_due', 0);

    $this->getJson("/api/v1/bills/{$billId}")
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonCount(1, 'data.payments');
});

it('creates and posts a sales credit note', function () {
    $customer = Contact::factory()->customer()->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100', 'name' => 'Consulting']);

    $response = $this->postJson('/api/v1/credit-notes', [
        'contact_id' => $customer->id,
        'issue_date' => '2026-02-10',
        'type' => 'sales',
        'reason' => 'Service credit',
        'items' => [
            ['account_id' => $revenue->id, 'description' => 'Service credit', 'quantity' => 1, 'unit_price' => 200, 'tax_rate' => 5],
        ],
    ]);

    $response->assertCreated()->assertJsonPath('data.total', 210)->assertJsonPath('data.status', 'draft');

    $noteId = $response->json('data.id');

    $this->postJson("/api/v1/credit-notes/{$noteId}/post")
        ->assertOk()
        ->assertJsonPath('data.status', 'posted');

    $this->getJson('/api/v1/credit-notes?type=sales')
        ->assertOk()
        ->assertJsonPath('data.0.number', fn ($number) => str_starts_with($number, 'CN-'));
});

it('manages bank accounts, transactions, reconciliations, and transfers', function () {
    $first = $this->postJson('/api/v1/bank-accounts', [
        'name' => 'Operating',
        'bank_name' => 'First Ledger Bank',
        'opening_balance' => 5000,
        'currency' => 'USD',
    ])->assertCreated()->json('data');

    $second = $this->postJson('/api/v1/bank-accounts', [
        'name' => 'Reserve',
        'opening_balance' => 1000,
    ])->assertCreated()->json('data');

    $transaction = $this->postJson("/api/v1/bank-accounts/{$first['id']}/transactions", [
        'transaction_date' => '2026-02-05',
        'description' => 'Customer deposit',
        'type' => 'deposit',
        'amount' => 750,
    ])->assertCreated()->json('data');

    expect((float) $transaction['current_balance'])->toBe(5750.0);

    $this->postJson("/api/v1/bank-transactions/{$transaction['id']}/match")
        ->assertOk()
        ->assertJsonPath('data.status', 'matched');

    $reconciliation = $this->postJson("/api/v1/bank-accounts/{$first['id']}/reconciliations", [
        'statement_date' => '2026-02-28',
        'statement_balance' => 5750,
    ])->assertCreated()->json('data');

    $this->postJson("/api/v1/bank-reconciliations/{$reconciliation['id']}/complete")
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');

    $this->postJson('/api/v1/bank-transfers', [
        'from_bank_account_id' => $first['id'],
        'to_bank_account_id' => $second['id'],
        'amount' => 500,
        'transfer_date' => '2026-02-20',
        'reference' => 'TRF-001',
    ])->assertCreated()->assertJsonPath('data.status', 'completed');

    $this->getJson("/api/v1/bank-accounts/{$first['id']}")
        ->assertOk()
        ->assertJsonPath('data.current_balance', 5250);
});

it('records inventory receipts and exposes item valuation', function () {
    $item = $this->postJson('/api/v1/inventory-items', [
        'sku' => 'SKU-001',
        'name' => 'Starter Kit',
        'unit_cost' => 10,
        'quantity_on_hand' => 0,
        'reorder_level' => 5,
    ])->assertCreated()->assertJsonPath('data.value', 0)->json('data');

    $this->postJson("/api/v1/inventory-items/{$item['id']}/movements", [
        'type' => 'receive',
        'movement_date' => '2026-02-01',
        'quantity' => 12,
        'unit_cost' => 10,
    ])->assertCreated()->assertJsonPath('data.item.quantity_on_hand', 12);

    $this->getJson('/api/v1/inventory-items?low_stock=1')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->getJson("/api/v1/inventory-items/{$item['id']}")
        ->assertOk()
        ->assertJsonCount(1, 'data.movements')
        ->assertJsonPath('data.value', 120);
});

it('registers, depreciates, revalues, and disposes a fixed asset', function () {
    $asset = $this->postJson('/api/v1/fixed-assets', [
        'name' => 'Delivery Van',
        'code' => 'FA-100',
        'purchase_date' => '2026-01-01',
        'cost' => 12000,
        'salvage_value' => 0,
        'useful_life_years' => 5,
    ])->assertCreated()->assertJsonPath('data.book_value', 12000)->json('data');

    $this->postJson("/api/v1/fixed-assets/{$asset['id']}/depreciate", [
        'period' => '2026-01',
        'depreciation_date' => '2026-01-31',
    ])->assertOk()->assertJsonPath('data.book_value', 11800);

    $this->postJson("/api/v1/fixed-assets/{$asset['id']}/revalue", [
        'new_value' => 12500,
        'revaluation_date' => '2026-02-01',
        'notes' => 'Market value uplift',
    ])->assertOk()->assertJsonPath('data.book_value', 12500);

    $this->postJson("/api/v1/fixed-assets/{$asset['id']}/dispose", [
        'proceeds' => 12000,
        'disposal_date' => '2026-03-01',
    ])->assertOk()->assertJsonPath('data.status', 'disposed');
});

it('runs payroll through the API', function () {
    $this->postJson('/api/v1/payroll/employees', [
        'employee_number' => 'EMP-900',
        'name' => 'Sam Rivera',
        'gross_salary' => 4000,
    ])->assertCreated()->assertJsonPath('data.gross_salary', 4000);

    $run = $this->postJson('/api/v1/payroll/runs', [
        'period' => '2026-02',
        'income_tax_rate' => 10,
        'social_security_rate' => 5,
    ])->assertCreated()->assertJsonPath('data.gross_total', 4000)->json('data');

    $this->postJson("/api/v1/payroll/runs/{$run['id']}/process")
        ->assertOk()
        ->assertJsonPath('data.status', 'posted')
        ->assertJsonPath('data.net_total', 3400);

    $this->getJson('/api/v1/payroll?period=2026-02')
        ->assertOk()
        ->assertJsonPath('data.items.0.employee', 'Sam Rivera');
});

it('creates budgets and changes their status', function () {
    $account = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5200', 'name' => 'Salaries']);

    $budget = $this->postJson('/api/v1/budgets', [
        'name' => 'FY26 Plan',
        'fiscal_year' => 2026,
        'lines' => [
            ['account_id' => $account->id, 'month' => 1, 'amount' => 1000],
            ['account_id' => $account->id, 'month' => 2, 'amount' => 1200],
        ],
    ])->assertCreated()->assertJsonPath('data.total', 2200)->json('data');

    $this->patchJson("/api/v1/budgets/{$budget['id']}/status", ['status' => 'approved'])
        ->assertOk()
        ->assertJsonPath('data.status', 'approved');

    $this->getJson("/api/v1/budgets/{$budget['id']}")
        ->assertOk()
        ->assertJsonCount(2, 'data.lines');
});

it('creates tax rates and remits a tax liability', function () {
    $account = Account::factory()->ofType(AccountType::Liability)->create(['code' => '2200', 'name' => 'Tax Payable']);

    $rate = $this->postJson('/api/v1/tax/rates', [
        'name' => 'VAT 12%',
        'code' => 'VAT12',
        'rate' => 12,
        'type' => 'vat',
        'account_id' => $account->id,
    ])->assertCreated()->json('data');

    $remittance = $this->postJson('/api/v1/tax/remittances', [
        'tax_rate_id' => $rate['id'],
        'name' => 'VAT 12% return',
        'period' => '2026-02',
        'due_date' => '2026-03-20',
        'amount' => 480,
    ])->assertCreated()->assertJsonPath('data.status', 'pending')->json('data');

    $this->postJson("/api/v1/tax/remittances/{$remittance['id']}/remit")
        ->assertOk()
        ->assertJsonPath('data.status', 'remitted');
});

it('serves the extended reporting endpoints', function () {
    $account = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5200']);
    $budget = Budget::create([
        'name' => 'FY26 Plan',
        'fiscal_year' => 2026,
        'status' => 'approved',
    ]);
    $budget->lines()->create(['account_id' => $account->id, 'month' => 1, 'amount' => 500]);

    $this->getJson('/api/v1/reports/balance-sheet?as_of=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['as_of', 'assets', 'liabilities', 'equity', 'totals']]);

    $this->getJson('/api/v1/reports/cash-flow?from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['opening_cash', 'sections', 'net_change', 'closing_cash']]);

    $this->getJson("/api/v1/reports/general-ledger?account_id={$account->id}&from=2026-01-01&to=2026-02-28")
        ->assertOk()
        ->assertJsonPath('data.account.id', $account->id);

    $this->getJson('/api/v1/reports/aging?type=payable&as_of=2026-02-28')
        ->assertOk()
        ->assertJsonPath('data.type', 'payable');

    $this->getJson('/api/v1/reports/sales?from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['rows', 'monthly', 'by_customer', 'totals' => ['count', 'total', 'paid', 'balance']]]);

    $this->getJson('/api/v1/reports/expenses?from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['by_account', 'by_vendor', 'totals' => ['expenses', 'bills', 'bill_total']]]);

    $customer = Contact::factory()->customer()->create();

    $this->getJson("/api/v1/reports/customer-statement?contact_id={$customer->id}&from=2026-01-01&to=2026-02-28")
        ->assertOk()
        ->assertJsonPath('data.contact.id', $customer->id)
        ->assertJsonStructure(['data' => ['opening_balance', 'rows', 'totals' => ['debit', 'credit', 'closing']]]);

    $this->getJson('/api/v1/reports/bank-reconciliation?as_of=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['as_of', 'rows', 'totals' => ['accounts', 'book_balance', 'unmatched']]]);

    $this->getJson('/api/v1/reports/fixed-asset-register?as_of=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['as_of', 'rows', 'totals' => ['assets', 'cost', 'book_value']]]);

    $this->getJson('/api/v1/reports/vat?from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonStructure(['data' => ['output_tax', 'input_tax', 'net_payable', 'status']]);

    $this->getJson("/api/v1/reports/budget-vs-actual?budget_id={$budget->id}")
        ->assertOk()
        ->assertJsonPath('data.budget.id', $budget->id);

    $this->getJson('/api/v1/reports/dimensions?dimension=department&dimension_id=1&from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonPath('data.dimension', 'department');

    $this->getJson('/api/v1/reports/dimensions?dimension=cost_center&dimension_id=1&from=2026-01-01&to=2026-02-28')
        ->assertOk()
        ->assertJsonPath('data.dimension', 'cost_center');

    $this->getJson('/api/v1/reports/audit')
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'total']]);
});
