<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_settings', function (Blueprint $table) {
            $table->id();
            $table->date('fy_start_date')->nullable();
            $table->date('fy_end_date')->nullable();
            $table->string('accounting_method', 20)->default('accrual');
            $table->unsignedTinyInteger('decimal_places')->default(2);
            $table->string('date_format', 20)->default('Y-m-d');
            $table->string('time_zone', 60)->default('UTC');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_settings');
    }
};
