<?php

use App\Enums\InvoiceStatus;
use App\Jobs\SendInvoiceReminder;
use App\Models\Invoice;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function (): void {
    Invoice::query()
        ->where(function ($query): void {
            $query->where('status', InvoiceStatus::Overdue->value)
                ->orWhere(function ($query): void {
                    $query->where('status', InvoiceStatus::Sent->value)
                        ->whereDate('due_date', '<', today()->toDateString());
                });
        })
        ->each(fn (Invoice $invoice) => SendInvoiceReminder::dispatch($invoice));
})->dailyAt('09:00')->name('queue-overdue-invoice-reminders')->withoutOverlapping();
