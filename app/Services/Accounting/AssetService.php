<?php

namespace App\Services\Accounting;

use App\Models\FixedAsset;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetService
{
    public function __construct(private readonly PostingService $posting) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): FixedAsset
    {
        $cost = (float) ($data['cost'] ?? 0);
        $salvage = (float) ($data['salvage_value'] ?? 0);

        return FixedAsset::create([
            'name' => $data['name'],
            'code' => $data['code'],
            'category' => $data['category'] ?? null,
            'purchase_date' => $data['purchase_date'],
            'cost' => $cost,
            'salvage_value' => $salvage,
            'useful_life_years' => $data['useful_life_years'] ?? 5,
            'depreciation_method' => $data['depreciation_method'] ?? 'straight_line',
            'accumulated_depreciation' => 0,
            'book_value' => $cost,
            'status' => $data['status'] ?? 'active',
            'location' => $data['location'] ?? null,
            'assigned_to' => $data['assigned_to'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);
    }

    /**
     * Depreciate an asset for a period (YYYY-MM). Idempotent per period.
     */
    public function depreciate(FixedAsset $asset, ?string $period = null, ?string $date = null, ?User $user = null): ?FixedAsset
    {
        $period ??= now()->format('Y-m');
        $date ??= Carbon::createFromFormat('Y-m', $period)->endOfMonth()->toDateString();

        if ($asset->status !== 'active') {
            throw ValidationException::withMessages(['status' => 'Only active assets can be depreciated.']);
        }

        if ($asset->depreciationEntries()->where('period', $period)->exists()) {
            throw ValidationException::withMessages(['period' => 'Depreciation for this period has already been posted.']);
        }

        $amount = min(
            $asset->monthlyDepreciation(),
            round((float) $asset->cost - (float) $asset->salvage_value - (float) $asset->accumulated_depreciation, 2),
        );

        if ($amount <= 0) {
            return null;
        }

        return DB::transaction(function () use ($asset, $amount, $date, $period, $user): FixedAsset {
            $this->posting->postDepreciation($asset, $amount, $date, $period, $user);

            return $asset->refresh();
        });
    }

    public function dispose(FixedAsset $asset, float $proceeds, string $date, ?User $user = null): FixedAsset
    {
        if ($asset->status === 'disposed') {
            throw ValidationException::withMessages(['status' => 'This asset has already been disposed.']);
        }

        $bookValue = round((float) $asset->cost - (float) $asset->accumulated_depreciation, 2);
        $gainLoss = round($proceeds - $bookValue, 2);

        return DB::transaction(function () use ($asset, $proceeds, $bookValue, $gainLoss, $date, $user): FixedAsset {
            $lines = [
                ['account_code' => '1100', 'description' => 'Disposal proceeds — '.$asset->name, 'debit' => $proceeds],
                ['account_code' => '1510', 'description' => 'Accumulated depreciation derecognised', 'debit' => (float) $asset->accumulated_depreciation],
                ['account_code' => '1500', 'description' => 'Asset cost derecognised', 'credit' => (float) $asset->cost],
            ];

            if ($gainLoss > 0.004) {
                $lines[] = ['account_code' => '5900', 'description' => 'Gain on disposal', 'credit' => $gainLoss];
            } elseif ($gainLoss < -0.004) {
                $lines[] = ['account_code' => '5800', 'description' => 'Loss on disposal', 'debit' => abs($gainLoss)];
            }

            $this->posting->post([
                'entry_date' => $date,
                'memo' => 'Disposal of '.$asset->name,
                'source_type' => FixedAsset::class,
                'source_id' => $asset->id,
                'metadata' => ['type' => 'disposal'],
            ], $lines, $user);

            $asset->forceFill([
                'status' => 'disposed',
                'disposed_at' => now(),
                'disposal_proceeds' => $proceeds,
                'gain_loss' => $gainLoss,
                'book_value' => 0,
            ])->save();

            return $asset->refresh();
        });
    }

    public function revalue(FixedAsset $asset, float $newValue, string $date, ?string $notes = null, ?User $user = null): FixedAsset
    {
        $oldValue = (float) $asset->book_value;
        $adjustment = round($newValue - $oldValue, 2);

        if (abs($adjustment) < 0.005) {
            throw ValidationException::withMessages(['new_value' => 'The new value must differ from the current book value.']);
        }

        return DB::transaction(function () use ($asset, $oldValue, $newValue, $adjustment, $date, $notes, $user): FixedAsset {
            $lines = $adjustment > 0
                ? [
                    ['account_code' => '1500', 'description' => 'Asset revaluation — '.$asset->name, 'debit' => abs($adjustment)],
                    ['account_code' => '3200', 'description' => 'Revaluation surplus', 'credit' => abs($adjustment)],
                ]
                : [
                    ['account_code' => '3200', 'description' => 'Revaluation deficit', 'debit' => abs($adjustment)],
                    ['account_code' => '1500', 'description' => 'Asset revaluation — '.$asset->name, 'credit' => abs($adjustment)],
                ];

            $entry = $this->posting->post([
                'entry_date' => $date,
                'memo' => 'Revaluation of '.$asset->name,
                'source_type' => FixedAsset::class,
                'source_id' => $asset->id,
                'metadata' => ['type' => 'revaluation'],
            ], $lines, $user);

            $asset->forceFill([
                'cost' => round((float) $asset->cost + $adjustment, 2),
                'book_value' => $newValue,
            ])->save();

            $asset->revaluations()->create([
                'revaluation_date' => $date,
                'old_value' => $oldValue,
                'new_value' => $newValue,
                'adjustment' => $adjustment,
                'journal_entry_id' => $entry->id,
                'notes' => $notes,
            ]);

            return $asset->refresh();
        });
    }
}
