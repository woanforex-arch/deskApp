<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Http\Requests\Api\StoreSalesReceiptRequest;
use App\Models\Account;
use App\Models\BankAccount;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\VendorPayment;
use App\Services\Accounting\InvoiceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function __construct(private readonly InvoiceService $invoices) {}

    public function receipts(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $receipts = Payment::query()
            ->with(['contact', 'invoice'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('receipt_number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('invoice', fn ($query) => $query->where('number', 'like', "%{$search}%")));
            })
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '<=', $date))
            ->orderByDesc('paid_on')
            ->orderByDesc('id')
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
            ->get(['id', 'number', 'contact_id', 'total', 'amount_paid', 'currency'])
            ->map(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'contact' => $invoice->contact?->name,
                'contact_id' => $invoice->contact_id,
                'total' => (float) $invoice->total,
                'amount_paid' => (float) $invoice->amount_paid,
                'balance_due' => $invoice->balanceDue(),
                'currency' => $invoice->currency,
            ]);

        return Inertia::render('Transactions/Receipts', [
            'receipts' => $receipts,
            'filters' => [
                'search' => $filters['search'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
            ],
            'stats' => [
                'total' => round((float) Payment::query()->sum('amount'), 2),
                'month' => round((float) Payment::query()->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'), 2),
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
        $total = round($subtotal + $taxTotal, 2);

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

        $invoice = DB::transaction(function () use ($data, $items, $paidToday, $payment, $request, $status): Invoice {
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
                ->get(['id', 'number', 'contact_id', 'total', 'amount_paid', 'currency'])
                ->map(fn (Bill $bill) => [
                    'id' => $bill->id,
                    'number' => $bill->number,
                    'contact' => $bill->contact?->name,
                    'contact_id' => $bill->contact_id,
                    'total' => (float) $bill->total,
                    'amount_paid' => (float) $bill->amount_paid,
                    'balance_due' => $bill->balanceDue(),
                    'currency' => $bill->currency,
                ]),
            'bankAccounts' => BankAccount::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'currency']),
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
}
