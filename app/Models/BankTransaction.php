<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankTransaction extends Model
{
    protected $fillable = [
        'bank_account_id', 'transaction_date', 'description', 'reference', 'type',
        'amount', 'currency', 'exchange_rate', 'status', 'matched_at',
        'reconciliation_id', 'journal_entry_id', 'contact_id', 'source',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'matched_at' => 'datetime',
        ];
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(BankReconciliation::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function signedAmount(): float
    {
        return $this->type === 'withdrawal' ? -1 * (float) $this->amount : (float) $this->amount;
    }
}
