<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetRevaluation extends Model
{
    protected $fillable = [
        'fixed_asset_id', 'revaluation_date', 'old_value', 'new_value', 'adjustment', 'journal_entry_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'revaluation_date' => 'date',
            'old_value' => 'decimal:2',
            'new_value' => 'decimal:2',
            'adjustment' => 'decimal:2',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(FixedAsset::class, 'fixed_asset_id');
    }
}
