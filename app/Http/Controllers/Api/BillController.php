<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillController extends Controller
{
    public function __construct(private readonly PayablesService $payables) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $bills = Bill::query()
            ->with('contact:id,name')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('contact_id'), fn ($query) => $query->where('contact_id', $request->integer('contact_id')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->orderByDesc('bill_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25))
            ->through(fn (Bill $bill) => $this->present($bill));

        return response()->json($bills);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'number' => ['nullable', 'string', 'max:40', 'unique:bills,number'],
            'bill_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:bill_date'],
            'status' => ['nullable', Rule::in(['draft', 'approved'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'exchange_rate' => ['nullable', 'numeric', 'gt:0'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'items.*.project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'items.*.cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
        ]);

        $requestedStatus = $data['status'] ?? 'draft';
        $selfApproved = $requestedStatus === 'approved';

        if ($selfApproved && ! $request->user()->canApprove()) {
            $data['status'] = 'draft';
        }

        $bill = $this->payables->createBill($data, $request->user());

        return response()->json([
            'message' => $selfApproved && $bill->status === 'draft'
                ? 'Bill created as draft. Only approvers can post bills directly.'
                : 'Bill created.',
            'data' => $this->present($bill->load('contact', 'items')),
        ], 201);
    }

    public function show(Bill $bill): JsonResponse
    {
        $bill->load(['contact', 'items.account', 'payments']);

        return response()->json([
            'data' => $this->present($bill) + [
                'items' => $bill->items->map(fn ($item) => [
                    'id' => $item->id,
                    'description' => $item->description,
                    'account' => $item->account?->name,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'tax_rate' => (float) $item->tax_rate,
                    'amount' => (float) $item->amount,
                ]),
                'payments' => $bill->payments->map(fn ($payment) => [
                    'id' => $payment->id,
                    'payment_number' => $payment->payment_number,
                    'paid_on' => $payment->paid_on?->toDateString(),
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'reference' => $payment->reference,
                ]),
            ],
        ]);
    }

    public function approve(Request $request, Bill $bill): JsonResponse
    {
        $bill = $this->payables->approveBill($bill, $request->user());

        return response()->json(['message' => 'Bill approved and posted.', 'data' => $this->present($bill)]);
    }

    public function payment(Request $request, Bill $bill): JsonResponse
    {
        $data = $request->validate([
            'paid_on' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'currency' => ['nullable', 'string', 'size:3'],
            'exchange_rate' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $payment = $this->payables->recordPayment($bill, $data, $request->user());

        return response()->json([
            'message' => "Vendor payment {$payment->payment_number} recorded.",
            'data' => [
                'id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'amount' => (float) $payment->amount,
                'paid_on' => $payment->paid_on?->toDateString(),
                'bill' => $this->present($payment->bill->load('contact')),
            ],
        ], 201);
    }

    public function destroy(Bill $bill): JsonResponse
    {
        if (! in_array($bill->status, ['draft', 'void'], true)) {
            return response()->json(['message' => 'Only draft bills can be deleted.'], 422);
        }

        $bill->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Bill $bill): array
    {
        return [
            'id' => $bill->id,
            'number' => $bill->number,
            'contact_id' => $bill->contact_id,
            'contact' => $bill->relationLoaded('contact') ? $bill->contact?->name : null,
            'bill_date' => $bill->bill_date?->toDateString(),
            'due_date' => $bill->due_date?->toDateString(),
            'status' => $bill->status,
            'currency' => $bill->currency,
            'subtotal' => (float) $bill->subtotal,
            'tax_total' => (float) $bill->tax_total,
            'total' => (float) $bill->total,
            'amount_paid' => (float) $bill->amount_paid,
            'balance_due' => $bill->balanceDue(),
            'is_overdue' => $bill->isOverdue(),
        ];
    }
}
