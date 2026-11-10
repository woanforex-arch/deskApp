<?php

namespace App\Models;

use Database\Factories\InvoiceItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    /** @use HasFactory<InvoiceItemFactory> */
    use HasFactory;

    protected $fillable = [
        'invoice_id',
        'account_id',
        'inventory_item_id',
        'project_id',
        'cost_center_id',
        'description',
        'quantity',
        'unit_price',
        'tax_rate',
        'amount',
        'tax_amount',
        'total',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
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
            $quantity = (float) $item->quantity;
            $unitPrice = (float) $item->unit_price;
            $taxRate = (float) $item->tax_rate;

            $amount = round($quantity * $unitPrice, 2);
            $taxAmount = round($amount * ($taxRate / 100), 2);

            $item->amount = $amount;
            $item->tax_amount = $taxAmount;
            $item->total = round($amount + $taxAmount, 2);
        });

        static::saved(fn (self $item) => $item->invoice?->recalculateTotals());
        static::deleted(fn (self $item) => $item->invoice?->recalculateTotals());
    }
}
