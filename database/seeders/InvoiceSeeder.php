<?php

namespace Database\Seeders;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use Illuminate\Database\Seeder;

class InvoiceSeeder extends Seeder
{
    public function run(): void
    {
        if (Invoice::query()->exists()) {
            return;
        }

        $customers = Contact::query()->customers()->get();

        if ($customers->isEmpty()) {
            return;
        }

        $revenueAccounts = Account::query()
            ->whereIn('code', ['4100', '4200', '4300'])
            ->pluck('id', 'code');

        $catalog = [
            ['description' => 'Monthly bookkeeping retainer', 'unit_price' => 1200, 'tax_rate' => 0, 'account' => '4100'],
            ['description' => 'Quarterly financial review', 'unit_price' => 2400, 'tax_rate' => 5, 'account' => '4100'],
            ['description' => 'Fractional CFO advisory', 'unit_price' => 3800, 'tax_rate' => 5, 'account' => '4100'],
            ['description' => 'Annual tax preparation', 'unit_price' => 1800, 'tax_rate' => 10, 'account' => '4300'],
            ['description' => 'Payroll processing — monthly', 'unit_price' => 650, 'tax_rate' => 0, 'account' => '4300'],
            ['description' => 'Accounting software implementation', 'unit_price' => 4200, 'tax_rate' => 10, 'account' => '4200'],
            ['description' => 'Accounts receivable cleanup', 'unit_price' => 950, 'tax_rate' => 5, 'account' => '4300'],
            ['description' => 'Budget and forecast workshop', 'unit_price' => 1500, 'tax_rate' => 5, 'account' => '4100'],
        ];

        $statusCycle = [
            InvoiceStatus::Paid,
            InvoiceStatus::Paid,
            InvoiceStatus::Paid,
            InvoiceStatus::Paid,
            InvoiceStatus::Sent,
            InvoiceStatus::Sent,
            InvoiceStatus::Overdue,
            InvoiceStatus::Draft,
        ];

        $sequence = 1;

        foreach (range(1, 18) as $index) {
            $status = $statusCycle[($index - 1) % count($statusCycle)];

            $issueDate = match ($status) {
                InvoiceStatus::Paid => now()->subDays(fake()->numberBetween(40, 160)),
                InvoiceStatus::Overdue => now()->subDays(fake()->numberBetween(45, 95)),
                InvoiceStatus::Sent => now()->subDays(fake()->numberBetween(1, 15)),
                default => now()->subDays(fake()->numberBetween(0, 10)),
            };

            $issueDate = $issueDate->startOfDay();
            $dueDate = $issueDate->copy()->addDays(30);

            $invoice = Invoice::create([
                'contact_id' => $customers->random()->id,
                'number' => sprintf('INV-%s-%04d', $issueDate->format('Y'), $sequence++),
                'issue_date' => $issueDate->toDateString(),
                'due_date' => $dueDate->toDateString(),
                'status' => $status === InvoiceStatus::Paid ? InvoiceStatus::Sent : $status,
                'currency' => 'USD',
                'notes' => fake()->optional(0.4)->sentence(),
                'terms' => 'Payment due within 30 days. Late payments accrue 1.5% monthly interest.',
                'sent_at' => $status === InvoiceStatus::Draft ? null : $issueDate,
            ]);

            $lineItems = collect($catalog)->random(fake()->numberBetween(1, 3));

            foreach ($lineItems as $line) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'account_id' => $revenueAccounts[$line['account']] ?? null,
                    'description' => $line['description'],
                    'quantity' => fake()->numberBetween(1, 4),
                    'unit_price' => $line['unit_price'],
                    'tax_rate' => $line['tax_rate'],
                ]);
            }

            $invoice->recalculateTotals();

            if ($status === InvoiceStatus::Paid) {
                $paidOn = $issueDate->copy()->addDays(fake()->numberBetween(3, 20));

                Payment::create([
                    'invoice_id' => $invoice->id,
                    'contact_id' => $invoice->contact_id,
                    'paid_on' => $paidOn->toDateString(),
                    'amount' => $invoice->total,
                    'method' => fake()->randomElement([
                        PaymentMethod::BankTransfer,
                        PaymentMethod::BankTransfer,
                        PaymentMethod::Card,
                        PaymentMethod::Cheque,
                    ]),
                    'reference' => 'PMT-'.$invoice->number,
                ]);

                $invoice->forceFill(['paid_at' => $paidOn])->saveQuietly();
            }
        }
    }
}
