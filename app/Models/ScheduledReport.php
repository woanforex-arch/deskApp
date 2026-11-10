<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduledReport extends Model
{
    protected $fillable = [
        'name', 'report', 'recipients', 'frequency', 'next_run_at', 'last_sent_at', 'filters', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'next_run_at' => 'datetime',
            'last_sent_at' => 'datetime',
            'filters' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
