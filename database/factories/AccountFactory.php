<?php

namespace Database\Factories;

use App\Enums\AccountType;
use App\Models\Account;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    protected $model = Account::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $type = fake()->randomElement(AccountType::cases());

        return [
            'parent_id' => null,
            'code' => fake()->unique()->numerify('9####'),
            'name' => fake()->words(2, true).' Account',
            'type' => $type,
            'description' => fake()->optional()->sentence(),
            'is_active' => true,
        ];
    }

    public function ofType(AccountType $type): static
    {
        return $this->state(fn () => ['type' => $type]);
    }
}
