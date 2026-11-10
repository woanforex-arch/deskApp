<?php

namespace Database\Factories;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InvoiceItem>
 */
class InvoiceItemFactory extends Factory
{
    protected $model = InvoiceItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'invoice_id' => Invoice::factory(),
            'account_id' => null,
            'description' => fake()->sentence(4),
            'quantity' => fake()->randomFloat(2, 1, 8),
            'unit_price' => fake()->randomFloat(2, 45, 950),
            'tax_rate' => fake()->randomElement([0, 0, 5, 10]),
            'amount' => 0,
            'tax_amount' => 0,
            'total' => 0,
        ];
    }
}
