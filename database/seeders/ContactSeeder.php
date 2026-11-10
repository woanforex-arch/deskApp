<?php

namespace Database\Seeders;

use App\Enums\ContactType;
use App\Models\Contact;
use Illuminate\Database\Seeder;

class ContactSeeder extends Seeder
{
    public function run(): void
    {
        $contacts = [
            [
                'name' => 'Northwind Studio',
                'email' => 'billing@northwind.studio',
                'phone' => '+1 (415) 555-0132',
                'type' => ContactType::Customer,
                'city' => 'San Francisco',
                'country' => 'United States',
                'tax_number' => 'TAX-8841-NW',
            ],
            [
                'name' => 'Harbor & Pine',
                'email' => 'accounts@harborpine.co',
                'phone' => '+1 (206) 555-0177',
                'type' => ContactType::Customer,
                'city' => 'Seattle',
                'country' => 'United States',
                'tax_number' => 'TAX-2210-HP',
            ],
            [
                'name' => 'Meridian Labs',
                'email' => 'finance@meridianlabs.io',
                'phone' => '+1 (512) 555-0198',
                'type' => ContactType::Customer,
                'city' => 'Austin',
                'country' => 'United States',
                'tax_number' => 'TAX-7712-ML',
            ],
            [
                'name' => 'Cobalt Partners',
                'email' => 'ap@cobaltpartners.com',
                'phone' => '+1 (312) 555-0144',
                'type' => ContactType::Customer,
                'city' => 'Chicago',
                'country' => 'United States',
                'tax_number' => 'TAX-1908-CP',
            ],
            [
                'name' => 'Juniper Foods',
                'email' => 'hello@juniperfoods.com',
                'phone' => '+1 (503) 555-0110',
                'type' => ContactType::Customer,
                'city' => 'Portland',
                'country' => 'United States',
                'tax_number' => 'TAX-5603-JF',
            ],
            [
                'name' => 'Atlas Cloud Services',
                'email' => 'billing@atlascloud.dev',
                'phone' => '+1 (650) 555-0186',
                'type' => ContactType::Vendor,
                'city' => 'Palo Alto',
                'country' => 'United States',
                'tax_number' => 'TAX-3307-AC',
            ],
            [
                'name' => 'Fieldwork Legal',
                'email' => 'invoices@fieldworklegal.com',
                'phone' => '+1 (212) 555-0165',
                'type' => ContactType::Vendor,
                'city' => 'New York',
                'country' => 'United States',
                'tax_number' => 'TAX-6124-FL',
            ],
            [
                'name' => 'Brightline Design',
                'email' => 'studio@brightline.design',
                'phone' => '+1 (720) 555-0123',
                'type' => ContactType::Both,
                'city' => 'Denver',
                'country' => 'United States',
                'tax_number' => 'TAX-4471-BD',
            ],
        ];

        foreach ($contacts as $contact) {
            Contact::updateOrCreate(
                ['email' => $contact['email']],
                [
                    ...$contact,
                    'address' => fake()->streetAddress(),
                    'is_active' => true,
                ],
            );
        }
    }
}
