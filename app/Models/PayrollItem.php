<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollItem extends Model
{
    protected $fillable = [
        'payroll_run_id', 'employee_id', 'gross', 'income_tax', 'social_security',
        'other_deductions', 'net', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'gross' => 'decimal:2',
            'income_tax' => 'decimal:2',
            'social_security' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'net' => 'decimal:2',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    protected static function booted(): void
    {
        static::saving(function (self $item): void {
            $item->net = round(
                (float) $item->gross - (float) $item->income_tax - (float) $item->social_security - (float) $item->other_deductions,
                2,
            );
        });

        static::saved(fn (self $item) => $item->run?->recalculateTotals());
        static::deleted(fn (self $item) => $item->run?->recalculateTotals());
    }
}
