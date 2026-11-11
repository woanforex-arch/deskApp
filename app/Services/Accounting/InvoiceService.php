<?php

namespace App\Services\Accounting;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceService
{
    public function __construct(
        private readonly PostingService $posting,
        private readonly CurrencyService $currency,
        private readonly ApprovalService $approvals,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $status = $data['status'] ?? InvoiceStatus::Draft;
            $status = $status instanceof InvoiceStatus ? $status : InvoiceStatus::from($status);
            $currency = $data['currency'] ?? $this->currency->baseCurrency();
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $data['issue_date'] ?? null));
            $rate = $rate > 0 ? $rate : 1;

            $invoice = Invoice::create([
                'contact_id' => $data['contact_id'],
                'company_id' => $data['company_id'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'number' => $data['number'] ?? Invoice::generateNumber($data['issue_date'] ?? null),
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'],
                'ship_to' => $data['ship_to'] ?? null,
                'salesperson' => $data['salesperson'] ?? null,
                'ship_via' => $data['ship_via'] ?? null,
                'promised_date' => $data['promised_date'] ?? null,
                'delivery_status' => $data['delivery_status'] ?? null,
                'sales_type' => $data['sales_type'] ?? null,
                'status' => $status,
                'currency' => $currency,
                'exchange_rate' => $rate,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
                'sent_at' => $status === InvoiceStatus::Sent || $status === InvoiceStatus::Overdue ? now() : null,
            ]);

            foreach ($data['items'] as $item) {
                $invoice->items()->create([
                    'account_id' => $item['account_id'] ?? null,
                    'inventory_item_id' => $item['inventory_item_id'] ?? null,
                    'project_id' => $item['project_id'] ?? null,
                    'cost_center_id' => $item['cost_center_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'tax_rate' => $item['tax_rate'] ?? 0,
                ]);
            }

            $invoice->recalculateTotals();

            if ($status === InvoiceStatus::Draft) {
                $this->approvals->submit('invoice', $invoice->refresh());
            }

            if (! in_array($status, [InvoiceStatus::Draft, InvoiceStatus::Void], true)) {
                $this->posting->postInvoice($invoice->refresh());
                $invoice->refresh();
            }

            return $invoice->load(['contact', 'items.account']);
        });
    }

    public function markAsSent(Invoice $invoice, ?User $user = null): Invoice
    {
        return DB::transaction(function () use ($invoice, $user): Invoice {
            $invoice->markAsSent();
            $invoice->refresh();

            if ($invoice->total > 0) {
                $this->posting->postInvoice($invoice, $user);
            }

            return $invoice->refresh()->load(['contact', 'items.account', 'payments']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function recordPayment(Invoice $invoice, array $data): Payment
    {
        if (! $invoice->status->isPayable()) {
            throw ValidationException::withMessages([
                'amount' => 'Payments can only be recorded against sent or overdue invoices.',
            ]);
        }

        $balance = $invoice->balanceDue();

        if ((float) $data['amount'] > $balance + 0.005) {
            throw ValidationException::withMessages([
                'amount' => 'The payment amount may not exceed the outstanding balance of '.number_format($balance, 2).'.',
            ]);
        }

        return DB::transaction(function () use ($data, $invoice): Payment {
            $currency = $data['currency'] ?? $invoice->currency;
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $data['paid_on']));
            $rate = $rate > 0 ? $rate : 1;

            $payment = $invoice->payments()->create([
                'contact_id' => $invoice->contact_id,
                'paid_on' => $data['paid_on'],
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'receipt_number' => $data['receipt_number'] ?? null,
                'bank_account_id' => $data['bank_account_id'] ?? null,
                'currency' => $currency,
                'exchange_rate' => $rate,
                'notes' => $data['notes'] ?? null,
            ]);

            $invoice->refresh();

            $this->posting->postPayment($payment->refresh(), $data['user'] ?? null);

            return $payment->refresh()->load('invoice.contact');
        });
    }
}
