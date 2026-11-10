<?php

namespace Database\Factories;

use App\Enums\JournalEntryStatus;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JournalEntry>
 */
class JournalEntryFactory extends Factory
{
    protected $model = JournalEntry::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $date = fake()->dateTimeBetween('-3 months', 'now');

        return [
            'reference' => 'JE-'.now()->format('Ym').'-'.fake()->unique()->numerify('####'),
            'entry_date' => $date->format('Y-m-d'),
            'memo' => fake()->sentence(5),
            'status' => JournalEntryStatus::Posted,
            'posted_at' => now(),
            'created_by' => User::factory(),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => [
            'status' => JournalEntryStatus::Draft,
            'posted_at' => null,
        ]);
    }
}
