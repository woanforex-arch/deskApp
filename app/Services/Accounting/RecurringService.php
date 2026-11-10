<?php

namespace App\Services\Accounting;

use App\Models\RecurringTransaction;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class RecurringService
{
    public function __construct(
        private readonly InvoiceService $invoices,
        private readonly PayablesService $payables,
        private readonly PostingService $posting,
    ) {}

    /**
     * Execute a recurring transaction template once.
     */
    public function run(RecurringTransaction $recurring, ?User $user = null): mixed
    {
        if (! $recurring->is_active) {
            throw ValidationException::withMessages(['is_active' => 'This recurring transaction is inactive.']);
        }

        $template = $recurring->template ?? [];
        $result = match ($recurring->type) {
            'invoice' => $this->invoices->create($template),
            'bill' => $this->payables->createBill($template, $user),
            'journal' => $this->post($template, $user),
            default => throw ValidationException::withMessages(['type' => 'Unsupported recurring transaction type.']),
        };

        $recurring->forceFill([
            'last_run_at' => now(),
            'next_run_at' => $this->nextDate($recurring),
        ])->save();

        return $result;
    }

    /**
     * Run every due active recurring transaction.
     *
     * @return array<int, mixed>
     */
    public function runDue(?User $user = null): array
    {
        return RecurringTransaction::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', now()))
            ->get()
            ->map(fn (RecurringTransaction $recurring) => $this->run($recurring, $user))
            ->all();
    }

    private function nextDate(RecurringTransaction $recurring): Carbon
    {
        $base = $recurring->next_run_at ? $recurring->next_run_at->copy() : now();
        $interval = max((int) $recurring->interval, 1);

        return match ($recurring->frequency) {
            'daily' => $base->addDays($interval),
            'weekly' => $base->addWeeks($interval),
            'quarterly' => $base->addMonths(3 * $interval),
            'yearly', 'annually' => $base->addYears($interval),
            default => $base->addMonths($interval),
        };
    }

    /**
     * @param  array<string, mixed>  $template
     */
    private function post(array $template, ?User $user): mixed
    {
        return $this->posting->post([
            'entry_date' => $template['entry_date'] ?? today()->toDateString(),
            'memo' => $template['memo'] ?? 'Recurring journal',
        ], $template['lines'] ?? [], $user);
    }
}
