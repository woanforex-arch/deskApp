<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    protected $fillable = [
        'name',
        'code',
        'base_currency',
        'business_type',
        'trading_name',
        'tax_number',
        'registration_number',
        'business_email',
        'website',
        'postal_address',
        'physical_address',
        'logo_path',
        'is_active',
    ];

    /**
     * The entity used to brand documents and reports.
     */
    public static function primary(): ?self
    {
        return static::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->first([
                'id',
                'name',
                'code',
                'trading_name',
                'business_type',
                'business_email',
                'website',
                'physical_address',
                'postal_address',
                'tax_number',
                'registration_number',
                'base_currency',
                'logo_path',
            ]);
    }

    /**
     * Public URL for the company logo (served from the local storage disk).
     */
    public function logoUrl(): ?string
    {
        return $this->logo_path
            ? route('organisation.companies.logo', ['company' => $this->id])
            : null;
    }

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    public function journalEntries(): HasMany
    {
        return $this->hasMany(JournalEntry::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
