<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    protected $fillable = [
        'period', 'pay_date', 'status', 'gross_total', 'deductions_total', 'net_total',
        'journal_entry_id', 'approved_by', 'approved_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'pay_date' => 'date',
            'gross_total' => 'decimal:2',
            'deductions_total' => 'decimal:2',
            'net_total' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function approvals()
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }

    public function recalculateTotals(): void
    {
        $gross = round((float) $this->items()->sum('gross'), 2);
        $deductions = round((float) $this->items()->sum('income_tax')
            + (float) $this->items()->sum('social_security')
            + (float) $this->items()->sum('other_deductions'), 2);
        $net = round((float) $this->items()->sum('net'), 2);

        $this->forceFill([
            'gross_total' => $gross,
            'deductions_total' => $deductions,
            'net_total' => $net,
        ])->saveQuietly();
    }
}
