<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'employee_number', 'name', 'email', 'department_id', 'position', 'hire_date',
        'gross_salary', 'pay_frequency', 'tax_number', 'bank_account', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'gross_salary' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function payrollItems(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }
}
