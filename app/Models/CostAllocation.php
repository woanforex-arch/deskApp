<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CostAllocation extends Model
{
    protected $fillable = [
        'name', 'source_cost_center_id', 'target_cost_center_id', 'account_id',
        'percentage', 'basis', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class, 'source_cost_center_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class, 'target_cost_center_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
