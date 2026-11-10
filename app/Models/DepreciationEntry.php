<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepreciationEntry extends Model
{
    protected $fillable = [
        'fixed_asset_id', 'period', 'depreciation_date', 'amount', 'accumulated_after', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'depreciation_date' => 'date',
            'amount' => 'decimal:2',
            'accumulated_after' => 'decimal:2',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(FixedAsset::class, 'fixed_asset_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }
}
