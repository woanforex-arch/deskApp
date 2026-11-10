<?php

namespace Database\Seeders;

use App\Enums\JournalEntryStatus;
use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;

class JournalEntrySeeder extends Seeder
{
    public function run(): void
    {
        if (JournalEntry::query()->exists()) {
            return;
        }

        $user = User::query()->where('email', 'admin@ledgerly.test')->first()
            ?? User::factory()->create();

        $accounts = Account::query()->pluck('id', 'code');

        $createEntry = function (string $memo, CarbonInterface $date, array $lines) use ($accounts, $user): void {
            $entry = JournalEntry::create([
                'reference' => JournalEntry::generateReference($date),
                'entry_date' => $date->toDateString(),
                'memo' => $memo,
                'status' => JournalEntryStatus::Posted,
                'created_by' => $user->id,
            ]);

            foreach ($lines as $line) {
                $entry->lines()->create([
                    'account_id' => $accounts[$line['account']],
                    'description' => $line['description'] ?? $memo,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                ]);
            }
        };

        $createEntry(
            'Owner capital contribution',
            now()->subMonths(5)->startOfMonth()->addDays(2),
            [
                ['account' => '1100', 'debit' => 150000, 'description' => 'Initial operating capital'],
                ['account' => '3100', 'credit' => 150000],
            ],
        );

        $createEntry(
            'Equipment purchase — design workstations',
            now()->subMonths(5)->startOfMonth()->addDays(5),
            [
                ['account' => '1500', 'debit' => 6000],
                ['account' => '1100', 'credit' => 6000],
            ],
        );

        foreach (range(4, 0) as $monthsAgo) {
            $month = now()->subMonths($monthsAgo);
            $revenueAmount = 25000 + ((4 - $monthsAgo) * 1500);

            $createEntry(
                'Consulting revenue accrued — '.$month->format('F Y'),
                $month->copy()->startOfMonth()->addDays(9),
                [
                    ['account' => '1200', 'debit' => $revenueAmount, 'description' => 'Client invoices issued'],
                    ['account' => '4100', 'credit' => $revenueAmount],
                ],
            );

            $createEntry(
                'Office rent — '.$month->format('F Y'),
                $month->copy()->startOfMonth(),
                [
                    ['account' => '5300', 'debit' => 2400],
                    ['account' => '1100', 'credit' => 2400],
                ],
            );

            $createEntry(
                'Payroll — '.$month->format('F Y'),
                $month->copy()->startOfMonth()->addDays(14),
                [
                    ['account' => '5200', 'debit' => 12000],
                    ['account' => '1100', 'credit' => 12000],
                ],
            );

            $createEntry(
                'Software subscriptions — '.$month->format('F Y'),
                $month->copy()->startOfMonth()->addDays(19),
                [
                    ['account' => '5500', 'debit' => 450],
                    ['account' => '1100', 'credit' => 450],
                ],
            );
        }

        $createEntry(
            'Cash sale — advisory workshop',
            now()->subMonths(2)->startOfMonth()->addDays(22),
            [
                ['account' => '1100', 'debit' => 15000],
                ['account' => '4300', 'credit' => 15000],
            ],
        );
    }
}
