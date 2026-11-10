<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 30)->default('accountant')->index();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->string('category', 60)->nullable()->index();
            $table->string('currency', 3)->default('USD');
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_control')->default(false);
            $table->decimal('opening_balance', 18, 2)->default(0);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('exchange_rate', 18, 6)->default(1);
            $table->decimal('base_total', 18, 2)->default(0);
            $table->string('approval_status', 20)->default('not_required')->index();
            $table->foreignId('journal_entry_id')->nullable();
            $table->text('recurring_source')->nullable();
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('inventory_item_id')->nullable();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cost_center_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('receipt_number', 40)->nullable();
            $table->foreignId('bank_account_id')->nullable();
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 18, 6)->default(1);
            $table->decimal('base_amount', 18, 2)->default(0);
            $table->decimal('realized_fx', 18, 2)->default(0);
        });

        Schema::table('journal_entries', function (Blueprint $table) {
            $table->string('source_type', 60)->nullable()->index();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cost_center_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 18, 6)->default(1);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('reversal_of_id')->nullable();
            $table->json('metadata')->nullable();
        });

        Schema::table('journal_lines', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cost_center_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('currency', 3)->default('USD');
            $table->decimal('foreign_debit', 18, 2)->default(0);
            $table->decimal('foreign_credit', 18, 2)->default(0);
            $table->decimal('exchange_rate', 18, 6)->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('journal_lines', function (Blueprint $table) {
            $table->dropColumn(['department_id', 'cost_center_id', 'project_id', 'currency', 'foreign_debit', 'foreign_credit', 'exchange_rate']);
        });

        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropColumn(['source_type', 'source_id', 'currency', 'exchange_rate', 'approved_by', 'approved_at', 'voided_at', 'reversal_of_id', 'metadata']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['receipt_number', 'bank_account_id', 'currency', 'exchange_rate', 'base_amount', 'realized_fx']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn(['inventory_item_id', 'project_id', 'cost_center_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['exchange_rate', 'base_total', 'approval_status', 'journal_entry_id', 'recurring_source']);
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['category', 'currency', 'is_control', 'opening_balance']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
