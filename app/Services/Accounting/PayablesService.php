<?php

namespace App\Services\Accounting;

use App\Models\Bill;
use App\Models\CreditNote;
use App\Models\User;
use App\Models\VendorPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayablesService
{
    public function __construct(
        private readonly PostingService $posting,
        private readonly CurrencyService $currency,
        private readonly ApprovalService $approvals,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function createBill(array $data, ?User $user = null): Bill
    {
        return DB::transaction(function () use ($data, $user): Bill {
            $currency = $data['currency'] ?? $this->currency->baseCurrency();
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $data['bill_date'] ?? null));
            $rate = $rate > 0 ? $rate : 1;

            $bill = Bill::create([
                'contact_id' => $data['contact_id'],
                'company_id' => $data['company_id'] ?? null,
                'branch_id' => $data['branch_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'number' => $data['number'] ?? Bill::generateNumber($data['bill_date'] ?? null),
                'bill_date' => $data['bill_date'],
                'due_date' => $data['due_date'],
                'status' => $data['status'] ?? 'draft',
                'currency' => $currency,
                'exchange_rate' => $rate,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
                'created_by' => $user?->id ?? auth()->id(),
            ]);

            foreach ($data['items'] as $item) {
                $bill->items()->create([
                    'account_id' => $item['account_id'] ?? null,
                    'inventory_item_id' => $item['inventory_item_id'] ?? null,
                    'project_id' => $item['project_id'] ?? null,
                    'cost_center_id' => $item['cost_center_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'] ?? 1,
                    'unit_price' => $item['unit_price'] ?? 0,
                    'tax_rate' => $item['tax_rate'] ?? 0,
                ]);
            }

            $bill->recalculateTotals();

            if (($data['status'] ?? 'draft') === 'draft') {
                $this->approvals->submit('bill', $bill->refresh(), $user);
            }

            if (($data['status'] ?? null) === 'approved') {
                $this->approveBill($bill, $user);
            }

            return $bill->refresh()->load(['contact', 'items']);
        });
    }

    public function approveBill(Bill $bill, ?User $user = null): Bill
    {
        if ($bill->status === 'paid') {
            throw ValidationException::withMessages([
                'status' => 'A paid bill cannot be approved again.',
            ]);
        }

        $bill->forceFill([
            'status' => 'approved',
            'approved_by' => $user?->id ?? auth()->id(),
            'approved_at' => now(),
        ])->save();

        $this->posting->postBill($bill->refresh(), $user);

        return $bill->refresh()->load(['contact', 'items']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function recordPayment(Bill $bill, array $data, ?User $user = null): VendorPayment
    {
        $balance = $bill->balanceDue();

        if ((float) $data['amount'] > $balance + 0.005) {
            throw ValidationException::withMessages([
                'amount' => 'The payment amount may not exceed the outstanding balance of '.number_format($balance, 2).'.',
            ]);
        }

        return DB::transaction(function () use ($bill, $data, $user): VendorPayment {
            $currency = $data['currency'] ?? $bill->currency;
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $data['paid_on'] ?? null));
            $rate = $rate > 0 ? $rate : 1;

            $payment = $bill->payments()->create([
                'contact_id' => $bill->contact_id,
                'paid_on' => $data['paid_on'],
                'amount' => $data['amount'],
                'method' => $data['method'] ?? 'bank_transfer',
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'bank_account_id' => $data['bank_account_id'] ?? null,
                'currency' => $currency,
                'exchange_rate' => $rate,
                'created_by' => $user?->id ?? auth()->id(),
            ]);

            $this->posting->postVendorPayment($payment->refresh(), $user);

            return $payment->refresh()->load(['contact', 'bill']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createCreditNote(array $data, ?User $user = null): CreditNote
    {
        return DB::transaction(function () use ($data, $user): CreditNote {
            $type = $data['type'] ?? 'sales';
            $currency = $data['currency'] ?? $this->currency->baseCurrency();
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $data['issue_date'] ?? null));
            $rate = $rate > 0 ? $rate : 1;

            $note = CreditNote::create([
                'invoice_id' => $data['invoice_id'] ?? null,
                'bill_id' => $data['bill_id'] ?? null,
                'contact_id' => $data['contact_id'],
                'number' => $data['number'] ?? CreditNote::generateNumber($type, $data['issue_date'] ?? null),
                'issue_date' => $data['issue_date'],
                'type' => $type,
                'reason' => $data['reason'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'currency' => $currency,
                'exchange_rate' => $rate,
                'created_by' => $user?->id ?? auth()->id(),
            ]);

            foreach ($data['items'] as $item) {
                $note->items()->create([
                    'account_id' => $item['account_id'] ?? null,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'] ?? 1,
                    'unit_price' => $item['unit_price'] ?? 0,
                    'tax_rate' => $item['tax_rate'] ?? 0,
                ]);
            }

            $note->recalculateTotals();

            if (($data['status'] ?? null) === 'posted') {
                $this->postCreditNote($note, $user);
            }

            return $note->refresh()->load(['contact', 'items']);
        });
    }

    public function postCreditNote(CreditNote $note, ?User $user = null): CreditNote
    {
        $this->posting->postCreditNote($note->refresh(), $user);

        return $note->refresh();
    }
}
