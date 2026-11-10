<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class CreditNote extends Model
{
    protected $fillable = [
        'invoice_id', 'bill_id', 'contact_id', 'number', 'issue_date', 'type', 'reason',
        'status', 'currency', 'exchange_rate', 'subtotal', 'tax_total', 'total',
        'journal_entry_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'exchange_rate' => 'decimal:6',
            'subtotal' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CreditNoteItem::class);
    }

    public function recalculateTotals(): void
    {
        $subtotal = round((float) $this->items()->sum('amount'), 2);
        $tax = round((float) $this->items()->sum('tax_amount'), 2);

        $this->forceFill([
            'subtotal' => $subtotal,
            'tax_total' => $tax,
            'total' => round($subtotal + $tax, 2),
        ])->saveQuietly();
    }

    public static function generateNumber(string $type = 'sales', CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = ($type === 'purchase' ? 'PCN-' : 'CN-').$date->format('Y').'-';
        $latest = static::query()
            ->where('number', 'like', $prefix.'%')
            ->orderByDesc('number')
            ->value('number');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
