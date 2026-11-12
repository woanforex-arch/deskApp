<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Http\Requests\Api\StoreInvoiceRequest;
use App\Http\Requests\Api\StorePaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Jobs\SendInvoiceReminder;
use App\Models\Account;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Invoice;
use App\Models\Project;
use App\Services\Accounting\InvoiceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceService $invoices) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([...array_map(fn (InvoiceStatus $status) => $status->value, InvoiceStatus::cases()), 'open'])],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'sort' => ['nullable', Rule::in(['issue_date', 'number', 'total'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $sort = $filters['sort'] ?? 'issue_date';
        $direction = $filters['direction'] ?? 'desc';

        $invoices = Invoice::query()
            ->with('contact')
            ->when($filters['status'] ?? null, function ($query, $status): void {
                if ($status === 'open') {
                    $query->open();
                } elseif ($status === 'overdue') {
                    $query->overdue();
                } else {
                    $query->where('status', $status);
                }
            })
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('issue_date', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('issue_date', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Invoice $invoice) => [
                'id' => $invoice->id,
                'number' => $invoice->number,
                'contact' => $invoice->contact?->name,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'due_date' => $invoice->due_date?->toDateString(),
                'status' => $invoice->status->value,
                'status_label' => $invoice->status->label(),
                'total' => (float) $invoice->total,
                'amount_paid' => (float) $invoice->amount_paid,
                'balance_due' => $invoice->balanceDue(),
                'currency' => $invoice->currency,
            ]);

        $overdueQuery = Invoice::query()->overdue();

        return Inertia::render('Invoices/Index', [
            'invoices' => $invoices,
            'filters' => [
                'status' => $filters['status'] ?? null,
                'search' => $filters['search'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'stats' => [
                'total_billed' => round((float) Invoice::query()->where('status', '!=', InvoiceStatus::Void->value)->sum('total'), 2),
                'outstanding' => round((float) Invoice::query()->open()->sum('total') - (float) Invoice::query()->open()->sum('amount_paid'), 2),
                'overdue_count' => (clone $overdueQuery)->count(),
                'overdue_amount' => round((float) (clone $overdueQuery)->sum('total') - (float) (clone $overdueQuery)->sum('amount_paid'), 2),
                'paid_count' => Invoice::query()->where('status', InvoiceStatus::Paid->value)->count(),
            ],
            'statuses' => collect(InvoiceStatus::cases())
                ->map(fn (InvoiceStatus $status) => ['value' => $status->value, 'label' => $status->label()])
                ->values(),
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
            'projects' => Project::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->values(),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->pluck('code')
                ->values(),
        ]);
    }

    public function show(Invoice $invoice): Response
    {
        $invoice->load(['contact', 'items.account', 'payments']);

        return Inertia::render('Invoices/Show', [
            'invoice' => (new InvoiceResource($invoice))->resolve(),
            'paymentMethods' => collect(PaymentMethod::cases())
                ->map(fn (PaymentMethod $method) => ['value' => $method->value, 'label' => $method->label()])
                ->values(),
        ]);
    }

    public function store(StoreInvoiceRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $invoice = DB::transaction(function () use ($data): Invoice {
            if (empty($data['contact_id'])) {
                $contact = Contact::create([
                    'name' => $data['customer_name'],
                    'email' => filled($data['customer_email'] ?? null) ? $data['customer_email'] : null,
                    'phone' => filled($data['customer_phone'] ?? null) ? $data['customer_phone'] : null,
                    'type' => 'customer',
                    'is_active' => true,
                ]);

                $data['contact_id'] = $contact->id;
            }

            return $this->invoices->create($data);
        });

        return redirect()
            ->route('invoices.show', $invoice)
            ->with('success', "Invoice {$invoice->number} created.");
    }

    public function payment(StorePaymentRequest $request, Invoice $invoice): RedirectResponse
    {
        $payment = $this->invoices->recordPayment($invoice, [
            ...$request->validated(),
            'user' => $request->user(),
        ]);

        $reference = $payment->receipt_number ? "Receipt {$payment->receipt_number}" : 'Payment';

        return back()->with('success', "{$reference} recorded against {$invoice->number}.");
    }

    public function destroy(Invoice $invoice): RedirectResponse
    {
        if ($invoice->status !== InvoiceStatus::Draft) {
            return back()->with('error', 'Only draft invoices can be deleted.');
        }

        $invoice->delete();

        return redirect()
            ->route('invoices.index')
            ->with('success', 'Invoice deleted.');
    }

    public function send(Invoice $invoice): RedirectResponse
    {
        if ($invoice->status !== InvoiceStatus::Draft) {
            return back()->with('error', 'Only draft invoices can be marked as sent.');
        }

        $this->invoices->markAsSent($invoice);

        return back()->with('success', "Invoice {$invoice->number} marked as sent.");
    }

    public function reminder(Invoice $invoice): RedirectResponse
    {
        if (! $invoice->status->isOpen()) {
            return back()->with('error', 'Reminders can only be sent for sent or overdue invoices.');
        }

        SendInvoiceReminder::dispatch($invoice);

        return back()->with('success', "Reminder for {$invoice->number} queued successfully.");
    }
}
