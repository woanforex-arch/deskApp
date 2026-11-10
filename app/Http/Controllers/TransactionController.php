<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Models\BankAccount;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\VendorPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
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
            'methods' => collect(PaymentMethod::cases())
                ->map(fn (PaymentMethod $method) => ['value' => $method->value, 'label' => $method->label()])
                ->values(),
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
