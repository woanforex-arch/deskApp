<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RevenueSchedule extends Model
{
    protected $fillable = [
        'invoice_id', 'name', 'total_amount', 'recognized_amount', 'deferred_amount',
        'start_date', 'end_date', 'method', 'status', 'last_recognized_on', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'recognized_amount' => 'decimal:2',
            'deferred_amount' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
            'last_recognized_on' => 'date',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(RevenueRecognitionEntry::class);
    }

    public function monthsRemaining(): int
    {
        if (! $this->start_date || ! $this->end_date) {
            return 1;
        }

        return max($this->start_date->diffInMonths($this->end_date) + 1, 1);
    }
}
