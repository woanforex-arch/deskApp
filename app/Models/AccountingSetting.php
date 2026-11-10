<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Singleton row holding the workspace-wide accounting settings
 * (fiscal calendar, accounting method, display formatting, default
 * ledger accounts and the opening financial position).
 */
class AccountingSetting extends Model
{
    protected $fillable = [
        'fy_start_date',
        'fy_end_date',
        'accounting_method',
        'decimal_places',
        'date_format',
        'time_zone',
        'default_cash_account_id',
        'default_bank_account_id',
        'default_sales_account_id',
        'default_receivable_account_id',
        'default_payable_account_id',
        'inventory_control_account_id',
        'cost_of_sales_account_id',
        'retained_earnings_account_id',
        'opening_balance_account_id',
        'opening_fiscal_year',
        'opening_cash_balance',
        'opening_inventory_value',
        'outstanding_customer_balances',
        'outstanding_supplier_balances',
        'existing_assets_value',
        'existing_liabilities_value',
        'share_capital',
    ];

    protected function casts(): array
    {
        return [
            'fy_start_date' => 'date',
            'fy_end_date' => 'date',
            'decimal_places' => 'integer',
            'default_cash_account_id' => 'integer',
            'default_bank_account_id' => 'integer',
            'default_sales_account_id' => 'integer',
            'default_receivable_account_id' => 'integer',
            'default_payable_account_id' => 'integer',
            'inventory_control_account_id' => 'integer',
            'cost_of_sales_account_id' => 'integer',
            'retained_earnings_account_id' => 'integer',
            'opening_balance_account_id' => 'integer',
            'opening_fiscal_year' => 'integer',
            'opening_cash_balance' => 'decimal:2',
            'opening_inventory_value' => 'decimal:2',
            'outstanding_customer_balances' => 'decimal:2',
            'outstanding_supplier_balances' => 'decimal:2',
            'existing_assets_value' => 'decimal:2',
            'existing_liabilities_value' => 'decimal:2',
            'share_capital' => 'decimal:2',
        ];
    }

    /**
     * Fetch (or lazily create) the single settings row.
     */
    public static function instance(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'accounting_method' => 'accrual',
                'decimal_places' => 2,
                'date_format' => 'Y-m-d',
                'time_zone' => 'UTC',
            ],
        );
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_cash_account_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'default_bank_account_id');
    }

    public function salesAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_sales_account_id');
    }

    public function receivableAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_receivable_account_id');
    }

    public function payableAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_payable_account_id');
    }

    public function inventoryControlAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'inventory_control_account_id');
    }

    public function costOfSalesAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'cost_of_sales_account_id');
    }

    public function retainedEarningsAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'retained_earnings_account_id');
    }

    public function openingBalanceAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'opening_balance_account_id');
    }

    /**
     * Ledger account ids currently used as a posting default. Used to stop a
     * configured account from being deleted out from under the automation.
     *
     * @return array<int, int>
     */
    public function referencedAccountIds(): array
    {
        return array_values(array_filter([
            $this->default_cash_account_id,
            $this->defaultBankAccount?->gl_account_id,
            $this->default_sales_account_id,
            $this->default_receivable_account_id,
            $this->default_payable_account_id,
            $this->inventory_control_account_id,
            $this->cost_of_sales_account_id,
            $this->retained_earnings_account_id,
            $this->opening_balance_account_id,
        ]));
    }
}
