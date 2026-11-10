<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('sku', 40)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category')->nullable()->index();
            $table->string('unit', 20)->default('unit');
            $table->string('cost_method', 30)->default('weighted_average');
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('quantity_on_hand', 18, 4)->default(0);
            $table->decimal('reorder_level', 18, 4)->default(0);
            $table->foreignId('inventory_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('cogs_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->date('movement_date')->index();
            $table->string('type', 20)->default('adjustment')->index();
            $table->decimal('quantity', 18, 4);
            $table->decimal('unit_cost', 18, 4)->default(0);
            $table->decimal('total_cost', 18, 2)->default(0);
            $table->string('reference', 60)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('journal_entry_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('fixed_assets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 40)->unique();
            $table->string('category')->nullable()->index();
            $table->date('purchase_date');
            $table->decimal('cost', 18, 2)->default(0);
            $table->decimal('salvage_value', 18, 2)->default(0);
            $table->unsignedInteger('useful_life_years')->default(5);
            $table->string('depreciation_method', 30)->default('straight_line');
            $table->decimal('accumulated_depreciation', 18, 2)->default(0);
            $table->decimal('book_value', 18, 2)->default(0);
            $table->string('status', 20)->default('active')->index();
            $table->string('location')->nullable();
            $table->string('assigned_to')->nullable();
            $table->foreignId('asset_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('depreciation_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('accumulated_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->timestamp('disposed_at')->nullable();
            $table->decimal('disposal_proceeds', 18, 2)->default(0);
            $table->decimal('gain_loss', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('depreciation_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fixed_asset_id')->constrained()->cascadeOnDelete();
            $table->string('period', 7)->index();
            $table->date('depreciation_date');
            $table->decimal('amount', 18, 2);
            $table->decimal('accumulated_after', 18, 2)->default(0);
            $table->foreignId('journal_entry_id')->nullable();
            $table->timestamps();
            $table->unique(['fixed_asset_id', 'period']);
        });

        Schema::create('asset_revaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fixed_asset_id')->constrained()->cascadeOnDelete();
            $table->date('revaluation_date');
            $table->decimal('old_value', 18, 2);
            $table->decimal('new_value', 18, 2);
            $table->decimal('adjustment', 18, 2);
            $table->foreignId('journal_entry_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('cost_allocations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('source_cost_center_id')->nullable()->constrained('cost_centers')->nullOnDelete();
            $table->foreignId('target_cost_center_id')->nullable()->constrained('cost_centers')->nullOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('percentage', 8, 2)->default(100);
            $table->string('basis', 30)->default('percentage');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cost_allocations');
        Schema::dropIfExists('asset_revaluations');
        Schema::dropIfExists('depreciation_entries');
        Schema::dropIfExists('fixed_assets');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_items');
    }
};
