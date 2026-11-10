<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedSmallInteger('fiscal_year');
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('draft')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('month');
            $table->decimal('amount', 18, 2)->default(0);
            $table->timestamps();
            $table->unique(['budget_id', 'account_id', 'month']);
        });

        Schema::create('revenue_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('total_amount', 18, 2)->default(0);
            $table->decimal('recognized_amount', 18, 2)->default(0);
            $table->decimal('deferred_amount', 18, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('method', 30)->default('straight_line');
            $table->string('status', 20)->default('active')->index();
            $table->date('last_recognized_on')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('revenue_recognition_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('revenue_schedule_id')->constrained()->cascadeOnDelete();
            $table->date('recognition_date');
            $table->decimal('amount', 18, 2);
            $table->foreignId('journal_entry_id')->nullable();
            $table->timestamps();
        });

        Schema::create('recurring_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 30)->default('invoice')->index();
            $table->string('frequency', 20)->default('monthly');
            $table->unsignedInteger('interval')->default(1);
            $table->timestamp('next_run_at')->nullable()->index();
            $table->timestamp('last_run_at')->nullable();
            $table->json('template');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 30)->index();
            $table->string('provider')->nullable();
            $table->json('config')->nullable();
            $table->string('status', 20)->default('disconnected')->index();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('event', 60)->index();
            $table->string('url');
            $table->string('secret')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_triggered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('webhook_id')->constrained()->cascadeOnDelete();
            $table->string('event', 60);
            $table->json('payload')->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('scheduled_reports', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('report', 60);
            $table->string('recipients');
            $table->string('frequency', 20)->default('monthly');
            $table->timestamp('next_run_at')->nullable()->index();
            $table->timestamp('last_sent_at')->nullable();
            $table->json('filters')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('data_imports', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40);
            $table->string('file_name');
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedInteger('rows_processed')->default(0);
            $table->json('errors')->nullable();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('disk')->default('local');
            $table->string('path');
            $table->unsignedBigInteger('size')->default(0);
            $table->string('status', 20)->default('completed');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('closing_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('accounting_period_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('status', 20)->default('in_progress')->index();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('closing_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('closing_checklist_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('status', 20)->default('pending')->index();
            $table->string('owner')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('closing_tasks');
        Schema::dropIfExists('closing_checklists');
        Schema::dropIfExists('backups');
        Schema::dropIfExists('data_imports');
        Schema::dropIfExists('scheduled_reports');
        Schema::dropIfExists('webhook_deliveries');
        Schema::dropIfExists('webhooks');
        Schema::dropIfExists('integrations');
        Schema::dropIfExists('recurring_transactions');
        Schema::dropIfExists('revenue_recognition_entries');
        Schema::dropIfExists('revenue_schedules');
        Schema::dropIfExists('budget_lines');
        Schema::dropIfExists('budgets');
    }
};
