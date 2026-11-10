<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Integration extends Model
{
    protected $fillable = ['name', 'type', 'provider', 'config', 'status', 'last_synced_at'];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'last_synced_at' => 'datetime',
        ];
    }
}
