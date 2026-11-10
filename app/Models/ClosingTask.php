<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClosingTask extends Model
{
    protected $fillable = ['closing_checklist_id', 'title', 'status', 'owner', 'notes', 'completed_at'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(ClosingChecklist::class);
    }
}
