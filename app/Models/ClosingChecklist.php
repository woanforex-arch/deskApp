<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClosingChecklist extends Model
{
    protected $fillable = [
        'accounting_period_id', 'name', 'status', 'assigned_to', 'due_date', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(AccountingPeriod::class, 'accounting_period_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ClosingTask::class);
    }

    public function progress(): int
    {
        $total = $this->tasks()->count();
        if ($total === 0) {
            return 0;
        }

        return (int) round($this->tasks()->where('status', 'done')->count() / $total * 100);
    }
}
