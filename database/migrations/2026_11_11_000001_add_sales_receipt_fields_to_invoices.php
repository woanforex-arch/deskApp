<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('ship_to')->nullable();
            $table->string('salesperson')->nullable();
            $table->string('ship_via', 100)->nullable();
            $table->date('promised_date')->nullable();
            $table->string('delivery_status', 40)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['ship_to', 'salesperson', 'ship_via', 'promised_date', 'delivery_status']);
        });
    }
};
