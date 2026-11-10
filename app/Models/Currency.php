<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Currency extends Model
{
    protected $fillable = ['code', 'name', 'symbol', 'rate_to_base', 'is_base', 'is_active'];

    protected function casts(): array
    {
        return [
            'rate_to_base' => 'decimal:6',
            'is_base' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function exchangeRates(): HasMany
    {
        return $this->hasMany(ExchangeRate::class, 'currency_code', 'code');
    }
}
