<?php

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\PayrollRun;
use App\Models\User;
use App\Services\Accounting\ApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    Sanctum::actingAs(User::factory()->create());
});

it('routes a large draft invoice through the approval workflow', function () {
    $workflow = ApprovalWorkflow::create([
        'name' => 'Large invoice approval',
        'type' => 'invoice',
        'threshold' => 1000,
        'approver_role' => 'admin',
        'is_active' => true,
    ]);

    $customer = Contact::factory()->customer()->create();
    $revenue = Account::factory()->ofType(AccountType::Revenue)->create(['code' => '4100']);

    $this->postJson('/api/v1/invoices', [
        'contact_id' => $customer->id,
        'issue_date' => '2026-02-01',
        'due_date' => '2026-03-01',
        'items' => [
            ['account_id' => $revenue->id, 'description' => 'Advisory', 'quantity' => 1, 'unit_price' => 2500],
        ],
    ])->assertCreated();

    $invoice = Invoice::query()->latest('id')->firstOrFail();
    $request = ApprovalRequest::query()->where('approvable_type', Invoice::class)->firstOrFail();

    expect($invoice->approval_status)->toBe('pending')
        ->and($request->approval_workflow_id)->toBe($workflow->id)
        ->and($request->status)->toBe('pending');

    app(ApprovalService::class)->approve($request, User::query()->first());

    expect($invoice->refresh()->approval_status)->toBe('approved')
        ->and($request->refresh()->status)->toBe('approved');
});

it('posts a bill after its approval request is approved', function () {
    ApprovalWorkflow::create([
        'name' => 'Bill approval',
        'type' => 'bill',
        'threshold' => 100,
        'approver_role' => 'admin',
        'is_active' => true,
    ]);

    $vendor = Contact::factory()->create(['type' => 'vendor']);
    $expense = Account::factory()->ofType(AccountType::Expense)->create(['code' => '5300']);

    $response = $this->postJson('/api/v1/bills', [
        'contact_id' => $vendor->id,
        'bill_date' => '2026-02-01',
        'due_date' => '2026-02-28',
        'items' => [
            ['account_id' => $expense->id, 'description' => 'Rent', 'quantity' => 1, 'unit_price' => 500],
        ],
    ])->assertCreated()->assertJsonPath('data.status', 'pending_approval');

    $bill = Bill::query()->findOrFail($response->json('data.id'));
    $request = ApprovalRequest::query()->where('approvable_type', Bill::class)->firstOrFail();

    app(ApprovalService::class)->approve($request, User::query()->first());

    $bill->refresh();

    expect($bill->status)->toBe('approved')
        ->and($bill->approved_at)->not->toBeNull()
        ->and($bill->journal_entry_id)->not->toBeNull();
});

it('places payroll runs into approval before they can be posted', function () {
    ApprovalWorkflow::create([
        'name' => 'Payroll approval',
        'type' => 'payroll',
        'threshold' => 0,
        'approver_role' => 'admin',
        'is_active' => true,
    ]);

    $this->postJson('/api/v1/payroll/employees', [
        'employee_number' => 'EMP-700',
        'name' => 'Dana Wolf',
        'gross_salary' => 3000,
    ])->assertCreated();

    $run = $this->postJson('/api/v1/payroll/runs', ['period' => '2026-03'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_approval')
        ->json('data');

    $request = ApprovalRequest::query()->where('approvable_type', PayrollRun::class)->firstOrFail();

    app(ApprovalService::class)->approve($request, User::query()->first());

    expect(PayrollRun::query()->findOrFail($run['id'])->status)->toBe('approved');
});

it('rejects an approval request and returns a bill to draft', function () {
    ApprovalWorkflow::create([
        'name' => 'Bill approval',
        'type' => 'bill',
        'threshold' => 50,
        'approver_role' => 'admin',
        'is_active' => true,
    ]);

    $vendor = Contact::factory()->create(['type' => 'vendor']);

    $response = $this->postJson('/api/v1/bills', [
        'contact_id' => $vendor->id,
        'bill_date' => '2026-02-01',
        'due_date' => '2026-02-28',
        'items' => [
            ['description' => 'Supplies', 'quantity' => 1, 'unit_price' => 100],
        ],
    ])->assertCreated()->assertJsonPath('data.status', 'pending_approval');

    $bill = Bill::query()->findOrFail($response->json('data.id'));
    $request = ApprovalRequest::query()->where('approvable_type', Bill::class)->firstOrFail();

    app(ApprovalService::class)->reject($request, User::query()->first(), 'Budget exceeded');

    expect($bill->refresh()->status)->toBe('draft')
        ->and($request->refresh()->status)->toBe('rejected')
        ->and($request->notes)->toBe('Budget exceeded');
});
