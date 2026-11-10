<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    protected $fillable = [
        'invoice_id',
        'contact_id',
        'paid_on',
        'amount',
        'method',
        'reference',
        'receipt_number',
        'bank_account_id',
        'currency',
        'exchange_rate',
        'base_amount',
        'realized_fx',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'amount' => 'decimal:2',
            'method' => PaymentMethod::class,
            'exchange_rate' => 'decimal:6',
            'base_amount' => 'decimal:2',
            'realized_fx' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
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
        static::saved(fn (self $payment) => $payment->invoice?->refreshPaymentTotals());
        static::deleted(fn (self $payment) => $payment->invoice?->refreshPaymentTotals());
    }
}
