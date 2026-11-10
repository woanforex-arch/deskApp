<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FixedAsset extends Model
{
    protected $fillable = [
        'name', 'code', 'category', 'purchase_date', 'cost', 'salvage_value',
        'useful_life_years', 'depreciation_method', 'accumulated_depreciation',
        'book_value', 'status', 'location', 'assigned_to', 'asset_account_id',
        'depreciation_account_id', 'accumulated_account_id', 'disposed_at',
        'disposal_proceeds', 'gain_loss', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'cost' => 'decimal:2',
            'salvage_value' => 'decimal:2',
            'accumulated_depreciation' => 'decimal:2',
            'book_value' => 'decimal:2',
            'disposed_at' => 'datetime',
            'disposal_proceeds' => 'decimal:2',
            'gain_loss' => 'decimal:2',
        ];
    }

    public function depreciationEntries(): HasMany
    {
        return $this->hasMany(DepreciationEntry::class);
    }

    public function revaluations(): HasMany
    {
        return $this->hasMany(AssetRevaluation::class);
    }

    public function assetAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'asset_account_id');
    }

    public function depreciationAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'depreciation_account_id');
    }

    public function accumulatedAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'accumulated_account_id');
    }

    public function depreciableBase(): float
    {
        return max((float) $this->cost - (float) $this->salvage_value, 0);
    }

    public function monthlyDepreciation(): float
    {
        return round($this->depreciableBase() / max((int) $this->useful_life_years * 12, 1), 2);
    }
}
