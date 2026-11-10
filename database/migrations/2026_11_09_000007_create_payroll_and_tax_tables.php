<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_number', 40)->unique();
            $table->string('name');
            $table->string('email')->nullable();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('position')->nullable();
            $table->date('hire_date')->nullable();
            $table->decimal('gross_salary', 18, 2)->default(0);
            $table->string('pay_frequency', 20)->default('monthly');
            $table->string('tax_number')->nullable();
            $table->string('bank_account', 60)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->string('period', 7)->unique();
            $table->date('pay_date');
            $table->string('status', 20)->default('draft')->index();
            $table->decimal('gross_total', 18, 2)->default(0);
            $table->decimal('deductions_total', 18, 2)->default(0);
            $table->decimal('net_total', 18, 2)->default(0);
            $table->foreignId('journal_entry_id')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('payroll_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->decimal('gross', 18, 2)->default(0);
            $table->decimal('income_tax', 18, 2)->default(0);
            $table->decimal('social_security', 18, 2)->default(0);
            $table->decimal('other_deductions', 18, 2)->default(0);
            $table->decimal('net', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('tax_rates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 20)->unique();
            $table->decimal('rate', 8, 4)->default(0);
            $table->string('type', 30)->default('vat')->index();
            $table->foreignId('account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tax_remittances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tax_rate_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('period', 7)->index();
            $table->date('due_date');
            $table->decimal('amount', 18, 2)->default(0);
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('remitted_at')->nullable();
            $table->string('reference', 60)->nullable();
            $table->foreignId('journal_entry_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_remittances');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('employees');
    }
};
