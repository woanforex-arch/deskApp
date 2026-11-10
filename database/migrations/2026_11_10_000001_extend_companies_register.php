<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('business_type', 60)->nullable()->after('base_currency');
            $table->string('trading_name', 150)->nullable()->after('name');
            $table->string('business_email')->nullable();
            $table->string('website')->nullable();
            $table->text('postal_address')->nullable();
            $table->text('physical_address')->nullable();
            $table->string('logo_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn([
                'business_type',
                'trading_name',
                'business_email',
                'website',
                'postal_address',
                'physical_address',
                'logo_path',
            ]);
        });
    }
};
