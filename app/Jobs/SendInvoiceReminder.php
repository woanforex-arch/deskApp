<?php

namespace App\Jobs;

use App\Models\Invoice;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SendInvoiceReminder implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @var array<int, int>
     */
    public array $backoff = [30, 120];

    public function __construct(public Invoice $invoice) {}

    public function handle(): void
    {
        Log::info('Invoice reminder sent.', [
            'invoice_id' => $this->invoice->id,
            'invoice_number' => $this->invoice->number,
            'contact' => $this->invoice->contact?->email,
            'balance_due' => $this->invoice->balanceDue(),
        ]);

        $this->invoice->forceFill(['last_reminded_at' => now()])->saveQuietly();
    }
}
