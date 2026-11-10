<?php

namespace App\Http\Controllers\Api;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInvoiceRequest;
use App\Http\Requests\Api\StorePaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Jobs\SendInvoiceReminder;
use App\Models\Invoice;
use App\Services\Accounting\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceService $invoices) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(InvoiceStatus::class)],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $invoices = Invoice::query()
            ->with('contact')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('contact_id'), fn ($query) => $query->where('contact_id', $request->integer('contact_id')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return InvoiceResource::collection($invoices);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $invoice = $this->invoices->create($request->validated());

        return (new InvoiceResource($invoice))->response()->setStatusCode(201);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        $invoice->load(['contact', 'items.account', 'payments']);

        return new InvoiceResource($invoice);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        if ($invoice->status !== InvoiceStatus::Draft) {
            return response()->json([
                'message' => 'Only draft invoices can be deleted.',
            ], 422);
        }

        $invoice->delete();

        return response()->json(null, 204);
    }

    public function send(Invoice $invoice): InvoiceResource
    {
        $invoice = $this->invoices->markAsSent($invoice);

        return new InvoiceResource($invoice->load(['contact', 'items.account', 'payments']));
    }

    public function payment(StorePaymentRequest $request, Invoice $invoice): JsonResponse
    {
        $payment = $this->invoices->recordPayment($invoice, $request->validated());

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'payment' => new PaymentResource($payment),
            'invoice' => new InvoiceResource($payment->invoice->load(['contact', 'items.account', 'payments'])),
        ], 201);
    }

    public function reminder(Invoice $invoice): JsonResponse
    {
        if (! $invoice->status->isOpen()) {
            return response()->json([
                'message' => 'Reminders can only be sent for sent or overdue invoices.',
            ], 422);
        }

        SendInvoiceReminder::dispatch($invoice);

        return response()->json([
            'message' => 'Invoice reminder queued successfully.',
        ], 202);
    }
}
