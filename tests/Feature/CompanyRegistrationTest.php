<?php

use App\Models\Account;
use App\Models\Branch;
use App\Models\Company;
use App\Models\CostCenter;
use App\Models\Currency;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the company registration screen with ISO currency options', function () {
    Currency::create([
        'code' => 'GH₵',
        'name' => 'Ghana Cedi',
        'symbol' => '₵',
        'rate_to_base' => 1,
        'is_base' => true,
        'is_active' => true,
    ]);

    Currency::create([
        'code' => 'GHS',
        'name' => 'Ghana Cedi',
        'symbol' => 'GH₵',
        'rate_to_base' => 1,
        'is_base' => false,
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/organisation/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Organisation/Register')
            ->where('defaultCurrency', 'GHS')
            ->where('currencies', ['GHS'])
            ->has('companies')
            ->has('stats.companies'));
});

it('registers a company from the company registration screen', function () {
    $this->actingAs(User::factory()->create())
        ->post('/organisation/companies', [
            'name' => 'Acme Trading Ltd',
            'code' => 'ACME',
            'base_currency' => 'GHS',
            'tax_number' => 'TIN-123',
            'registration_number' => 'CS-456',
            'physical_address' => '1 High Street, Accra',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company = Company::query()->where('code', 'ACME')->firstOrFail();

    expect($company->name)->toBe('Acme Trading Ltd')
        ->and($company->base_currency)->toBe('GHS')
        ->and($company->is_active)->toBeTrue();
});

it('registers a company with the full register profile including a logo', function () {
    Storage::fake('local');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/organisation/companies', [
            'name' => 'Acme Trading Ltd',
            'code' => 'ACME2',
            'base_currency' => 'GHS',
            'business_type' => 'Retail',
            'trading_name' => 'Acme',
            'tax_number' => 'TIN-100',
            'registration_number' => 'CS-200',
            'business_email' => 'billing@acme.test',
            'website' => 'https://acme.test',
            'postal_address' => 'PO Box 22, Accra',
            'physical_address' => '12 Market Street, Accra',
            'logo' => UploadedFile::fake()->image('logo.png', 64, 64),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company = Company::query()->where('code', 'ACME2')->firstOrFail();

    expect($company->name)->toBe('Acme Trading Ltd')
        ->and($company->business_type)->toBe('Retail')
        ->and($company->trading_name)->toBe('Acme')
        ->and($company->business_email)->toBe('billing@acme.test')
        ->and($company->website)->toBe('https://acme.test')
        ->and($company->postal_address)->toBe('PO Box 22, Accra')
        ->and($company->physical_address)->toBe('12 Market Street, Accra')
        ->and($company->logo_path)->not->toBeNull();

    Storage::disk('local')->assertExists($company->logo_path);

    $this->get("/organisation/companies/{$company->id}/logo")->assertOk();

    $this->actingAs($user)
        ->get('/organisation/register')
        ->assertInertia(fn (Assert $page) => $page
            ->component('Organisation/Register')
            ->where('companies.0.logo_url', url("/organisation/companies/{$company->id}/logo"))
            ->where('companies.0.trading_name', 'Acme')
            ->where('companies.0.business_email', 'billing@acme.test'));
});

it('accepts an svg company logo on registration', function () {
    Storage::fake('local');

    $this->actingAs(User::factory()->create())
        ->post('/organisation/companies', [
            'name' => 'Vector Ltd',
            'code' => 'VEC',
            'base_currency' => 'USD',
            'logo' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>'),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company = Company::query()->where('code', 'VEC')->firstOrFail();

    expect($company->logo_path)->not->toBeNull();
    Storage::disk('local')->assertExists($company->logo_path);
});

it('rejects unsupported logo uploads on registration', function () {
    Storage::fake('local');

    $this->actingAs(User::factory()->create())
        ->from('/organisation/register')
        ->post('/organisation/companies', [
            'name' => 'Acme Trading Ltd',
            'code' => 'ACME3',
            'base_currency' => 'USD',
            'logo' => UploadedFile::fake()->create('malware.pdf', 100),
        ])
        ->assertRedirect('/organisation/register')
        ->assertSessionHasErrors('logo');

    expect(Company::query()->where('code', 'ACME3')->exists())->toBeFalse();
    Storage::disk('local')->assertDirectoryEmpty('company-logos');
});

it('updates a company from the register and replaces its logo', function () {
    Storage::fake('local');
    $user = User::factory()->create();

    $company = Company::create([
        'name' => 'Old Name Ltd',
        'code' => 'OLD',
        'base_currency' => 'USD',
        'is_active' => true,
    ]);

    $this->actingAs($user)
        ->put("/organisation/companies/{$company->id}", [
            'name' => 'Old Name Holdings Ltd',
            'logo' => UploadedFile::fake()->image('first.png', 32, 32),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company->refresh();
    $firstLogo = $company->logo_path;

    expect($company->name)->toBe('Old Name Holdings Ltd')
        ->and($firstLogo)->not->toBeNull();

    Storage::disk('local')->assertExists($firstLogo);

    $this->actingAs($user)
        ->put("/organisation/companies/{$company->id}", [
            'name' => 'Old Name Holdings Ltd',
            'website' => 'https://oldname.test',
            'logo' => UploadedFile::fake()->image('second.png', 32, 32),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company->refresh();

    expect($company->website)->toBe('https://oldname.test')
        ->and($company->logo_path)->not->toBe($firstLogo)
        ->and($company->logo_path)->not->toBeNull();

    Storage::disk('local')->assertExists($company->logo_path);
    Storage::disk('local')->assertMissing($firstLogo);
});

it('clears a company logo without replacing it', function () {
    Storage::fake('local');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/organisation/companies', [
            'name' => 'Logo Ltd',
            'code' => 'LOGO',
            'base_currency' => 'USD',
            'logo' => UploadedFile::fake()->image('logo.png', 32, 32),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company = Company::query()->where('code', 'LOGO')->firstOrFail();
    $logoPath = $company->logo_path;

    expect($logoPath)->not->toBeNull();

    $this->actingAs($user)
        ->put("/organisation/companies/{$company->id}", [
            'clear_logo' => '1',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company->refresh();

    expect($company->logo_path)->toBeNull();
    Storage::disk('local')->assertMissing($logoPath);
});

it('rejects a non ISO base currency on company registration', function () {
    $this->actingAs(User::factory()->create())
        ->from('/organisation/register')
        ->post('/organisation/companies', [
            'name' => 'Acme Trading Ltd',
            'code' => 'ACME',
            'base_currency' => 'GH₵',
        ])
        ->assertRedirect('/organisation/register')
        ->assertSessionHasErrors('base_currency');

    expect(Company::query()->where('code', 'ACME')->exists())->toBeFalse();
});

it('shares the registered company with every page and report', function () {
    Company::create([
        'name' => 'Acme Trading Ltd',
        'code' => 'ACME',
        'base_currency' => 'GHS',
        'tax_number' => 'TIN-123',
        'registration_number' => 'CS-456',
        'physical_address' => '1 High Street, Accra',
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/reports/trial-balance')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Reports/Show')
            ->where('company.name', 'Acme Trading Ltd')
            ->where('company.address', '1 High Street, Accra')
            ->where('company.registration_number', 'CS-456')
            ->where('company.tax_number', 'TIN-123'));
});

it('deletes a company registration from the register', function () {
    Storage::fake('local');
    $company = Company::create([
        'name' => 'Doomed Ltd',
        'code' => 'DOOM',
        'base_currency' => 'USD',
        'physical_address' => '2 Sunset Road, Accra',
        'is_active' => true,
    ]);

    $company->forceFill(['logo_path' => 'company-logos/old.png'])->save();
    Storage::disk('local')->put($company->logo_path, 'binary');

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->delete("/organisation/companies/{$company->id}")
        ->assertRedirect()
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Company DOOM registration deleted.');

    expect(Company::query()->where('code', 'DOOM')->exists())->toBeFalse();

    Storage::disk('local')->assertMissing('company-logos/old.png');
});

it('blocks deleting a company that is referenced elsewhere', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $company = Company::create([
        'name' => 'Busy Ltd',
        'code' => 'BUSY',
        'base_currency' => 'USD',
        'is_active' => true,
    ]);

    Branch::create([
        'company_id' => $company->id,
        'name' => 'Downtown',
        'code' => 'BR-BUSY',
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->from('/organisation/register')
        ->delete("/organisation/companies/{$company->id}")
        ->assertRedirect('/organisation/register')
        ->assertSessionHas('error');

    expect(Company::query()->where('code', 'BUSY')->exists())->toBeTrue();
});

it('allows only admins to delete companies via the web', function () {
    $company = Company::create([
        'name' => 'Locked Ltd',
        'code' => 'LOCK',
        'base_currency' => 'USD',
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->delete("/organisation/companies/{$company->id}")
        ->assertForbidden();

    expect(Company::query()->where('code', 'LOCK')->exists())->toBeTrue();
});

it('deletes an unused company from the organisation page', function () {
    $company = Company::create([
        'name' => 'Solo Ltd',
        'code' => 'SOLO',
        'base_currency' => 'USD',
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'admin']))
        ->from('/organisation')
        ->delete("/organisation/companies/{$company->id}")
        ->assertRedirect('/organisation')
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Company SOLO registration deleted.');

    expect(Company::query()->where('code', 'SOLO')->exists())->toBeFalse();
});

it('deletes a branch from the organisation page and detaches structure records', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $company = Company::create([
        'name' => 'Branch Co',
        'code' => 'BRCO',
        'base_currency' => 'USD',
        'is_active' => true,
    ]);

    $branch = Branch::create([
        'company_id' => $company->id,
        'name' => 'Airport',
        'code' => 'BR-AIR',
        'is_active' => true,
    ]);

    $department = Department::create([
        'branch_id' => $branch->id,
        'name' => 'Front Desk',
        'code' => 'DEP-AIR',
        'is_active' => true,
    ]);

    $center = CostCenter::create([
        'branch_id' => $branch->id,
        'department_id' => $department->id,
        'name' => 'Operations',
        'code' => 'CC-AIR',
        'is_active' => true,
    ]);

    $assignedUser = User::factory()->create(['role' => 'accountant']);
    $assignedUser->forceFill(['branch_id' => $branch->id])->save();

    $this->actingAs($admin)
        ->from('/organisation')
        ->delete("/organisation/branches/{$branch->id}")
        ->assertRedirect('/organisation')
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Branch BR-AIR deleted.');

    expect(Branch::query()->where('code', 'BR-AIR')->exists())->toBeFalse();
    expect($department->refresh()->branch_id)->toBeNull();
    expect($center->refresh()->branch_id)->toBeNull();
    expect($assignedUser->refresh()->branch_id)->toBeNull();
});

it('blocks deleting a branch that is referenced by ledger records', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $branch = Branch::create([
        'name' => 'Ledger Branch',
        'code' => 'BR-LED',
        'is_active' => true,
    ]);

    Account::create([
        'code' => '1999',
        'name' => 'Branch cash',
        'type' => 'asset',
        'branch_id' => $branch->id,
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->from('/organisation')
        ->delete("/organisation/branches/{$branch->id}")
        ->assertRedirect('/organisation')
        ->assertSessionHas('error');

    expect(Branch::query()->where('code', 'BR-LED')->exists())->toBeTrue();
});

it('allows only admins to delete branches via the web', function () {
    $branch = Branch::create([
        'name' => 'Locked Branch',
        'code' => 'BR-LOCK',
        'is_active' => true,
    ]);

    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->delete("/organisation/branches/{$branch->id}")
        ->assertForbidden();

    expect(Branch::query()->where('code', 'BR-LOCK')->exists())->toBeTrue();
});

it('renders users and permissions on the company registration screen', function () {
    User::factory()->create(['role' => 'admin', 'name' => 'Ade Admin']);

    $this->actingAs(User::factory()->create(['role' => 'cashier']))
        ->get('/organisation/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Organisation/Register')
            ->has('users', 2)
            ->has('roles.0', fn (Assert $role) => $role
                ->where('key', 'admin')
                ->where('label', 'Administrator')
                ->where('can_write', true)
                ->where('can_approve', true)
                ->where('is_admin', true))
            ->where('roles.3.key', 'accountant')
            ->where('roles.3.label', 'Accountant')
            ->where('roles.4.key', 'cashier')
            ->where('roles.4.label', 'Cashier')
            ->where('roles.4.can_write', true)
            ->where('roles.4.can_approve', false)
            ->where('roles.5.key', 'auditor')
            ->where('roles.5.can_write', false)
            ->where('stats.users', 2));
});

it('assigns users and permissions roles from the company registration screen', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $staff = User::factory()->create(['role' => 'viewer', 'name' => 'Ama Mensah']);

    $this->actingAs($admin)
        ->from('/organisation/register')
        ->post("/organisation/users/{$staff->id}/role", ['role' => 'general_manager', 'is_active' => true])
        ->assertRedirect();

    expect($staff->refresh()->role)->toBe('general_manager')
        ->and($staff->roleLabel())->toBe('General manager')
        ->and($staff->canApprove())->toBeTrue()
        ->and($staff->canWrite())->toBeTrue()
        ->and($staff->isAdmin())->toBeFalse();

    // Cashiers record transactions but cannot approve.
    $this->actingAs($admin)
        ->post("/organisation/users/{$staff->id}/role", ['role' => 'cashier'])
        ->assertRedirect();

    expect($staff->refresh()->role)->toBe('cashier')
        ->and($staff->canWrite())->toBeTrue()
        ->and($staff->canApprove())->toBeFalse();

    // Auditors are read-only.
    $this->actingAs($admin)
        ->post("/organisation/users/{$staff->id}/role", ['role' => 'auditor', 'is_active' => false])
        ->assertRedirect();

    expect($staff->refresh()->role)->toBe('auditor')
        ->and($staff->canWrite())->toBeFalse()
        ->and($staff->canApprove())->toBeFalse()
        ->and($staff->is_active)->toBeFalse();

    // Unknown roles are rejected without changing the user.
    $this->actingAs($admin)
        ->post("/organisation/users/{$staff->id}/role", ['role' => 'superuser'])
        ->assertRedirect()
        ->assertSessionHasErrors('role');

    expect($staff->refresh()->role)->toBe('auditor');

    // Non-admins cannot change roles at all.
    $this->actingAs(User::factory()->create(['role' => 'accountant']))
        ->post("/organisation/users/{$staff->id}/role", ['role' => 'admin'])
        ->assertForbidden();

    expect($staff->refresh()->role)->toBe('auditor');
});
