<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalWorkflow extends Model
{
    protected $fillable = ['name', 'type', 'threshold', 'approver_role', 'is_active', 'description'];

    protected function casts(): array
    {
        return [
            'threshold' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class);
    }

    public static function matching(string $type, float $amount): ?self
    {
        return static::query()
            ->where('type', $type)
            ->where('is_active', true)
            ->where('threshold', '<=', $amount)
            ->orderByDesc('threshold')
            ->first();
    }
}
