<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Budget extends Model
{
    protected $fillable = [
        'name', 'fiscal_year', 'branch_id', 'department_id', 'project_id', 'status', 'notes', 'created_by',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(BudgetLine::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function total(): float
    {
        return round((float) $this->lines()->sum('amount'), 2);
    }
}
