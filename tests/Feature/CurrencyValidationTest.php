<?php

use App\Models\Currency;
use App\Models\User;

it('rejects currency codes that are not three letters', function () {
    $this->actingAs(User::factory()->create())
        ->post('/currencies', [
            'code' => 'GH₵',
            'name' => 'Ghana Cedi',
            'symbol' => '₵',
            'rate_to_base' => 1,
            'is_base' => true,
        ])
        ->assertSessionHasErrors('code');

    expect(Currency::query()->where('name', 'Ghana Cedi')->exists())->toBeFalse();
});

it('accepts a three-letter currency code', function () {
    $this->actingAs(User::factory()->create())
        ->post('/currencies', [
            'code' => 'ghs',
            'name' => 'Ghana Cedi',
            'symbol' => '₵',
            'rate_to_base' => 1,
        ])
        ->assertSessionHasNoErrors();

    expect(Currency::query()->where('code', 'GHS')->exists())->toBeTrue();
});
