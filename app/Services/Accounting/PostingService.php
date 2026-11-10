<?php

namespace App\Services\Accounting;

use App\Enums\AccountType;
use App\Enums\JournalEntryStatus;
use App\Models\Account;
use App\Models\Bill;
use App\Models\CashTransaction;
use App\Models\CostAllocation;
use App\Models\CreditNote;
use App\Models\FixedAsset;
use App\Models\InventoryItem;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\RevenueSchedule;
use App\Models\TaxRemittance;
use App\Models\BankTransfer;
use App\Models\User;
use App\Models\VendorPayment;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PostingService
{
    private const DEFAULTS = [
        '1100' => ['Cash and Cash Equivalents', AccountType::Asset],
        '1110' => ['Operating Bank Account', AccountType::Asset],
        '1120' => ['Petty Cash', AccountType::Asset],
        '1200' => ['Accounts Receivable', AccountType::Asset],
        '1300' => ['Inventory', AccountType::Asset],
        '1500' => ['Fixed Assets', AccountType::Asset],
        '1510' => ['Accumulated Depreciation', AccountType::Asset],
        '1600' => ['Input VAT Recoverable', AccountType::Asset],
        '2100' => ['Accounts Payable', AccountType::Liability],
        '2200' => ['VAT and Tax Payable', AccountType::Liability],
        '2300' => ['Payroll Payable', AccountType::Liability],
        '2400' => ['Deferred Revenue', AccountType::Liability],
        '3100' => ["Owner's Equity", AccountType::Equity],
        '3200' => ['Retained Earnings', AccountType::Equity],
        '4100' => ['Consulting Revenue', AccountType::Revenue],
        '4200' => ['Product Sales', AccountType::Revenue],
        '4300' => ['Service Revenue', AccountType::Revenue],
        '5100' => ['Cost of Goods Sold', AccountType::Expense],
        '5200' => ['Salaries and Wages', AccountType::Expense],
        '5300' => ['Rent', AccountType::Expense],
        '5400' => ['Utilities', AccountType::Expense],
        '5500' => ['Software Subscriptions', AccountType::Expense],
        '5600' => ['Marketing', AccountType::Expense],
        '5700' => ['Depreciation Expense', AccountType::Expense],
        '5800' => ['Foreign Exchange Loss', AccountType::Expense],
        '5900' => ['Foreign Exchange Gain', AccountType::Revenue],
        '6100' => ['Inventory Adjustments', AccountType::Expense],
    ];

    public function __construct(
        private readonly PeriodService $periods,
        private readonly CurrencyService $currency,
        private readonly InventoryService $inventory,
        private readonly WebhookService $webhooks,
        private readonly AuditService $audit,
    ) {}

    public function resolveAccount(string $code): Account
    {
        [$name, $type] = self::DEFAULTS[$code] ?? ['Account '.$code, AccountType::Expense];

        return Account::firstOrCreate(
            ['code' => $code],
            ['name' => $name, 'type' => $type, 'is_active' => true],
        );
    }

    /**
     * Post a balanced journal entry.
     *
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function post(array $attributes, array $lines, ?User $user = null): JournalEntry
    {
        $date = $attributes['entry_date'] ?? today()->toDateString();
        $this->periods->assertOpen($date);

        $normalised = collect($lines)
            ->map(fn (array $line) => $this->normaliseLine($line, $attributes))
            ->filter(fn (array $line) => abs($line['debit']) > 0.0001 || abs($line['credit']) > 0.0001)
            ->values()
            ->all();

        $debit = round(array_sum(array_column($normalised, 'debit')), 2);
        $credit = round(array_sum(array_column($normalised, 'credit')), 2);

        if (count($normalised) < 2 || $debit <= 0 || abs($debit - $credit) > 0.005) {
            throw ValidationException::withMessages([
                'lines' => 'Automated postings must contain at least two lines with equal debits and credits.',
            ]);
        }

        return DB::transaction(function () use ($attributes, $normalised, $debit, $credit, $user): JournalEntry {
            $entry = JournalEntry::create([
                'reference' => $attributes['reference'] ?? JournalEntry::generateReference($attributes['entry_date'] ?? null),
                'entry_date' => $attributes['entry_date'] ?? today()->toDateString(),
                'memo' => $attributes['memo'],
                'status' => JournalEntryStatus::Posted,
                'posted_at' => now(),
                'created_by' => $user?->id ?? auth()->id(),
                'source_type' => $attributes['source_type'] ?? null,
                'source_id' => $attributes['source_id'] ?? null,
                'company_id' => $attributes['company_id'] ?? null,
                'branch_id' => $attributes['branch_id'] ?? null,
                'department_id' => $attributes['department_id'] ?? null,
                'cost_center_id' => $attributes['cost_center_id'] ?? null,
                'project_id' => $attributes['project_id'] ?? null,
                'currency' => $attributes['currency'] ?? $this->currency->baseCurrency(),
                'exchange_rate' => $attributes['exchange_rate'] ?? 1,
                'approved_by' => $user?->id ?? auth()->id(),
                'approved_at' => now(),
                'metadata' => $attributes['metadata'] ?? null,
            ]);

            foreach ($normalised as $line) {
                $entry->lines()->create($line);
            }

            $this->audit->log('posted', $entry, [], ['reference' => $entry->reference], "Posted journal {$entry->reference}");
            $this->webhooks->dispatchEvent('journal.posted', [
                'reference' => $entry->reference,
                'entry_date' => $entry->entry_date?->toDateString(),
                'memo' => $entry->memo,
                'total_debit' => $debit,
                'total_credit' => $credit,
            ]);

            return $entry->load('lines.account');
        });
    }

    /**
     * @param  array<string, mixed>  $line
     * @param  array<string, mixed>  $headers
     * @return array<string, mixed>
     */
    private function normaliseLine(array $line, array $headers): array
    {
        $account = isset($line['account_id'])
            ? Account::find($line['account_id'])
            : $this->resolveAccount((string) ($line['account_code'] ?? '5100'));

        $currency = $headers['currency'] ?? $this->currency->baseCurrency();
        $rate = (float) ($headers['exchange_rate'] ?? 1) ?: 1;
        $debit = round((float) ($line['debit'] ?? 0), 2);
        $credit = round((float) ($line['credit'] ?? 0), 2);

        return [
            'account_id' => $account?->id,
            'description' => $line['description'] ?? ($headers['memo'] ?? null),
            'debit' => $debit,
            'credit' => $credit,
            'department_id' => $line['department_id'] ?? ($headers['department_id'] ?? null),
            'cost_center_id' => $line['cost_center_id'] ?? ($headers['cost_center_id'] ?? null),
            'project_id' => $line['project_id'] ?? ($headers['project_id'] ?? null),
            'currency' => $currency,
            'foreign_debit' => round((float) ($line['foreign_debit'] ?? ($currency === $this->currency->baseCurrency() ? $debit : $debit / $rate)), 2),
            'foreign_credit' => round((float) ($line['foreign_credit'] ?? ($currency === $this->currency->baseCurrency() ? $credit : $credit / $rate)), 2),
            'exchange_rate' => $rate,
        ];
    }

    public function entryExists(string $type, int $id): bool
    {
        return JournalEntry::query()
            ->where('source_type', $type)
            ->where('source_id', $id)
            ->where('status', JournalEntryStatus::Posted->value)
            ->exists();
    }

    public function postInvoice(Invoice $invoice, ?User $user = null): ?JournalEntry
    {
        if ($invoice->total <= 0 || $invoice->journal_entry_id || $this->entryExists(Invoice::class, $invoice->id)) {
            return null;
        }

        $invoice->loadMissing(['items.inventoryItem', 'contact']);
        $rate = (float) ($invoice->exchange_rate ?: $this->currency->rate($invoice->currency, $invoice->issue_date));
        $rate = $rate > 0 ? $rate : 1;
        $base = fn (float $value): float => round($value * $rate, 2);

        $lines = [[
            'account_code' => '1200',
            'description' => 'Accounts receivable — '.$invoice->number,
            'debit' => $base((float) $invoice->total),
            'foreign_debit' => (float) $invoice->total,
        ]];

        $revenueTotal = 0.0;
        foreach ($invoice->items as $item) {
            $accountId = $item->account_id ?? $this->resolveAccount('4100')->id;
            $amount = $base((float) $item->amount);
            $revenueTotal += $amount;
            $lines[] = [
                'account_id' => $accountId,
                'description' => $item->description,
                'credit' => $amount,
                'foreign_credit' => (float) $item->amount,
            ];
        }

        $tax = $base((float) $invoice->tax_total);
        if ($tax > 0) {
            $lines[] = [
                'account_code' => '2200',
                'description' => 'Tax on '.$invoice->number,
                'credit' => $tax,
                'foreign_credit' => (float) $invoice->tax_total,
            ];
        }

        // Rounding adjustment so debits and credits agree exactly.
        $expectedRevenue = $base((float) $invoice->subtotal);
        $difference = round($expectedRevenue - $revenueTotal, 2);
        if (abs($difference) > 0.004 && isset($lines[1])) {
            $lines[1]['credit'] = round($lines[1]['credit'] + $difference, 2);
        }

        foreach ($invoice->items as $item) {
            if (! $item->inventory_item_id || ! $item->inventoryItem) {
                continue;
            }
            $cost = round((float) $item->inventoryItem->unit_cost * (float) $item->quantity, 2);
            if ($cost <= 0) {
                continue;
            }
            $lines[] = ['account_code' => '5100', 'description' => 'COGS — '.$item->description, 'debit' => $cost];
            $lines[] = ['account_code' => '1300', 'description' => 'Inventory issued — '.$item->description, 'credit' => $cost];
        }

        $entry = $this->post([
            'entry_date' => $invoice->issue_date?->toDateString() ?? today()->toDateString(),
            'memo' => 'Invoice '.$invoice->number.' — '.($invoice->contact?->name ?? 'Customer'),
            'source_type' => Invoice::class,
            'source_id' => $invoice->id,
            'company_id' => $invoice->company_id,
            'branch_id' => $invoice->branch_id,
            'project_id' => $invoice->project_id,
            'currency' => $invoice->currency,
            'exchange_rate' => $rate,
        ], $lines, $user);

        $invoice->forceFill([
            'journal_entry_id' => $entry->id,
            'base_total' => $base((float) $invoice->total),
            'exchange_rate' => $rate,
        ])->saveQuietly();

        foreach ($invoice->items as $item) {
            if ($item->inventory_item_id && $item->inventoryItem) {
                $this->inventory->issue($item->inventoryItem, (float) $item->quantity, [
                    'movement_date' => $invoice->issue_date?->toDateString(),
                    'reference' => $invoice->number,
                    'journal_entry_id' => $entry->id,
                    'created_by' => $user?->id,
                ]);
            }
        }

        $this->webhooks->dispatchEvent('invoice.posted', [
            'invoice' => $invoice->number,
            'total' => (float) $invoice->total,
            'currency' => $invoice->currency,
        ]);

        return $entry;
    }

    public function postPayment(Payment $payment, ?User $user = null): ?JournalEntry
    {
        if ($this->entryExists(Payment::class, $payment->id)) {
            return null;
        }

        $payment->loadMissing(['invoice', 'bankAccount.glAccount']);
        $invoice = $payment->invoice;
        $rate = (float) ($payment->exchange_rate ?: $this->currency->rate($payment->currency ?: $invoice?->currency ?? 'USD', $payment->paid_on));
        $rate = $rate > 0 ? $rate : 1;
        $bankCode = '1100';
        $bankAccount = $payment->bankAccount;
        if ($bankAccount?->glAccount) {
            $bankCode = $bankAccount->glAccount->code;
        }

        $paymentBase = round((float) $payment->amount * $rate, 2);
        $invoiceRate = (float) ($invoice?->exchange_rate ?: 1);
        $invoiceBase = round((float) $payment->amount * $invoiceRate, 2);
        $fx = round($paymentBase - $invoiceBase, 2);

        $lines = [
            ['account_code' => $bankCode, 'description' => 'Receipt — '.($invoice?->number ?? $payment->reference), 'debit' => $paymentBase, 'foreign_debit' => (float) $payment->amount],
            ['account_code' => '1200', 'description' => 'Accounts receivable settled', 'credit' => $invoiceBase, 'foreign_credit' => (float) $payment->amount],
        ];

        if (abs($fx) > 0.004) {
            if ($fx > 0) {
                $lines[] = ['account_code' => '5900', 'description' => 'Realised foreign exchange gain', 'credit' => abs($fx)];
            } else {
                $lines[] = ['account_code' => '5800', 'description' => 'Realised foreign exchange loss', 'debit' => abs($fx)];
            }
        }

        $entry = $this->post([
            'entry_date' => $payment->paid_on?->toDateString() ?? today()->toDateString(),
            'memo' => 'Receipt '.($payment->receipt_number ?? $payment->reference ?? '').' for '.($invoice?->number ?? 'customer'),
            'source_type' => Payment::class,
            'source_id' => $payment->id,
            'branch_id' => $invoice?->branch_id,
            'project_id' => $invoice?->project_id,
            'currency' => $payment->currency ?: ($invoice?->currency ?? $this->currency->baseCurrency()),
            'exchange_rate' => $rate,
        ], $lines, $user);

        $payment->forceFill([
            'base_amount' => $paymentBase,
            'exchange_rate' => $rate,
            'realized_fx' => $fx,
        ])->saveQuietly();

        $this->webhooks->dispatchEvent('payment.posted', [
            'receipt' => $payment->receipt_number ?? $payment->reference,
            'amount' => (float) $payment->amount,
            'invoice' => $invoice?->number,
        ]);

        return $entry;
    }

    public function postBill(Bill $bill, ?User $user = null): ?JournalEntry
    {
        if ($bill->total <= 0 || $bill->journal_entry_id || $this->entryExists(Bill::class, $bill->id)) {
            return null;
        }

        $bill->loadMissing(['items.inventoryItem', 'contact']);
        $rate = (float) ($bill->exchange_rate ?: $this->currency->rate($bill->currency, $bill->bill_date));
        $rate = $rate > 0 ? $rate : 1;
        $base = fn (float $value): float => round($value * $rate, 2);

        $lines = [];
        foreach ($bill->items as $item) {
            $code = $item->inventory_item_id ? '1300' : null;
            $lines[] = [
                'account_id' => $code ? $this->resolveAccount($code)->id : ($item->account_id ?? $this->resolveAccount('5100')->id),
                'description' => $item->description,
                'debit' => $base((float) $item->amount),
                'foreign_debit' => (float) $item->amount,
                'project_id' => $item->project_id,
                'cost_center_id' => $item->cost_center_id,
            ];
        }

        $tax = $base((float) $bill->tax_total);
        if ($tax > 0) {
            $lines[] = ['account_code' => '1600', 'description' => 'Input VAT — '.$bill->number, 'debit' => $tax, 'foreign_debit' => (float) $bill->tax_total];
        }

        $lines[] = [
            'account_code' => '2100',
            'description' => 'Accounts payable — '.$bill->number,
            'credit' => $base((float) $bill->total),
            'foreign_credit' => (float) $bill->total,
        ];

        $entry = $this->post([
            'entry_date' => $bill->bill_date?->toDateString() ?? today()->toDateString(),
            'memo' => 'Bill '.$bill->number.' — '.($bill->contact?->name ?? 'Vendor'),
            'source_type' => Bill::class,
            'source_id' => $bill->id,
            'company_id' => $bill->company_id,
            'branch_id' => $bill->branch_id,
            'project_id' => $bill->project_id,
            'currency' => $bill->currency,
            'exchange_rate' => $rate,
        ], $lines, $user);

        $bill->forceFill([
            'journal_entry_id' => $entry->id,
            'exchange_rate' => $rate,
            'status' => 'approved',
            'approved_by' => $user?->id ?? auth()->id(),
            'approved_at' => now(),
        ])->saveQuietly();

        foreach ($bill->items as $item) {
            if ($item->inventory_item_id && $item->inventoryItem) {
                $quantity = (float) $item->quantity;
                $unitCost = $quantity > 0 ? round((float) $item->amount / $quantity, 4) : (float) $item->unit_price;
                $this->inventory->receive($item->inventoryItem, $quantity, $unitCost, [
                    'movement_date' => $bill->bill_date?->toDateString(),
                    'reference' => $bill->number,
                    'journal_entry_id' => $entry->id,
                    'created_by' => $user?->id,
                ]);
            }
        }

        $this->webhooks->dispatchEvent('bill.posted', [
            'bill' => $bill->number,
            'total' => (float) $bill->total,
            'currency' => $bill->currency,
        ]);

        return $entry;
    }

    public function postVendorPayment(VendorPayment $payment, ?User $user = null): ?JournalEntry
    {
        if ($this->entryExists(VendorPayment::class, $payment->id)) {
            return null;
        }

        $payment->loadMissing('bill');
        $bill = $payment->bill;
        $rate = (float) ($payment->exchange_rate ?: $this->currency->rate($payment->currency ?: 'USD', $payment->paid_on));
        $rate = $rate > 0 ? $rate : 1;
        $billRate = (float) ($bill?->exchange_rate ?: 1);
        $paymentBase = round((float) $payment->amount * $rate, 2);
        $billBase = round((float) $payment->amount * $billRate, 2);
        $fx = round($paymentBase - $billBase, 2);

        $lines = [
            ['account_code' => '2100', 'description' => 'Accounts payable settled', 'debit' => $billBase, 'foreign_debit' => (float) $payment->amount],
            ['account_code' => '1100', 'description' => 'Vendor payment — '.($bill?->number ?? $payment->reference), 'credit' => $paymentBase, 'foreign_credit' => (float) $payment->amount],
        ];

        if (abs($fx) > 0.004) {
            if ($fx > 0) {
                $lines[] = ['account_code' => '5800', 'description' => 'Realised foreign exchange loss', 'debit' => abs($fx)];
            } else {
                $lines[] = ['account_code' => '5900', 'description' => 'Realised foreign exchange gain', 'credit' => abs($fx)];
            }
        }

        $entry = $this->post([
            'entry_date' => $payment->paid_on?->toDateString() ?? today()->toDateString(),
            'memo' => 'Vendor payment for '.($bill?->number ?? $payment->reference),
            'source_type' => VendorPayment::class,
            'source_id' => $payment->id,
            'branch_id' => $bill?->branch_id,
            'currency' => $payment->currency ?: ($bill?->currency ?? $this->currency->baseCurrency()),
            'exchange_rate' => $rate,
        ], $lines, $user);

        $this->webhooks->dispatchEvent('vendor-payment.posted', [
            'amount' => (float) $payment->amount,
            'bill' => $bill?->number,
        ]);

        return $entry;
    }

    public function postCreditNote(CreditNote $note, ?User $user = null): ?JournalEntry
    {
        if ($note->total <= 0 || $note->journal_entry_id || $this->entryExists(CreditNote::class, $note->id)) {
            return null;
        }

        $note->loadMissing('items');
        $rate = (float) ($note->exchange_rate ?: $this->currency->rate($note->currency, $note->issue_date));
        $rate = $rate > 0 ? $rate : 1;
        $base = fn (float $value): float => round($value * $rate, 2);

        $lines = [];
        if ($note->type === 'purchase') {
            $lines[] = ['account_code' => '2100', 'description' => 'AP credit — '.$note->number, 'debit' => $base((float) $note->total), 'foreign_debit' => (float) $note->total];
            foreach ($note->items as $item) {
                $lines[] = ['account_id' => $item->account_id ?? $this->resolveAccount('5100')->id, 'description' => $item->description, 'credit' => $base((float) $item->amount), 'foreign_credit' => (float) $item->amount];
            }
            if ((float) $note->tax_total > 0) {
                $lines[] = ['account_code' => '1600', 'description' => 'Input VAT reversed', 'credit' => $base((float) $note->tax_total), 'foreign_credit' => (float) $note->tax_total];
            }
        } else {
            foreach ($note->items as $item) {
                $lines[] = ['account_id' => $item->account_id ?? $this->resolveAccount('4100')->id, 'description' => $item->description, 'debit' => $base((float) $item->amount), 'foreign_debit' => (float) $item->amount];
            }
            if ((float) $note->tax_total > 0) {
                $lines[] = ['account_code' => '2200', 'description' => 'Output VAT reversed', 'debit' => $base((float) $note->tax_total), 'foreign_debit' => (float) $note->tax_total];
            }
            $lines[] = ['account_code' => '1200', 'description' => 'AR credit — '.$note->number, 'credit' => $base((float) $note->total), 'foreign_credit' => (float) $note->total];
        }

        $entry = $this->post([
            'entry_date' => $note->issue_date?->toDateString() ?? today()->toDateString(),
            'memo' => ucfirst($note->type).' credit note '.$note->number,
            'source_type' => CreditNote::class,
            'source_id' => $note->id,
            'currency' => $note->currency,
            'exchange_rate' => $rate,
        ], $lines, $user);

        $note->forceFill(['journal_entry_id' => $entry->id, 'status' => 'posted'])->saveQuietly();

        return $entry;
    }

    public function postPayroll(PayrollRun $run, ?User $user = null): ?JournalEntry
    {
        if ($run->gross_total <= 0 || $run->journal_entry_id || $this->entryExists(PayrollRun::class, $run->id)) {
            return null;
        }

        $lines = [
            ['account_code' => '5200', 'description' => 'Gross payroll — '.$run->period, 'debit' => (float) $run->gross_total],
            ['account_code' => '2300', 'description' => 'Net payroll payable', 'credit' => (float) $run->net_total],
        ];

        $deductions = round((float) $run->gross_total - (float) $run->net_total, 2);
        if ($deductions > 0) {
            $lines[] = ['account_code' => '2200', 'description' => 'Payroll statutory deductions', 'credit' => $deductions];
        }

        $entry = $this->post([
            'entry_date' => $run->pay_date?->toDateString() ?? today()->toDateString(),
            'memo' => 'Payroll run '.$run->period,
            'source_type' => PayrollRun::class,
            'source_id' => $run->id,
        ], $lines, $user);

        $run->forceFill([
            'journal_entry_id' => $entry->id,
            'status' => 'posted',
            'approved_by' => $user?->id ?? auth()->id(),
            'approved_at' => now(),
        ])->saveQuietly();

        return $entry;
    }

    public function postDepreciation(FixedAsset $asset, float $amount, string $date, string $period, ?User $user = null): ?JournalEntry
    {
        if ($amount <= 0) {
            return null;
        }

        $entry = $this->post([
            'entry_date' => $date,
            'memo' => 'Depreciation '.$period.' — '.$asset->name,
            'source_type' => FixedAsset::class,
            'source_id' => $asset->id,
            'metadata' => ['period' => $period, 'type' => 'depreciation'],
        ], [
            ['account_code' => '5700', 'description' => 'Depreciation expense — '.$asset->name, 'debit' => $amount],
            ['account_code' => '1510', 'description' => 'Accumulated depreciation — '.$asset->name, 'credit' => $amount],
        ], $user);

        $accumulated = round((float) $asset->accumulated_depreciation + $amount, 2);
        $asset->forceFill([
            'accumulated_depreciation' => $accumulated,
            'book_value' => round((float) $asset->cost - $accumulated, 2),
        ])->saveQuietly();

        $asset->depreciationEntries()->create([
            'period' => $period,
            'depreciation_date' => $date,
            'amount' => $amount,
            'accumulated_after' => $accumulated,
            'journal_entry_id' => $entry->id,
        ]);

        return $entry;
    }

    public function postInventoryAdjustment(InventoryItem $item, float $value, string $date, string $memo, ?User $user = null): ?JournalEntry
    {
        if (abs($value) < 0.005) {
            return null;
        }

        $lines = $value > 0
            ? [
                ['account_code' => '1300', 'description' => $memo, 'debit' => abs($value)],
                ['account_code' => '6100', 'description' => $memo, 'credit' => abs($value)],
            ]
            : [
                ['account_code' => '6100', 'description' => $memo, 'debit' => abs($value)],
                ['account_code' => '1300', 'description' => $memo, 'credit' => abs($value)],
            ];

        return $this->post([
            'entry_date' => $date,
            'memo' => $memo,
            'source_type' => InventoryItem::class,
            'source_id' => $item->id,
        ], $lines, $user);
    }

    public function postBankTransfer(BankTransfer $transfer, ?User $user = null): ?JournalEntry
    {
        if ($this->entryExists(BankTransfer::class, $transfer->id)) {
            return null;
        }

        $transfer->loadMissing(['fromAccount.glAccount', 'toAccount.glAccount']);
        $fromCode = $transfer->fromAccount?->glAccount?->code ?? '1100';
        $toCode = $transfer->toAccount?->glAccount?->code ?? '1110';

        $entry = $this->post([
            'entry_date' => $transfer->transfer_date?->toDateString() ?? today()->toDateString(),
            'memo' => 'Bank transfer '.($transfer->reference ?? ''),
            'source_type' => BankTransfer::class,
            'source_id' => $transfer->id,
        ], [
            ['account_code' => $toCode, 'description' => 'Transfer in', 'debit' => (float) $transfer->amount],
            ['account_code' => $fromCode, 'description' => 'Transfer out', 'credit' => (float) $transfer->amount],
        ], $user);

        $transfer->forceFill(['journal_entry_id' => $entry->id])->saveQuietly();

        return $entry;
    }

    public function postCashTransaction(CashTransaction $transaction, ?User $user = null): ?JournalEntry
    {
        if ($this->entryExists(CashTransaction::class, $transaction->id)) {
            return null;
        }

        $transaction->loadMissing('cashbook.glAccount');
        $cashCode = $transaction->cashbook?->glAccount?->code ?? '1120';
        $isPayment = in_array($transaction->type, ['payment', 'transfer_out'], true);
        $counterCode = $isPayment ? '5100' : '4100';

        $lines = $isPayment
            ? [
                ['account_code' => $counterCode, 'description' => $transaction->description, 'debit' => (float) $transaction->amount],
                ['account_code' => $cashCode, 'description' => $transaction->description, 'credit' => (float) $transaction->amount],
            ]
            : [
                ['account_code' => $cashCode, 'description' => $transaction->description, 'debit' => (float) $transaction->amount],
                ['account_code' => $counterCode, 'description' => $transaction->description, 'credit' => (float) $transaction->amount],
            ];

        $entry = $this->post([
            'entry_date' => $transaction->transaction_date?->toDateString() ?? today()->toDateString(),
            'memo' => $transaction->description,
            'source_type' => CashTransaction::class,
            'source_id' => $transaction->id,
        ], $lines, $user);

        $transaction->forceFill(['journal_entry_id' => $entry->id])->saveQuietly();
        $cashbook = $transaction->cashbook;
        if ($cashbook) {
            $cashbook->forceFill([
                'balance' => round((float) $cashbook->balance + $transaction->signedAmount(), 2),
            ])->saveQuietly();
        }

        return $entry;
    }

    public function postTaxRemittance(TaxRemittance $remittance, ?User $user = null): ?JournalEntry
    {
        if ($this->entryExists(TaxRemittance::class, $remittance->id)) {
            return null;
        }

        $entry = $this->post([
            'entry_date' => $remittance->due_date?->toDateString() ?? today()->toDateString(),
            'memo' => 'Tax remittance '.$remittance->name.' '.$remittance->period,
            'source_type' => TaxRemittance::class,
            'source_id' => $remittance->id,
        ], [
            ['account_code' => '2200', 'description' => 'Tax payable settled', 'debit' => (float) $remittance->amount],
            ['account_code' => '1100', 'description' => 'Tax remitted', 'credit' => (float) $remittance->amount],
        ], $user);

        $remittance->forceFill([
            'journal_entry_id' => $entry->id,
            'status' => 'remitted',
            'remitted_at' => now(),
        ])->saveQuietly();

        return $entry;
    }

    public function postRevenueRecognition(RevenueSchedule $schedule, float $amount, string $date, ?User $user = null): ?JournalEntry
    {
        if ($amount <= 0) {
            return null;
        }

        $entry = $this->post([
            'entry_date' => $date,
            'memo' => 'Revenue recognition — '.$schedule->name,
            'source_type' => RevenueSchedule::class,
            'source_id' => $schedule->id,
        ], [
            ['account_code' => '2400', 'description' => 'Deferred revenue released', 'debit' => $amount],
            ['account_code' => '4100', 'description' => 'Revenue recognised', 'credit' => $amount],
        ], $user);

        $recognized = round((float) $schedule->recognized_amount + $amount, 2);
        $schedule->forceFill([
            'recognized_amount' => $recognized,
            'deferred_amount' => round(max((float) $schedule->total_amount - $recognized, 0), 2),
            'last_recognized_on' => $date,
            'status' => $recognized >= (float) $schedule->total_amount - 0.005 ? 'completed' : 'active',
        ])->saveQuietly();

        $schedule->entries()->create([
            'recognition_date' => $date,
            'amount' => $amount,
            'journal_entry_id' => $entry->id,
        ]);

        return $entry;
    }

    public function postCostAllocation(CostAllocation $allocation, float $amount, string $date, ?User $user = null): ?JournalEntry
    {
        if ($amount <= 0) {
            return null;
        }

        $accountId = $allocation->account_id ?? $this->resolveAccount('5300')->id;

        return $this->post([
            'entry_date' => $date,
            'memo' => 'Cost allocation — '.$allocation->name,
            'source_type' => CostAllocation::class,
            'source_id' => $allocation->id,
        ], [
            ['account_id' => $accountId, 'description' => 'Allocated in', 'debit' => $amount, 'cost_center_id' => $allocation->target_cost_center_id],
            ['account_id' => $accountId, 'description' => 'Allocated out', 'credit' => $amount, 'cost_center_id' => $allocation->source_cost_center_id],
        ], $user);
    }

    public function void(JournalEntry $entry, ?User $user = null): JournalEntry
    {
        if ($entry->status === JournalEntryStatus::Void) {
            return $entry;
        }

        $entry->loadMissing('lines');

        $reversal = $this->post([
            'entry_date' => today()->toDateString(),
            'memo' => 'Reversal of '.$entry->reference.' — '.$entry->memo,
            'source_type' => JournalEntry::class,
            'source_id' => $entry->id,
            'currency' => $entry->currency,
            'exchange_rate' => $entry->exchange_rate,
            'metadata' => ['reversal_of' => $entry->reference],
        ], $entry->lines->map(fn ($line) => [
            'account_id' => $line->account_id,
            'description' => 'Reversal — '.$line->description,
            'debit' => (float) $line->credit,
            'credit' => (float) $line->debit,
            'department_id' => $line->department_id,
            'cost_center_id' => $line->cost_center_id,
            'project_id' => $line->project_id,
        ])->all(), $user);

        $entry->forceFill([
            'status' => JournalEntryStatus::Void,
            'voided_at' => now(),
            'reversal_of_id' => $reversal->id,
        ])->save();

        $this->audit->log('voided', $entry, ['status' => 'posted'], ['status' => 'void'], 'Voided journal '.$entry->reference);

        return $reversal;
    }
}
