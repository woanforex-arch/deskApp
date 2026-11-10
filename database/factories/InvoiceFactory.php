<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $issueDate = Carbon::parse(fake()->dateTimeBetween('-5 months', 'now'));

        return [
            'contact_id' => Contact::factory()->customer(),
            'number' => 'INV-'.$issueDate->format('Y').'-'.fake()->unique()->numerify('####'),
            'issue_date' => $issueDate->toDateString(),
            'due_date' => $issueDate->copy()->addDays(30)->toDateString(),
            'status' => InvoiceStatus::Draft,
            'currency' => 'USD',
            'subtotal' => 0,
            'tax_total' => 0,
            'total' => 0,
            'amount_paid' => 0,
            'notes' => fake()->optional()->sentence(),
            'terms' => 'Payment due within 30 days.',
        ];
    }

    public function sent(): static
    {
        return $this->state(fn () => [
            'status' => InvoiceStatus::Sent,
            'sent_at' => now(),
        ]);
    }

    public function overdue(): static
    {
        return $this->state(fn () => [
            'status' => InvoiceStatus::Overdue,
            'issue_date' => now()->subDays(60)->toDateString(),
            'due_date' => now()->subDays(15)->toDateString(),
            'sent_at' => now()->subDays(60),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'status' => InvoiceStatus::Paid,
            'sent_at' => now()->subDays(20),
            'paid_at' => now()->subDays(5),
        ]);
    }

    public function withItems(int $count = 2): static
    {
        return $this->afterCreating(function (Invoice $invoice) use ($count): void {
            InvoiceItem::factory()->count($count)->for($invoice)->create();
            $invoice->recalculateTotals();
        });
    }
}
