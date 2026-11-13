<?php

namespace App\Services\Accounting;

use App\Enums\JournalEntryStatus;
use App\Models\Bill;
use App\Models\CreditNote;
use App\Models\JournalEntry;
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

    /**
     * Update a bill, replacing its line items and recalculating totals. A
     * posted bill is first reversed out of the ledger and returned to draft so
     * the books stay balanced; an approver can repost it in the same step.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateBill(Bill $bill, array $data, ?User $user = null): Bill
    {
        return DB::transaction(function () use ($bill, $data, $user): Bill {
            $this->unpostBill($bill, $user);

            $currency = $data['currency'] ?? $bill->currency;
            $billDate = $data['bill_date'] ?? $bill->bill_date?->toDateString();
            $rate = (float) ($data['exchange_rate'] ?? $this->currency->rate($currency, $billDate));
            $rate = $rate > 0 ? $rate : 1;

            $bill->fill([
                'contact_id' => $data['contact_id'] ?? $bill->contact_id,
                'project_id' => $data['project_id'] ?? null,
                'number' => filled($data['number'] ?? null) ? $data['number'] : $bill->number,
                'bill_date' => $billDate,
                'due_date' => $data['due_date'] ?? $bill->due_date,
                'currency' => $currency,
                'exchange_rate' => $rate,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
            ])->save();

            $bill->items()->delete();

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

            if (($data['status'] ?? null) === 'approved') {
                $this->approveBill($bill->refresh(), $user);
            }

            return $bill->refresh()->load(['contact', 'items']);
        });
    }

    /**
     * Delete a bill, reversing any vendor payments and the bill posting first
     * so the ledger stays balanced and no orphaned entries remain.
     */
    public function deleteBill(Bill $bill, ?User $user = null): void
    {
        DB::transaction(function () use ($bill, $user): void {
            foreach ($bill->payments()->get() as $payment) {
                $entry = JournalEntry::query()
                    ->where('source_type', VendorPayment::class)
                    ->where('source_id', $payment->id)
                    ->where('status', JournalEntryStatus::Posted->value)
                    ->latest('id')
                    ->first();

                if ($entry !== null) {
                    $this->posting->void($entry, $user);
                }

                $payment->delete();
            }

            $entry = $this->postedBillEntry($bill);

            if ($entry !== null) {
                $this->posting->void($entry, $user);
            }

            $bill->approvals()->delete();
            $bill->items()->delete();
            $bill->delete();
        });
    }

    /**
     * Reverse a bill's active ledger posting and return it to draft so it can
     * be changed safely.
     */
    private function unpostBill(Bill $bill, ?User $user = null): void
    {
        $entry = $this->postedBillEntry($bill);

        if ($entry !== null) {
            $this->posting->void($entry, $user);
        }

        if ($entry !== null || in_array($bill->status, ['approved', 'partial', 'paid', 'void'], true)) {
            $bill->forceFill([
                'journal_entry_id' => null,
                'status' => 'draft',
                'approved_by' => null,
                'approved_at' => null,
            ])->save();
        }
    }

    /**
     * The active (posted) journal entry for a bill, if it has one.
     */
    private function postedBillEntry(Bill $bill): ?JournalEntry
    {
        if ($bill->journal_entry_id) {
            $entry = JournalEntry::query()->find($bill->journal_entry_id);

            if ($entry !== null && $entry->status === JournalEntryStatus::Posted) {
                return $entry;
            }
        }

        return JournalEntry::query()
            ->where('source_type', Bill::class)
            ->where('source_id', $bill->id)
            ->where('status', JournalEntryStatus::Posted->value)
            ->latest('id')
            ->first();
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
        $user ??= auth()->user();

        if ($user !== null && ! $user->canApprove()) {
            throw ValidationException::withMessages([
                'amount' => 'Only approvers can record bill payments.',
            ]);
        }

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
