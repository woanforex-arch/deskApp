<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillItem extends Model
{
    protected $fillable = [
        'bill_id', 'account_id', 'inventory_item_id', 'project_id', 'cost_center_id',
        'description', 'quantity', 'unit_price', 'tax_rate', 'tax_amount', 'amount',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'tax_rate' => 'decimal:4',
            'tax_amount' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    protected static function booted(): void
    {
        static::saving(function (self $item): void {
            $line = round((float) $item->quantity * (float) $item->unit_price, 2);
            $item->amount = $line;
            $item->tax_amount = round($line * ((float) $item->tax_rate / 100), 2);
        });

        static::saved(fn (self $item) => $item->bill?->recalculateTotals());
        static::deleted(fn (self $item) => $item->bill?->recalculateTotals());
    }
}
