<?php

namespace App\Services\Accounting;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

class AuditService
{
    /**
     * Write an immutable audit trail record.
     *
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     */
    public function log(string $action, ?Model $subject = null, array $old = [], array $new = [], ?string $description = null): AuditLog
    {
        $user = auth()->user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'auditable_type' => $subject ? $subject::class : null,
            'auditable_id' => $subject?->getKey(),
            'description' => $description,
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'ip_address' => request()?->ip(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    public function onlyChanged(Model $model, array $changes): array
    {
        return Arr::only($changes, array_keys($model->getChanges()));
    }
}
