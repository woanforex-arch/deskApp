<?php

namespace App\Models;

use App\Enums\AccountType;
use App\Enums\NormalBalance;
use App\Services\Accounting\CurrencyService;
use Database\Factories\AccountFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    /** @use HasFactory<AccountFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        // `currency` and `opening_balance` are NOT NULL columns, but the
        // account forms deliberately allow them to be left blank (blank
        // currency inherits the company's base currency).
        static::saving(function (Account $account): void {
            if (! filled($account->currency)) {
                $account->currency = app(CurrencyService::class)->baseCurrency();
            }

            $account->currency = strtoupper($account->currency);

            if ($account->opening_balance === null) {
                $account->opening_balance = 0;
            }
        });
    }

    protected $fillable = [
        'parent_id',
        'code',
        'name',
        'type',
        'category',
        'currency',
        'company_id',
        'branch_id',
        'is_control',
        'opening_balance',
        'description',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => AccountType::class,
            'is_active' => 'boolean',
            'is_control' => 'boolean',
            'opening_balance' => 'decimal:2',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('code');
    }

    public function journalLines(): HasMany
    {
        return $this->hasMany(JournalLine::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function costAllocations(): HasMany
    {
        return $this->hasMany(CostAllocation::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOfType($query, AccountType|string $type)
    {
        return $query->where('type', $type instanceof AccountType ? $type->value : $type);
    }

    public function normalBalance(): NormalBalance
    {
        return $this->type->normalBalance();
    }

    /**
     * Balance in the account's normal direction. When the ledger sums are
     * eager loaded through withSum(), this avoids additional queries.
     */
    public function balance(): float
    {
        $debit = (float) ($this->attributes['total_debit'] ?? $this->journalLines()->sum('debit'));
        $credit = (float) ($this->attributes['total_credit'] ?? $this->journalLines()->sum('credit'));

        return round($this->normalBalance() === NormalBalance::Debit
            ? $debit - $credit
            : $credit - $debit, 2);
    }
}
