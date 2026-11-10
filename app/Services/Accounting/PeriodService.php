<?php

namespace App\Services\Accounting;

use App\Models\AccountingPeriod;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PeriodService
{
    public function lockedPeriod(CarbonInterface|string $date): ?AccountingPeriod
    {
        $date = $date instanceof CarbonInterface ? $date : Carbon::parse($date);

        return AccountingPeriod::query()
            ->whereDate('start_date', '<=', $date->toDateString())
            ->whereDate('end_date', '>=', $date->toDateString())
            ->where('status', '!=', 'open')
            ->first();
    }

    public function isLocked(CarbonInterface|string $date): bool
    {
        return $this->lockedPeriod($date) !== null;
    }

    public function assertOpen(CarbonInterface|string $date): void
    {
        $period = $this->lockedPeriod($date);

        if ($period) {
            throw ValidationException::withMessages([
                'entry_date' => "The accounting period \"{$period->name}\" is {$period->status}. Postings dated within it are blocked until it is reopened.",
            ]);
        }
    }

    public function close(AccountingPeriod $period, ?User $user = null): AccountingPeriod
    {
        $period->forceFill([
            'status' => 'closed',
            'closed_by' => $user?->id,
            'closed_at' => now(),
        ])->save();

        return $period;
    }

    public function reopen(AccountingPeriod $period): AccountingPeriod
    {
        $period->forceFill([
            'status' => 'open',
            'closed_by' => null,
            'closed_at' => null,
        ])->save();

        return $period;
    }

    public function createMonth(Carbon $date, string $status = 'open'): AccountingPeriod
    {
        return AccountingPeriod::updateOrCreate(
            [
                'start_date' => $date->copy()->startOfMonth()->toDateString(),
                'end_date' => $date->copy()->endOfMonth()->toDateString(),
            ],
            [
                'name' => $date->format('F Y'),
                'status' => $status,
            ],
        );
    }
}
