<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VendorPayment;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VendorPaymentController extends Controller
{
    public function __construct(private readonly PayablesService $payables) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', Rule::in(['bank_transfer', 'cash', 'card', 'cheque', 'other'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $payments = VendorPayment::query()
            ->with(['contact', 'bill'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('payment_number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->when($filters['method'] ?? null, fn ($query, $method) => $query->where('method', $method))
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '<=', $date))
            ->orderByDesc('paid_on')
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 20), 100))
            ->withQueryString()
            ->through(fn (VendorPayment $payment) => $this->present($payment));

        return response()->json(['data' => $payments]);
    }

    public function show(VendorPayment $vendorPayment): JsonResponse
    {
        $vendorPayment->load(['contact', 'bill', 'bankAccount']);

        return response()->json(['data' => $this->present($vendorPayment, detailed: true)]);
    }

    public function update(Request $request, VendorPayment $vendorPayment): JsonResponse
    {
        $data = $request->validate([
            'paid_on' => ['sometimes', 'date'],
            'amount' => ['sometimes', 'numeric', 'gt:0'],
            'method' => ['sometimes', Rule::in(['bank_transfer', 'cash', 'card', 'cheque', 'other'])],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ]);

        $data = [
            'paid_on' => $data['paid_on'] ?? $vendorPayment->paid_on?->toDateString(),
            'amount' => $data['amount'] ?? (float) $vendorPayment->amount,
            'method' => $data['method'] ?? $vendorPayment->method,
            'reference' => array_key_exists('reference', $data) ? $data['reference'] : $vendorPayment->reference,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $vendorPayment->notes,
            'bank_account_id' => array_key_exists('bank_account_id', $data) ? $data['bank_account_id'] : $vendorPayment->bank_account_id,
        ];

        $payment = $this->payables->updatePayment($vendorPayment, $data, $request->user());

        return response()->json([
            'message' => "Vendor payment {$payment->payment_number} updated and reposted.",
            'data' => $this->present($payment, detailed: true),
        ]);
    }

    public function destroy(Request $request, VendorPayment $vendorPayment): JsonResponse
    {
        $number = $vendorPayment->payment_number;

        $this->payables->deletePayment($vendorPayment, $request->user());

        return response()->json(['message' => "Vendor payment {$number} deleted and its posting reversed."]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(VendorPayment $payment, bool $detailed = false): array
    {
        $presented = [
            'id' => $payment->id,
            'payment_number' => $payment->payment_number,
            'bill_id' => $payment->bill_id,
            'bill' => $payment->bill?->number,
            'contact_id' => $payment->contact_id,
            'contact' => $payment->relationLoaded('contact') ? $payment->contact?->name : null,
            'paid_on' => $payment->paid_on?->toDateString(),
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'currency' => $payment->currency,
            'bank_account_id' => $payment->bank_account_id,
        ];

        if ($detailed) {
            $presented['notes'] = $payment->notes;
            $presented['bank_account'] = $payment->bankAccount?->name;
            $presented['exchange_rate'] = (float) $payment->exchange_rate;
            $presented['bill_detail'] = $payment->bill ? [
                'number' => $payment->bill->number,
                'status' => $payment->bill->status,
                'total' => (float) $payment->bill->total,
                'amount_paid' => (float) $payment->bill->amount_paid,
                'balance_due' => $payment->bill->balanceDue(),
            ] : null;
        }

        return $presented;
    }
}
