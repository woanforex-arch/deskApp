<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JournalLine>
 */
class JournalLineFactory extends Factory
{
    protected $model = JournalLine::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $isDebit = fake()->boolean();

        return [
            'journal_entry_id' => JournalEntry::factory(),
            'account_id' => Account::factory(),
            'description' => fake()->optional()->sentence(4),
            'debit' => $isDebit ? fake()->randomFloat(2, 50, 5000) : 0,
            'credit' => $isDebit ? 0 : fake()->randomFloat(2, 50, 5000),
        ];
    }

    public function debit(float $amount): static
    {
        return $this->state(fn () => ['debit' => $amount, 'credit' => 0]);
    }

    public function credit(float $amount): static
    {
        return $this->state(fn () => ['debit' => 0, 'credit' => $amount]);
    }
}
