<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RevenueRecognitionEntry extends Model
{
    protected $fillable = ['revenue_schedule_id', 'recognition_date', 'amount', 'journal_entry_id'];

    protected function casts(): array
    {
        return [
            'recognition_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(RevenueSchedule::class, 'revenue_schedule_id');
    }
}
