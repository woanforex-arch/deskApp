<?php

use App\Models\Account;
use App\Models\AccountingPeriod;
use App\Models\AccountingSetting;
use App\Models\Attachment;
use App\Models\Backup;
use App\Models\Cashbook;
use App\Models\ClosingChecklist;
use App\Models\Company;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\DataImport;
use App\Models\Invoice;
use App\Models\ScheduledReport;
use App\Models\User;
use App\Models\Webhook;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'accountant']));
});

it('manages cashbooks and posts cash transactions', function () {
    $cashbook = Cashbook::create([
        'name' => 'Front desk float',
        'code' => 'CB-01',
        'type' => 'petty',
        'currency' => 'USD',
        'balance' => 100,
        'is_active' => true,
    ]);

    $index = $this->getJson('/api/v1/cashbooks')
        ->assertOk()
        ->assertJsonStructure(['data' => ['cashbooks', 'stats']]);

    expect($index->json('data.cashbooks.0.code'))->toBe('CB-01')
        ->and($index->json('data.stats.funds'))->toEqual(100.0);

    $transaction = $this->postJson('/api/v1/cashbooks/transactions', [
        'cashbook_id' => $cashbook->id,
        'transaction_date' => '2026-02-10',
        'type' => 'payment',
        'amount' => 40,
        'description' => 'Courier fees',
    ]);

    $transaction->assertCreated()->assertJsonPath('data.description', 'Courier fees');
    expect($cashbook->refresh()->balance)->toBe('60.00')
        ->and($transaction->json('data.journal_entry_id'))->toBeInt();
});

it('manages currencies and exchange rates', function () {
    Currency::create([
        'code' => 'USD',
        'name' => 'US Dollar',
        'symbol' => '$',
        'rate_to_base' => 1,
        'is_base' => true,
        'is_active' => true,
    ]);

    $created = $this->postJson('/api/v1/currencies', [
        'code' => 'EUR',
        'name' => 'Euro',
        'symbol' => '€',
        'rate_to_base' => 1.1,
    ])->assertCreated();

    expect($created->json('data.code'))->toBe('EUR');

    $this->postJson('/api/v1/currencies/rates', [
        'currency_code' => 'EUR',
        'rate' => 1.08,
        'effective_date' => '2026-02-01',
        'source' => 'manual',
    ])->assertCreated();

    expect((float) Currency::query()->where('code', 'EUR')->value('rate_to_base'))->toBe(1.08);

    $toggle = $this->patchJson("/api/v1/currencies/{$created->json('data.id')}/toggle");
    expect($toggle->json('data.is_active'))->toBeFalse();

    $update = $this->putJson("/api/v1/currencies/{$created->json('data.id')}", [
        'name' => 'Eurozone Euro',
        'rate_to_base' => 1.09,
    ]);

    expect($update->json('data.name'))->toBe('Eurozone Euro')
        ->and((float) $update->json('data.rate_to_base'))->toBe(1.09);

    $this->deleteJson("/api/v1/currencies/{$created->json('data.id')}")
        ->assertNoContent();

    $this->assertDatabaseMissing('currencies', ['id' => $created->json('data.id')]);

    $base = Currency::query()->where('is_base', true)->firstOrFail();
    $this->patchJson("/api/v1/currencies/{$base->id}/toggle")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'The base currency cannot be deactivated.');
});

it('reads and updates accounting settings through the api', function () {
    // Documented defaults before anything is saved.
    expect($this->getJson('/api/v1/currencies/settings')->json('data'))->toMatchArray([
        'fy_start_date' => null,
        'fy_end_date' => null,
        'accounting_method' => 'accrual',
        'decimal_places' => 2,
        'date_format' => 'Y-m-d',
        'time_zone' => 'UTC',
    ]);

    $updated = $this->putJson('/api/v1/currencies/settings', [
        'fy_start_date' => '2026-04-01',
        'fy_end_date' => '2027-03-31',
        'accounting_method' => 'cash',
        'decimal_places' => 4,
        'date_format' => 'd-m-Y',
        'time_zone' => 'Asia/Singapore',
    ])->assertOk();

    expect($updated->json('data.accounting_method'))->toBe('cash')
        ->and($updated->json('data.decimal_places'))->toBe(4)
        ->and($updated->json('data.date_format'))->toBe('d-m-Y')
        ->and($updated->json('data.time_zone'))->toBe('Asia/Singapore')
        ->and($updated->json('data.fy_start_date'))->toBe('2026-04-01')
        ->and($updated->json('data.fy_end_date'))->toBe('2027-03-31');

    // Unsupported method is a validation error.
    $this->putJson('/api/v1/currencies/settings', [
        'accounting_method' => 'hybrid',
        'decimal_places' => 2,
        'date_format' => 'Y-m-d',
        'time_zone' => 'UTC',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('accounting_method');

    // Decimal places outside the supported range are rejected.
    $this->putJson('/api/v1/currencies/settings', [
        'accounting_method' => 'accrual',
        'decimal_places' => 6,
        'date_format' => 'Y-m-d',
        'time_zone' => 'UTC',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('decimal_places');

    // The fiscal year cannot end before it starts.
    $this->putJson('/api/v1/currencies/settings', [
        'fy_start_date' => '2026-01-01',
        'fy_end_date' => '2025-12-31',
        'accounting_method' => 'accrual',
        'decimal_places' => 2,
        'date_format' => 'Y-m-d',
        'time_zone' => 'UTC',
    ])->assertUnprocessable()
        ->assertJsonPath('message', 'Financial year end must come after the start date.');

    // The last successful update still stands.
    expect(AccountingSetting::instance()->accounting_method)->toBe('cash');
});

it('schedules and runs recurring transactions', function () {
    $customer = Contact::factory()->create(['type' => 'customer']);

    $recurring = $this->postJson('/api/v1/recurring-transactions', [
        'name' => 'Monthly retainer',
        'type' => 'invoice',
        'frequency' => 'monthly',
        'next_run_at' => now()->subDay()->toIso8601String(),
        'contact_id' => $customer->id,
        'amount' => 500,
        'memo' => 'Retainer',
    ])->assertCreated();

    expect($recurring->json('data.is_active'))->toBeTrue();

    $run = $this->postJson('/api/v1/recurring-transactions/run-due')->assertOk();
    expect($run->json('data.executed'))->toBe(1)
        ->and(Invoice::query()->count())->toBe(1);

    $toggle = $this->patchJson('/api/v1/recurring-transactions/'.($recurring->json('data.id')).'/toggle');
    expect($toggle->json('data.is_active'))->toBeFalse();
});

it('creates revenue schedules and recognises revenue', function () {
    $schedule = $this->postJson('/api/v1/revenue-schedules', [
        'name' => 'Annual licence',
        'total_amount' => 1200,
        'start_date' => '2026-01-01',
        'end_date' => '2026-12-31',
        'method' => 'straight_line',
    ])->assertCreated();

    $recognize = $this->postJson('/api/v1/revenue-schedules/'.($schedule->json('data.id')).'/recognize', [
        'amount' => 200,
        'recognition_date' => '2026-01-31',
    ]);

    $recognize->assertOk();

    $index = $this->getJson('/api/v1/revenue-schedules')->assertOk();

    expect($index->json('data.schedules.0.recognized_amount'))->toEqual(200.0)
        ->and($index->json('data.schedules.0.deferred_amount'))->toEqual(1000.0)
        ->and($index->json('data.stats.deferred'))->toEqual(1000.0);
});

it('manages the organisation structure', function () {
    $company = $this->postJson('/api/v1/organisation/companies', [
        'name' => 'Acme Holdings',
        'code' => 'ACME',
        'base_currency' => 'USD',
    ])->assertCreated();
    $branch = $this->postJson('/api/v1/organisation/branches', [
        'company_id' => $company->json('data.id'),
        'name' => 'Downtown branch',
        'code' => 'BRA-01',
    ])->assertCreated();

    $department = $this->postJson('/api/v1/organisation/departments', [
        'branch_id' => $branch->json('data.id'),
        'name' => 'Finance',
        'code' => 'FIN',
    ])->assertCreated();

    $this->postJson('/api/v1/organisation/cost-centers', [
        'branch_id' => $branch->json('data.id'),
        'department_id' => $department->json('data.id'),
        'name' => 'Finance ops',
        'code' => 'CC-01',
    ])->assertCreated();

    $this->postJson('/api/v1/organisation/projects', [
        'company_id' => $company->json('data.id'),
        'name' => 'ERP rollout',
        'code' => 'PRJ-01',
        'budget' => 5000,
    ])->assertCreated();

    $index = $this->getJson('/api/v1/organisation')->assertOk();

    expect($index->json('data.stats'))
        ->toMatchArray([
            'companies' => 1,
            'branches' => 1,
            'departments' => 1,
            'cost_centers' => 1,
            'projects' => 1,
            'users' => 1,
        ]);

    $user = User::factory()->create();
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
    $role = $this->postJson("/api/v1/organisation/users/{$user->id}/role", ['role' => 'viewer']);
    $role->assertOk()->assertJsonPath('data.role', 'viewer');
});

it('requires the admin gate for organisation role updates', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'viewer']));
    $user = User::factory()->create();

    $this->postJson("/api/v1/organisation/users/{$user->id}/role", ['role' => 'admin'])
        ->assertForbidden();
});

it('assigns extended roles through the api', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
    $target = User::factory()->create(['role' => 'viewer']);

    $updated = $this->postJson("/api/v1/organisation/users/{$target->id}/role", ['role' => 'cashier', 'is_active' => true])
        ->assertOk();

    expect($updated->json('data.role'))->toBe('cashier')
        ->and($updated->json('data.role_label'))->toBe('Cashier')
        ->and($updated->json('data.can_write'))->toBeTrue()
        ->and($updated->json('data.can_approve'))->toBeFalse()
        ->and($updated->json('data.is_admin'))->toBeFalse();

    $promoted = $this->postJson("/api/v1/organisation/users/{$target->id}/role", ['role' => 'general_manager'])
        ->assertOk();

    expect($promoted->json('data.role_label'))->toBe('General manager')
        ->and($promoted->json('data.can_approve'))->toBeTrue();

    $this->postJson("/api/v1/organisation/users/{$target->id}/role", ['role' => 'chief'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('role');

    expect($target->refresh()->role)->toBe('general_manager');
});

it('creates and updates a company profile with a logo through the api', function () {
    Storage::fake('local');

    $created = $this->post('/api/v1/organisation/companies', [
        'name' => 'Acme Holdings',
        'code' => 'ACME-L',
        'base_currency' => 'GHS',
        'business_type' => 'Retail',
        'trading_name' => 'Acme',
        'business_email' => 'billing@acme.test',
        'website' => 'https://acme.test',
        'postal_address' => 'PO Box 22, Accra',
        'physical_address' => '12 Market Street, Accra',
        'logo' => UploadedFile::fake()->image('logo.png', 64, 64),
    ]);

    $created->assertCreated();
    $company = $created->json('data');

    expect($company['business_type'])->toBe('Retail')
        ->and($company['trading_name'])->toBe('Acme')
        ->and($company['business_email'])->toBe('billing@acme.test')
        ->and($company['website'])->toBe('https://acme.test')
        ->and($company['postal_address'])->toBe('PO Box 22, Accra')
        ->and($company['physical_address'])->toBe('12 Market Street, Accra')
        ->and($company['logo_url'])->toContain('/organisation/companies/'.$company['id'].'/logo');

    $companyId = $company['id'];

    $shown = $this->getJson("/api/v1/organisation/companies/{$companyId}");

    $shown->assertOk()->assertJsonPath('data.trading_name', 'Acme');

    $updated = $this->put("/api/v1/organisation/companies/{$companyId}", [
        'trading_name' => 'Acme Trading',
        'website' => 'https://acme-trading.test',
    ]);

    $updated->assertOk();

    expect($updated->json('data.trading_name'))->toBe('Acme Trading')
        ->and($updated->json('data.website'))->toBe('https://acme-trading.test');

    $cleared = $this->put("/api/v1/organisation/companies/{$companyId}", [
        'clear_logo' => '1',
    ]);

    $cleared->assertOk();

    expect($cleared->json('data.logo_url'))->toBeNull();

    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

    $this->deleteJson("/api/v1/organisation/companies/{$companyId}")
        ->assertNoContent();

    expect(Company::query()->find($companyId))->toBeNull();
});

it('blocks deleting a referenced company and requires the admin role through the api', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

    $company = $this->postJson('/api/v1/organisation/companies', [
        'name' => 'Blocked Co',
        'code' => 'BLK',
        'base_currency' => 'USD',
    ])->assertCreated();
    $companyId = $company->json('data.id');

    $this->postJson('/api/v1/organisation/branches', [
        'company_id' => $companyId,
        'name' => 'Branch One',
        'code' => 'B-BLK',
    ])->assertCreated();

    $this->deleteJson("/api/v1/organisation/companies/{$companyId}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'BLK is used by branches and cannot be deleted.');

    expect(Company::query()->find($companyId))->not->toBeNull();

    Sanctum::actingAs(User::factory()->create(['role' => 'accountant']));

    $free = $this->postJson('/api/v1/organisation/companies', [
        'name' => 'Free Co',
        'code' => 'FRE',
        'base_currency' => 'USD',
    ])->assertCreated();

    $this->deleteJson("/api/v1/organisation/companies/{$free->json('data.id')}")
        ->assertForbidden();
});

it('manages accounting periods, posting rules, and approval workflows', function () {
    $period = $this->postJson('/api/v1/controls/periods', [
        'name' => 'January 2026',
        'start_date' => '2026-01-01',
        'end_date' => '2026-01-31',
    ])->assertCreated();

    $this->postJson('/api/v1/controls/periods'.('/'.($period->json('data.id'))).'/close')
        ->assertOk()
        ->assertJsonPath('data.status', 'closed');

    $this->postJson('/api/v1/controls/posting-rules', [
        'event' => 'custom.event',
        'name' => 'Custom rule',
        'description' => 'Created via API',
    ])->assertCreated();

    $workflow = $this->postJson('/api/v1/controls/workflows', [
        'name' => 'Large journals',
        'type' => 'journal',
        'threshold' => 10000,
        'approver_role' => 'admin',
    ])->assertCreated();

    $index = $this->getJson('/api/v1/controls')->assertOk();

    expect($index->json('data.stats.workflows'))->toBe(1)
        ->and($index->json('data.workflows.0.threshold'))->toEqual(10000.0);
});

it('uploads and OCRs attachments', function () {
    Storage::fake('local');

    $invoice = Invoice::factory()->create();

    $stored = $this->postJson('/api/v1/documents', [
        'attachable_type' => 'invoice',
        'attachable_id' => $invoice->id,
        'file' => UploadedFile::fake()->createWithContent('memo.txt', 'Invoice memo contents'),
    ])->assertCreated();

    expect($stored->json('data.ocr_status'))->toBe('processed')
        ->and(Attachment::query()->count())->toBe(1);

    $attachment = Attachment::query()->firstOrFail();

    $this->putJson("/api/v1/documents/{$attachment->id}", [
        'ocr_text' => 'Corrected text',
        'ocr_status' => 'processed',
    ])->assertOk()->assertJsonPath('data.ocr_text', 'Corrected text');

    $this->deleteJson("/api/v1/documents/{$attachment->id}")->assertNoContent();
    $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
});

it('registers integrations, webhooks, scheduled reports, and backups', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

    $integration = $this->postJson('/api/v1/platform/integrations', [
        'name' => 'NetSuite',
        'type' => 'erp',
        'provider' => 'netsuite',
    ])->assertCreated();

    $this->postJson('/api/v1/platform/integrations/'.($integration->json('data.id')).'/sync')
        ->assertOk()
        ->assertJsonPath('data.status', 'connected')
        ->assertJsonPath('data.last_synced_at', fn ($value) => $value !== null);

    Http::fake(['https://hooks.test/*' => Http::response('ok', 200)]);
    $webhook = $this->postJson('/api/v1/platform/webhooks', [
        'name' => 'Invoice fanout',
        'event' => 'invoice.created',
        'url' => 'https://hooks.test/invoices',
    ])->assertCreated();

    $test = $this->postJson('/api/v1/platform/webhooks/'.($webhook->json('data.id')).'/test')->assertOk();
    expect($test->json('data.response_status'))->toBe(200);

    $this->postJson('/api/v1/platform/scheduled-reports', [
        'name' => 'Weekly trial balance',
        'report' => 'trial-balance',
        'recipients' => 'cfo@ledgerly.test',
        'frequency' => 'weekly',
    ])->assertCreated();

    $this->postJson('/api/v1/platform/backups')->assertCreated();

    expect(Backup::query()->count())->toBe(1)
        ->and(ScheduledReport::query()->whereNotNull('next_run_at')->count())->toBe(1);

    $index = $this->getJson('/api/v1/platform')->assertOk();

    expect($index->json('data.stats.integrations'))->toBe(1);
});

it('processes CSV imports through the API', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

    $csv = "code,name,type\r\n5300,Facilities,expense\r\n";
    $this->postJson('/api/v1/platform/imports', [
        'type' => 'accounts',
        'file' => UploadedFile::fake()->createWithContent('accounts.csv', $csv),
    ])->assertOk()->assertJsonPath('message', 'Import processed 1 row(s).');

    expect(Account::query()->where('code', '5300')->value('name'))->toBe('Facilities')
        ->and(DataImport::query()->firstOrFail()->status)->toBe('completed');
});

it('manages closing checklists', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
    $period = AccountingPeriod::create([
        'name' => 'March 2026',
        'start_date' => '2026-03-01',
        'end_date' => '2026-03-31',
        'status' => 'open',
    ]);

    $checklist = $this->postJson('/api/v1/platform/checklists', [
        'name' => 'March close',
        'accounting_period_id' => $period->id,
        'tasks' => ['Reconcile banks', 'Review ageing'],
    ])->assertCreated();

    $tasks = $checklist->json('data.tasks');
    expect(count($tasks))->toBe(2);

    $this->postJson('/api/v1/platform/checklists/'.($checklist->json('data.id')).'/tasks/'.($tasks[0]['id']).'/complete')
        ->assertOk()
        ->assertJsonPath('data.task.status', 'done');

    $index = $this->getJson('/api/v1/platform')->assertOk();
    expect($index->json('data.checklists.0.progress'))->toBe(50);
});

it('completes a closing checklist when every task is done', function () {
    Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

    $created = $this->postJson('/api/v1/platform/checklists', [
        'name' => 'Quick close',
        'accounting_period_id' => null,
        'tasks' => ['Reconcile banks'],
    ])->assertCreated();

    $checklistId = $created->json('data.id');
    $taskId = $created->json('data.tasks.0.id');

    $this->postJson("/api/v1/platform/checklists/{$checklistId}/tasks/{$taskId}/complete")->assertOk();

    expect(ClosingChecklist::query()->find($checklistId)->status)->toBe('completed')
        ->and(ClosingChecklist::query()->find($checklistId)->completed_at)->not->toBeNull();
});

it('blocks the platform API for non-admins', function () {
    $this->getJson('/api/v1/platform')->assertForbidden();

    $this->postJson('/api/v1/platform/webhooks', [
        'name' => 'Should fail',
        'event' => 'invoice.created',
        'url' => 'https://hooks.test/x',
    ])->assertForbidden();

    expect(Webhook::query()->count())->toBe(0);
});
