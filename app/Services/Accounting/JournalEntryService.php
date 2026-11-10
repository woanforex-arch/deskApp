<?php

namespace App\Services\Accounting;

use App\Enums\JournalEntryStatus;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JournalEntryService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?User $user = null): JournalEntry
    {
        return DB::transaction(function () use ($data, $user): JournalEntry {
            $status = $data['status'] ?? JournalEntryStatus::Draft;
            $status = $status instanceof JournalEntryStatus ? $status : JournalEntryStatus::from($status);

            $entry = JournalEntry::create([
                'reference' => $data['reference'] ?? JournalEntry::generateReference($data['entry_date'] ?? null),
                'entry_date' => $data['entry_date'],
                'memo' => $data['memo'],
                'status' => $status,
                'created_by' => $user?->id,
            ]);

            foreach ($data['lines'] as $line) {
                $entry->lines()->create([
                    'account_id' => $line['account_id'],
                    'description' => $line['description'] ?? null,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                ]);
            }

            return $entry->load(['lines.account', 'creator']);
        });
    }

    public function post(JournalEntry $entry): JournalEntry
    {
        if ($entry->status === JournalEntryStatus::Void) {
            throw ValidationException::withMessages([
                'status' => 'Void journal entries cannot be posted.',
            ]);
        }

        if (! $entry->isBalanced()) {
            throw ValidationException::withMessages([
                'lines' => 'A journal entry must have equal debits and credits before it can be posted.',
            ]);
        }

        $entry->forceFill([
            'status' => JournalEntryStatus::Posted,
            'posted_at' => now(),
        ])->save();

        return $entry->refresh()->load(['lines.account', 'creator']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(JournalEntry $entry, array $data): JournalEntry
    {
        return DB::transaction(function () use ($entry, $data): JournalEntry {
            $entry->update([
                'reference' => $data['reference'] ?? $entry->reference,
                'entry_date' => $data['entry_date'],
                'memo' => $data['memo'],
            ]);

            $entry->lines()->delete();

            foreach ($data['lines'] as $line) {
                $entry->lines()->create([
                    'account_id' => $line['account_id'],
                    'description' => $line['description'] ?? null,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                ]);
            }

            return $entry->refresh()->load(['lines.account', 'creator']);
        });
    }

    public function duplicate(JournalEntry $entry, ?User $user = null): JournalEntry
    {
        return DB::transaction(function () use ($entry, $user): JournalEntry {
            $entry->loadMissing('lines');

            $copy = JournalEntry::create([
                'reference' => JournalEntry::generateReference(),
                'entry_date' => today()->toDateString(),
                'memo' => 'Copy of '.$entry->reference.($entry->memo ? ' — '.$entry->memo : ''),
                'status' => JournalEntryStatus::Draft,
                'currency' => $entry->currency,
                'exchange_rate' => $entry->exchange_rate,
                'created_by' => $user?->id,
            ]);

            foreach ($entry->lines as $line) {
                $copy->lines()->create([
                    'account_id' => $line->account_id,
                    'description' => $line->description,
                    'debit' => $line->debit,
                    'credit' => $line->credit,
                    'department_id' => $line->department_id,
                    'cost_center_id' => $line->cost_center_id,
                    'project_id' => $line->project_id,
                    'currency' => $line->currency,
                    'foreign_debit' => $line->foreign_debit,
                    'foreign_credit' => $line->foreign_credit,
                    'exchange_rate' => $line->exchange_rate,
                ]);
            }

            return $copy->load(['lines.account', 'creator']);
        });
    }
}
