<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounting_settings', function (Blueprint $table) {
            // Default ledger accounts used by automated postings.
            $table->unsignedBigInteger('default_cash_account_id')->nullable()->after('id');
            $table->unsignedBigInteger('default_bank_account_id')->nullable()->after('default_cash_account_id');
            $table->unsignedBigInteger('default_sales_account_id')->nullable()->after('default_bank_account_id');
            $table->unsignedBigInteger('default_receivable_account_id')->nullable()->after('default_sales_account_id');
            $table->unsignedBigInteger('default_payable_account_id')->nullable()->after('default_receivable_account_id');
            $table->unsignedBigInteger('inventory_control_account_id')->nullable()->after('default_payable_account_id');
            $table->unsignedBigInteger('cost_of_sales_account_id')->nullable()->after('inventory_control_account_id');
            $table->unsignedBigInteger('retained_earnings_account_id')->nullable()->after('cost_of_sales_account_id');
            $table->unsignedBigInteger('opening_balance_account_id')->nullable()->after('retained_earnings_account_id');

            // Opening position captured when the books are first brought across.
            $table->string('opening_fiscal_year', 9)->nullable()->after('time_zone');
            $table->decimal('opening_cash_balance', 18, 2)->default(0)->after('opening_fiscal_year');
            $table->decimal('opening_inventory_value', 18, 2)->default(0)->after('opening_cash_balance');
            $table->decimal('outstanding_customer_balances', 18, 2)->default(0)->after('opening_inventory_value');
            $table->decimal('outstanding_supplier_balances', 18, 2)->default(0)->after('outstanding_customer_balances');
            $table->decimal('existing_assets_value', 18, 2)->default(0)->after('outstanding_supplier_balances');
            $table->decimal('existing_liabilities_value', 18, 2)->default(0)->after('existing_assets_value');
            $table->decimal('share_capital', 18, 2)->default(0)->after('existing_liabilities_value');
        });
    }

    public function down(): void
    {
        Schema::table('accounting_settings', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });
    }
};
