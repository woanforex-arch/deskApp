<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditNoteItem extends Model
{
    protected $fillable = [
        'credit_note_id', 'account_id', 'description', 'quantity', 'unit_price',
        'tax_rate', 'tax_amount', 'amount',
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

    public function creditNote(): BelongsTo
    {
        return $this->belongsTo(CreditNote::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    protected static function booted(): void
    {
        static::saving(function (self $item): void {
            $line = round((float) $item->quantity * (float) $item->unit_price, 2);
            $item->amount = $line;
            $item->tax_amount = round($line * ((float) $item->tax_rate / 100), 2);
        });

        static::saved(fn (self $item) => $item->creditNote?->recalculateTotals());
        static::deleted(fn (self $item) => $item->creditNote?->recalculateTotals());
    }
}
