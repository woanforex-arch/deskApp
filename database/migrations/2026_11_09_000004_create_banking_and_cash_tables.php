<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('account_number', 40)->nullable();
            $table->string('bank_name')->nullable();
            $table->foreignId('gl_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->string('currency', 3)->default('USD');
            $table->decimal('opening_balance', 18, 2)->default(0);
            $table->decimal('current_balance', 18, 2)->default(0);
            $table->string('iban', 40)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('bank_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
            $table->date('statement_date');
            $table->decimal('statement_balance', 18, 2)->default(0);
            $table->decimal('book_balance', 18, 2)->default(0);
            $table->decimal('difference', 18, 2)->default(0);
            $table->string('status', 20)->default('draft')->index();
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('bank_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_account_id')->constrained()->cascadeOnDelete();
            $table->date('transaction_date')->index();
            $table->string('description');
            $table->string('reference', 60)->nullable();
            $table->string('type', 20)->default('deposit')->index();
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 18, 6)->default(1);
            $table->string('status', 20)->default('unmatched')->index();
            $table->timestamp('matched_at')->nullable();
            $table->foreignId('reconciliation_id')->nullable()->constrained('bank_reconciliations')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 20)->default('manual');
            $table->timestamps();
        });

        Schema::create('bank_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_bank_account_id')->constrained('bank_accounts')->cascadeOnDelete();
            $table->foreignId('to_bank_account_id')->constrained('bank_accounts')->cascadeOnDelete();
            $table->decimal('amount', 18, 2);
            $table->date('transfer_date');
            $table->string('reference', 60)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('journal_entry_id')->nullable();
            $table->string('status', 20)->default('completed');
            $table->timestamps();
        });

        Schema::create('cashbooks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->foreignId('gl_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->string('type', 20)->default('cash')->index();
            $table->string('currency', 3)->default('USD');
            $table->decimal('balance', 18, 2)->default(0);
            $table->string('custodian')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('cash_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashbook_id')->constrained()->cascadeOnDelete();
            $table->date('transaction_date')->index();
            $table->string('type', 20)->default('receipt')->index();
            $table->decimal('amount', 18, 2);
            $table->string('description');
            $table->string('reference', 60)->nullable();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_transactions');
        Schema::dropIfExists('cashbooks');
        Schema::dropIfExists('bank_transfers');
        Schema::dropIfExists('bank_transactions');
        Schema::dropIfExists('bank_reconciliations');
        Schema::dropIfExists('bank_accounts');
    }
};
