<?php

namespace Database\Factories;

use App\Enums\PaymentMethod;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'invoice_id' => Invoice::factory(),
            'contact_id' => Contact::factory(),
            'paid_on' => now()->toDateString(),
            'amount' => fake()->randomFloat(2, 50, 2500),
            'method' => fake()->randomElement(PaymentMethod::cases()),
            'reference' => fake()->optional()->bothify('PMT-####??'),
            'notes' => null,
        ];
    }
}
