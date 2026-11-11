<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Http\Requests\Api\StoreSalesReceiptRequest;
use App\Http\Requests\Api\StoreVendorExpenseRequest;
use App\Models\Account;
use App\Models\BankAccount;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\VendorPayment;
use App\Services\Accounting\InvoiceService;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function __construct(
        private readonly InvoiceService $invoices,
        private readonly PayablesService $payables,
    ) {}

    public function receipts(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'sort' => ['nullable', Rule::in(['paid_on', 'receipt_number', 'amount'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $sort = $filters['sort'] ?? 'paid_on';
        $direction = $filters['direction'] ?? 'desc';

        $receipts = Payment::query()
            ->with(['contact', 'invoice'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('receipt_number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('invoice', fn ($query) => $query->where('number', 'like', "%{$search}%")));
            })
            ->when($filters['method'] ?? null, fn ($query, $method) => $query->where('method', $method))
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Payment $payment) => [
                'id' => $payment->id,
                'receipt_number' => $payment->receipt_number,
                'paid_on' => $payment->paid_on?->toDateString(),
                'contact' => $payment->contact?->name,
                'invoice_id' => $payment->invoice_id,
                'invoice_number' => $payment->invoice?->number,
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency,
                'method' => $payment->method instanceof PaymentMethod ? $payment->method->value : $payment->method,
                'method_label' => $payment->method instanceof PaymentMethod ? $payment->method->label() : $payment->method,
                'reference' => $payment->reference,
            ]);

        $openInvoices = Invoice::query()
            ->open()
            ->with('contact:id,name')
            ->orderBy('due_date')
            ->get(['id', 'number', 'contact_id', 'issue_date', 'due_date', 'status', 'total', 'amount_paid', 'currency'])
            ->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'contact' => $invoice->contact?->name,
                'contact_id' => $invoice->contact_id,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'due_date' => $invoice->due_date?->toDateString(),
                'status' => $invoice->status instanceof InvoiceStatus ? $invoice->status->value : $invoice->status,
                'total' => (float) $invoice->total,
                'amount_paid' => (float) $invoice->amount_paid,
                'balance_due' => $invoice->balanceDue(),
                'currency' => $invoice->currency,
            ]);

        return Inertia::render('Transactions/Receipts', [
            'receipts' => $receipts,
            'filters' => [
                'search' => $filters['search'] ?? null,
                'method' => $filters['method'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'stats' => [
                'total' => round((float) Payment::query()->sum('amount'), 2),
                'month' => round((float) Payment::query()->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'), 2),
                'week_count' => Payment::query()->whereBetween('paid_on', [now()->startOfWeek(), now()->endOfWeek()])->count(),
                'count' => Payment::query()->count(),
                'outstanding_invoices' => round((float) Invoice::query()->open()->sum(DB::raw('total - amount_paid')), 2),
            ],
            'invoices' => $openInvoices,
            'customers' => Contact::query()
                ->customers()
                ->active()
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'phone', 'address', 'city', 'country'])
                ->values(),
            'accounts' => Account::query()
                ->where('type', 'revenue')
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name'])
                ->values(),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->pluck('code')
                ->values(),
            'nextNumber' => Invoice::generateNumber(),
            'methods' => collect(PaymentMethod::cases())
                ->map(fn (PaymentMethod $method) => ['value' => $method->value, 'label' => $method->label()])
                ->values(),
        ]);
    }

    public function storeReceipt(StoreSalesReceiptRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $items = collect($data['items'])
            ->map(fn (array $item) => [
                'account_id' => $item['account_id'] ?? null,
                'description' => $item['description'],
                'quantity' => (float) $item['quantity'],
                'unit_price' => (float) $item['unit_price'],
                'tax_rate' => (float) ($item['tax_rate'] ?? 0),
            ])
            ->values()
            ->all();

        $subtotal = round(array_sum(array_map(
            fn (array $item) => round($item['quantity'] * $item['unit_price'], 2),
            $items,
        )), 2);
        $taxTotal = round(array_sum(array_map(
            fn (array $item) => round($item['quantity'] * $item['unit_price'] * ($item['tax_rate'] / 100), 2),
            $items,
        )), 2);
        $gross = round($subtotal + $taxTotal, 2);
        $discount = round((float) ($data['discount'] ?? 0), 2);

        if ($discount > $gross + 0.005) {
            throw ValidationException::withMessages([
                'discount' => 'The discount may not exceed the receipt subtotal and tax of '.number_format($gross, 2).'.',
            ]);
        }

        $total = round($gross - $discount, 2);

        $payment = $data['payment'] ?? [];
        $paidToday = round((float) ($payment['amount'] ?? 0), 2);
        $status = InvoiceStatus::from($data['status'] ?? InvoiceStatus::Sent->value);

        if ($paidToday > 0 && $status === InvoiceStatus::Draft) {
            throw ValidationException::withMessages([
                'payment.amount' => 'Clear the amount paid today before saving this receipt as a draft.',
            ]);
        }

        if ($paidToday > $total + 0.005) {
            throw ValidationException::withMessages([
                'payment.amount' => 'The amount paid today may not exceed the receipt total of '.number_format($total, 2).'.',
            ]);
        }

        $invoice = DB::transaction(function () use ($data, $items, $paidToday, $payment, $request, $status, $discount): Invoice {
            $contactId = $data['contact_id'] ?? null;

            if (! $contactId) {
                $contact = Contact::create([
                    'name' => $data['customer_name'],
                    'email' => filled($data['customer_email'] ?? null) ? $data['customer_email'] : null,
                    'phone' => filled($data['customer_phone'] ?? null) ? $data['customer_phone'] : null,
                    'type' => 'customer',
                    'is_active' => true,
                ]);

                $contactId = $contact->id;
            }

            $invoice = $this->invoices->create([
                'contact_id' => $contactId,
                'number' => filled($data['number'] ?? null) ? $data['number'] : null,
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'],
                'status' => $status,
                'currency' => $data['currency'] ?? null,
                'terms' => $data['terms'] ?? null,
                'ship_to' => $data['ship_to'] ?? null,
                'salesperson' => $data['salesperson'] ?? null,
                'ship_via' => $data['ship_via'] ?? null,
                'promised_date' => $data['promised_date'] ?? null,
                'delivery_status' => $data['delivery_status'] ?? null,
                'sales_type' => $data['sales_type'] ?? null,
                'discount' => $discount,
                'notes' => $data['notes'] ?? null,
                'items' => $items,
            ]);

            if ($paidToday > 0) {
                $this->invoices->recordPayment($invoice, [
                    'paid_on' => $payment['paid_on'] ?? $data['issue_date'],
                    'amount' => $paidToday,
                    'method' => $payment['method'] ?? PaymentMethod::Cash->value,
                    'reference' => $payment['reference'] ?? null,
                    'receipt_number' => Payment::generateReceiptNumber($data['issue_date']),
                    'notes' => $payment['notes'] ?? null,
                    'currency' => $invoice->currency,
                    'user' => $request->user(),
                ]);

                $invoice->refresh();
            }

            return $invoice;
        });

        return redirect()
            ->route('transactions.receipts')
            ->with('success', $paidToday > 0
                ? "Sales receipt {$invoice->number} recorded with a payment of ".number_format($paidToday, 2).'.'
                : "Sales receipt {$invoice->number} recorded.");
    }

    public function printReceipt(Payment $payment): Response
    {
        $payment->load(['contact', 'invoice.items.account']);

        $invoice = $payment->invoice;

        return Inertia::render('Transactions/PrintReceipt', [
            'receipt' => [
                'id' => $payment->id,
                'receipt_number' => $payment->receipt_number ?? 'RCT-'.$payment->id,
                'paid_on' => $payment->paid_on?->toDateString(),
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency,
                'method' => $payment->method instanceof PaymentMethod ? $payment->method->label() : $payment->method,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'contact' => $payment->contact ? [
                    'name' => $payment->contact->name,
                    'email' => $payment->contact->email,
                    'phone' => $payment->contact->phone,
                    'address' => $payment->contact->address,
                    'city' => $payment->contact->city,
                    'country' => $payment->contact->country,
                ] : null,
                'invoice' => $invoice ? [
                    'id' => $invoice->id,
                    'number' => $invoice->number,
                    'issue_date' => $invoice->issue_date?->toDateString(),
                    'due_date' => $invoice->due_date?->toDateString(),
                    'terms' => $invoice->terms,
                    'sales_type' => $invoice->sales_type,
                    'salesperson' => $invoice->salesperson,
                    'ship_via' => $invoice->ship_via,
                    'ship_to' => $invoice->ship_to,
                    'promised_date' => $invoice->promised_date?->toDateString(),
                    'delivery_status' => $invoice->delivery_status,
                    'notes' => $invoice->notes,
                    'subtotal' => (float) $invoice->subtotal,
                    'tax_total' => (float) $invoice->tax_total,
                    'discount' => (float) $invoice->discount,
                    'total' => (float) $invoice->total,
                    'amount_paid' => (float) $invoice->amount_paid,
                    'balance_due' => $invoice->balanceDue(),
                    'items' => $invoice->items->map(fn ($item) => [
                        'id' => $item->id,
                        'description' => $item->description,
                        'quantity' => (float) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'tax_rate' => (float) $item->tax_rate,
                        'total' => (float) $item->total,
                        'account' => $item->account ? $item->account->code.' · '.$item->account->name : null,
                    ])->values(),
                ] : null,
            ],
        ]);
    }

    public function payments(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $payments = VendorPayment::query()
            ->with(['contact', 'bill'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('bill', fn ($query) => $query->where('number', 'like', "%{$search}%")));
            })
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '<=', $date))
            ->orderByDesc('paid_on')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (VendorPayment $payment) => [
                'id' => $payment->id,
                'paid_on' => $payment->paid_on?->toDateString(),
                'contact' => $payment->contact?->name,
                'bill' => $payment->bill?->number,
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency,
                'method' => $payment->method,
                'reference' => $payment->reference,
            ]);

        return Inertia::render('Transactions/Payments', [
            'payments' => $payments,
            'filters' => [
                'search' => $filters['search'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
            ],
            'stats' => [
                'total' => round((float) VendorPayment::query()->sum('amount'), 2),
                'month' => round((float) VendorPayment::query()->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'), 2),
                'count' => VendorPayment::query()->count(),
                'outstanding_bills' => round((float) Bill::query()->open()->sum(DB::raw('total - amount_paid')), 2),
            ],
            'vendors' => Contact::query()->vendors()->orderBy('name')->get(['id', 'name']),
            'bills' => Bill::query()
                ->open()
                ->with('contact:id,name')
                ->orderBy('due_date')
                ->get(['id', 'number', 'contact_id', 'bill_date', 'due_date', 'status', 'total', 'amount_paid', 'currency'])
                ->map(fn (Bill $bill) => [
                    'id' => $bill->id,
                    'number' => $bill->number,
                    'contact' => $bill->contact?->name,
                    'contact_id' => $bill->contact_id,
                    'bill_date' => $bill->bill_date?->toDateString(),
                    'due_date' => $bill->due_date?->toDateString(),
                    'status' => $bill->status,
                    'is_overdue' => $bill->isOverdue(),
                    'total' => (float) $bill->total,
                    'amount_paid' => (float) $bill->amount_paid,
                    'balance_due' => $bill->balanceDue(),
                    'currency' => $bill->currency,
                ]),
            'bankAccounts' => BankAccount::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'currency']),
            'accounts' => Account::query()
                ->whereIn('type', ['expense', 'asset'])
                ->orderBy('code')
                ->get(['id', 'code', 'name'])
                ->values(),
            'nextBillNumber' => Bill::generateNumber(),
            'canApprove' => (bool) $request->user()?->canApprove(),
            'methods' => collect(PaymentMethod::cases())
                ->map(fn (PaymentMethod $method) => ['value' => $method->value, 'label' => $method->label()])
                ->values(),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->pluck('code')
                ->values(),
        ]);
    }

    public function storePayment(StoreVendorExpenseRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $items = collect($data['items'])
            ->map(fn (array $item) => [
                'account_id' => $item['account_id'] ?? null,
                'inventory_item_id' => $item['inventory_item_id'] ?? null,
                'description' => $item['description'],
                'quantity' => (float) $item['quantity'],
                'unit_price' => (float) $item['unit_price'],
                'tax_rate' => (float) ($item['tax_rate'] ?? 0),
            ])
            ->values()
            ->all();

        $subtotal = round(array_sum(array_map(
            fn (array $item) => round($item['quantity'] * $item['unit_price'], 2),
            $items,
        )), 2);

        $taxTotal = round(array_sum(array_map(
            fn (array $item) => round($item['quantity'] * $item['unit_price'] * ($item['tax_rate'] / 100), 2),
            $items,
        )), 2);

        $total = round($subtotal + $taxTotal, 2);

        $payment = $data['payment'] ?? [];
        $paidToday = round((float) ($payment['amount'] ?? 0), 2);

        $requestedStatus = $data['status'] ?? 'draft';
        $selfApproved = $requestedStatus === 'approved';

        if ($selfApproved && ! $request->user()->canApprove()) {
            $data['status'] = 'draft';
        }

        $status = $data['status'] ?? 'draft';

        if ($paidToday > 0 && $status === 'draft') {
            throw ValidationException::withMessages([
                'payment.amount' => $selfApproved
                    ? 'Only approvers can record an immediate payment. Save this expense as a draft and settle it after approval.'
                    : 'Clear the amount paid today before saving this expense as a draft.',
            ]);
        }

        if ($paidToday > $total + 0.005) {
            throw ValidationException::withMessages([
                'payment.amount' => 'The amount paid today may not exceed the expense total of '.number_format($total, 2).'.',
            ]);
        }

        $bill = DB::transaction(function () use ($data, $items, $paidToday, $payment, $request): Bill {
            $contactId = $data['contact_id'] ?? null;

            if (! $contactId) {
                $contact = Contact::create([
                    'name' => $data['vendor_name'],
                    'email' => filled($data['vendor_email'] ?? null) ? $data['vendor_email'] : null,
                    'phone' => filled($data['vendor_phone'] ?? null) ? $data['vendor_phone'] : null,
                    'type' => 'vendor',
                    'is_active' => true,
                ]);

                $contactId = $contact->id;
            }

            $bill = $this->payables->createBill([
                ...$data,
                'contact_id' => $contactId,
                'items' => $items,
            ], $request->user());

            if ($paidToday > 0) {
                $this->payables->recordPayment($bill, [
                    'paid_on' => $payment['paid_on'] ?? $data['bill_date'],
                    'amount' => $paidToday,
                    'method' => $payment['method'] ?? PaymentMethod::BankTransfer->value,
                    'reference' => $payment['reference'] ?? null,
                    'notes' => $payment['notes'] ?? null,
                    'bank_account_id' => $payment['bank_account_id'] ?? null,
                    'currency' => $bill->currency,
                ], $request->user());

                $bill->refresh();
            }

            return $bill;
        });

        $downgraded = $selfApproved && $status === 'draft';

        $message = match (true) {
            $paidToday > 0 => "Expense {$bill->number} recorded with a payment of ".number_format($paidToday, 2).'.',
            $downgraded => "Expense {$bill->number} saved as draft. Only approvers can post expenses directly.",
            default => "Expense {$bill->number} saved.",
        };

        return redirect()->route('transactions.payments')->with('success', $message);
    }
}
