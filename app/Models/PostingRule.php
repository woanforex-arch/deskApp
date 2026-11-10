<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostingRule extends Model
{
    protected $fillable = [
        'event', 'name', 'debit_account_id', 'credit_account_id', 'tax_account_id', 'is_active', 'description',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function debitAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'debit_account_id');
    }

    public function creditAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'credit_account_id');
    }

    public function taxAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'tax_account_id');
    }
}
