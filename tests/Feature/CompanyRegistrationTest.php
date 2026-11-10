<?php

use App\Models\Company;
use App\Models\Currency;
use App\Models\User;
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
            'address' => '1 High Street, Accra',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $company = Company::query()->where('code', 'ACME')->firstOrFail();

    expect($company->name)->toBe('Acme Trading Ltd')
        ->and($company->base_currency)->toBe('GHS')
        ->and($company->is_active)->toBeTrue();
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
        'address' => '1 High Street, Accra',
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

