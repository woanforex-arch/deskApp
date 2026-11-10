<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashTransaction extends Model
{
    protected $fillable = [
        'cashbook_id', 'transaction_date', 'type', 'amount', 'description',
        'reference', 'contact_id', 'journal_entry_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function cashbook(): BelongsTo
    {
        return $this->belongsTo(Cashbook::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function signedAmount(): float
    {
        return in_array($this->type, ['payment', 'transfer_out'], true)
            ? -1 * (float) $this->amount
            : (float) $this->amount;
    }
}
