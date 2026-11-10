<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    protected $fillable = [
        'sku', 'name', 'description', 'category', 'unit', 'cost_method', 'unit_cost',
        'quantity_on_hand', 'reorder_level', 'inventory_account_id', 'cogs_account_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:4',
            'quantity_on_hand' => 'decimal:4',
            'reorder_level' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function inventoryAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'inventory_account_id');
    }

    public function cogsAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'cogs_account_id');
    }

    public function value(): float
    {
        return round((float) $this->quantity_on_hand * (float) $this->unit_cost, 2);
    }

    public function isLowStock(): bool
    {
        return (float) $this->quantity_on_hand <= (float) $this->reorder_level;
    }
}
