<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPayment extends Model
{
    protected $fillable = [
        'bill_id', 'contact_id', 'paid_on', 'amount', 'method', 'reference', 'notes',
        'bank_account_id', 'currency', 'exchange_rate', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'amount' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
        ];
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    protected static function booted(): void
    {
        static::saved(fn (self $payment) => $payment->bill?->recalculateTotals());
        static::deleted(fn (self $payment) => $payment->bill?->recalculateTotals());
    }
}
