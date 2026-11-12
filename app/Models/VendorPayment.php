<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class VendorPayment extends Model
{
    protected $fillable = [
        'payment_number', 'bill_id', 'contact_id', 'paid_on', 'amount', 'method', 'reference', 'notes',
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

    public static function generatePaymentNumber(CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = 'VPAY-'.$date->format('Y').'-';
        $latest = static::query()
            ->where('payment_number', 'like', $prefix.'%')
            ->orderByDesc('payment_number')
            ->value('payment_number');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    public static function generateReference(CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = 'PAY-'.$date->format('Y').'-';
        $latest = static::query()
            ->where('reference', 'like', $prefix.'%')
            ->orderByDesc('reference')
            ->value('reference');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    protected static function booted(): void
    {
        static::creating(function (self $payment): void {
            if (blank($payment->payment_number)) {
                $payment->payment_number = self::generatePaymentNumber($payment->paid_on);
            }

            if (blank($payment->reference)) {
                $payment->reference = self::generateReference($payment->paid_on);
            }
        });

        static::saved(fn (self $payment) => $payment->bill?->recalculateTotals());
        static::deleted(fn (self $payment) => $payment->bill?->recalculateTotals());
    }
}
