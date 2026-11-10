<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxRemittance extends Model
{
    protected $fillable = [
        'tax_rate_id', 'name', 'period', 'due_date', 'amount', 'status',
        'remitted_at', 'reference', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'amount' => 'decimal:2',
            'remitted_at' => 'datetime',
        ];
    }

    public function taxRate(): BelongsTo
    {
        return $this->belongsTo(TaxRate::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }
}
