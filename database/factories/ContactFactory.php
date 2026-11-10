<?php

namespace Database\Factories;

use App\Enums\ContactType;
use App\Models\Contact;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    protected $model = Contact::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+1 (###) ###-####'),
            'type' => fake()->randomElement([ContactType::Customer, ContactType::Customer, ContactType::Vendor]),
            'tax_number' => fake()->optional()->bothify('TAX-####-????'),
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'country' => fake()->country(),
            'notes' => fake()->optional()->sentence(),
            'is_active' => true,
        ];
    }

    public function customer(): static
    {
        return $this->state(fn () => ['type' => ContactType::Customer]);
    }

    public function vendor(): static
    {
        return $this->state(fn () => ['type' => ContactType::Vendor]);
    }
}
