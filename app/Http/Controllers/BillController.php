<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Currency;
use App\Models\Project;
use App\Models\User;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BillController extends Controller
{
    public function __construct(private readonly PayablesService $payables) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'sort' => ['nullable', Rule::in(['bill_date', 'number', 'total'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $sort = $filters['sort'] ?? 'bill_date';
        $direction = $filters['direction'] ?? 'desc';

        $bills = Bill::query()
            ->with(['contact', 'items'])
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('bill_date', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('bill_date', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Bill $bill) => $this->present($bill));

        $editId = $request->filled('edit') ? $request->integer('edit') : null;
        $editBill = $editId ? Bill::query()->with('items')->find($editId) : null;

        if ($editBill !== null && $this->editRestriction($editBill, $request->user()) !== null) {
            $editBill = null;
        }

        return Inertia::render('Bills/Index', [
            'bills' => $bills,
            'editBill' => $editBill ? $this->present($editBill) : null,
            'filters' => [
                'status' => $filters['status'] ?? null,
                'search' => $filters['search'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'stats' => [
                'total' => round((float) Bill::query()->sum('total'), 2),
                'outstanding' => round((float) Bill::query()->sum(DB::raw('total - amount_paid')), 2),
                'overdue' => round((float) Bill::query()->whereIn('status', ['approved', 'partial'])->whereDate('due_date', '<', today())->sum(DB::raw('total - amount_paid')), 2),
                'paid' => round((float) Bill::query()->where('status', 'paid')->sum('total'), 2),
            ],
            'vendors' => Contact::query()->vendors()->orderBy('name')->get(['id', 'name', 'email', 'phone', 'address', 'city', 'country']),
            'accounts' => Account::query()->whereIn('type', ['expense', 'asset'])->orderBy('code')->get(['id', 'code', 'name']),
            'projects' => Project::query()->where('status', 'active')->orderBy('name')->get(['id', 'name']),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->pluck('code')
                ->values(),
            'statuses' => ['draft', 'pending_approval', 'approved', 'partial', 'paid', 'void'],
        ]);
    }

    public function show(Bill $bill): Response
    {
        $bill->load(['contact', 'items.account', 'payments.contact']);

        return Inertia::render('Bills/Show', [
            'bill' => [
                'id' => $bill->id,
                'number' => $bill->number,
                'contact' => $bill->contact?->name,
                'contact_id' => $bill->contact_id,
                'bill_date' => $bill->bill_date?->toDateString(),
                'due_date' => $bill->due_date?->toDateString(),
                'status' => $bill->status,
                'currency' => $bill->currency,
                'subtotal' => (float) $bill->subtotal,
                'tax_total' => (float) $bill->tax_total,
                'total' => (float) $bill->total,
                'amount_paid' => (float) $bill->amount_paid,
                'balance_due' => $bill->balanceDue(),
                'notes' => $bill->notes,
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
                    'paid_on' => $payment->paid_on?->toDateString(),
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'reference' => $payment->reference,
                ]),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id', 'required_without:vendor_name'],
            'vendor_name' => ['nullable', 'string', 'max:255', 'required_without:contact_id'],
            'vendor_email' => ['nullable', 'email', 'max:255'],
            'vendor_phone' => ['nullable', 'string', 'max:40'],
            'number' => ['nullable', 'string', 'max:40', 'unique:bills,number'],
            'bill_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:bill_date'],
            'status' => ['nullable', Rule::in(['draft', 'approved'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
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

        $bill = DB::transaction(function () use ($data): Bill {
            if (empty($data['contact_id'])) {
                $vendor = Contact::create([
                    'name' => $data['vendor_name'],
                    'email' => filled($data['vendor_email'] ?? null) ? $data['vendor_email'] : null,
                    'phone' => filled($data['vendor_phone'] ?? null) ? $data['vendor_phone'] : null,
                    'type' => 'vendor',
                    'is_active' => true,
                ]);

                $data['contact_id'] = $vendor->id;
            }

            return $this->payables->createBill($data);
        });

        $message = $selfApproved && $bill->status === 'draft'
            ? "Bill {$bill->number} created as draft. Only approvers can post bills directly."
            : "Bill {$bill->number} created.";

        return redirect()->route('bills.show', $bill)->with('success', $message);
    }

    public function update(Request $request, Bill $bill): RedirectResponse
    {
        if ($reason = $this->editRestriction($bill, $request->user())) {
            return back()->with('error', $reason);
        }

        $wasPosted = in_array($bill->status, ['approved', 'void'], true);

        $data = $request->validate([
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id', 'required_without:vendor_name'],
            'vendor_name' => ['nullable', 'string', 'max:255', 'required_without:contact_id'],
            'vendor_email' => ['nullable', 'email', 'max:255'],
            'vendor_phone' => ['nullable', 'string', 'max:40'],
            'number' => ['nullable', 'string', 'max:40', Rule::unique('bills', 'number')->ignore($bill->id)],
            'bill_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:bill_date'],
            'status' => ['nullable', Rule::in(['draft', 'approved'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
        ]);

        if (($data['status'] ?? null) === 'approved' && ! $request->user()->canApprove()) {
            throw ValidationException::withMessages([
                'status' => 'Only approvers can post a bill to the ledger.',
            ]);
        }

        $updated = DB::transaction(function () use ($bill, $data, $request): Bill {
            if (empty($data['contact_id'])) {
                $vendor = Contact::create([
                    'name' => $data['vendor_name'],
                    'email' => filled($data['vendor_email'] ?? null) ? $data['vendor_email'] : null,
                    'phone' => filled($data['vendor_phone'] ?? null) ? $data['vendor_phone'] : null,
                    'type' => 'vendor',
                    'is_active' => true,
                ]);

                $data['contact_id'] = $vendor->id;
            }

            return $this->payables->updateBill($bill, $data, $request->user());
        });

        $message = match (true) {
            ($data['status'] ?? null) === 'approved' => "Bill {$updated->number} updated and posted to the ledger.",
            $wasPosted => "Bill {$updated->number} updated. The original posting was reversed and the bill is now a draft.",
            default => "Bill {$updated->number} updated.",
        };

        return redirect()->route('bills.show', $updated)->with('success', $message);
    }

    public function approve(Bill $bill): RedirectResponse
    {
        $this->payables->approveBill($bill);

        return back()->with('success', "Bill {$bill->number} approved and posted to the ledger.");
    }

    public function payment(Request $request, Bill $bill): RedirectResponse
    {
        $data = $request->validate([
            'paid_on' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $payment = $this->payables->recordPayment($bill, $data, $request->user());

        return back()->with('success', "Payment {$payment->payment_number} recorded against {$bill->number} and posted to the ledger.");
    }

    public function destroy(Request $request, Bill $bill): RedirectResponse
    {
        $posted = in_array($bill->status, ['approved', 'partial', 'paid'], true);

        if ($posted && ! $request->user()->canApprove()) {
            return back()->with('error', 'Only approvers can delete a posted bill.');
        }

        if ($posted && $bill->items()->whereNotNull('inventory_item_id')->exists()) {
            return back()->with('error', 'This bill received inventory and cannot be deleted. Reverse the inventory movement first.');
        }

        $number = $bill->number;

        $this->payables->deleteBill($bill, $request->user());

        return redirect()->route('bills.index')->with('success', $posted
            ? "Bill {$number} deleted. Its ledger posting and payments were reversed."
            : "Bill {$number} deleted.");
    }

    /**
     * Why a bill cannot be edited, or null when the user may edit it. Posted
     * bills are only editable by approvers and only when no payments or stock
     * receipts depend on them.
     */
    private function editRestriction(Bill $bill, ?User $user): ?string
    {
        if (in_array($bill->status, ['draft', 'pending_approval'], true)) {
            return null;
        }

        if (! in_array($bill->status, ['approved', 'void'], true)) {
            return 'Bills with recorded payments cannot be edited. Remove the payments first.';
        }

        if ($user === null || ! $user->canApprove()) {
            return 'Only approvers can edit a posted bill.';
        }

        if ($bill->payments()->exists()) {
            return 'This bill has payments recorded and cannot be edited. Remove the payments first.';
        }

        if ($bill->items()->whereNotNull('inventory_item_id')->exists()) {
            return 'This bill received inventory and cannot be edited. Reverse the inventory movement first.';
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Bill $bill): array
    {
        return [
            'id' => $bill->id,
            'contact_id' => $bill->contact_id,
            'number' => $bill->number,
            'contact' => $bill->contact?->name,
            'bill_date' => $bill->bill_date?->toDateString(),
            'due_date' => $bill->due_date?->toDateString(),
            'status' => $bill->status,
            'currency' => $bill->currency,
            'project_id' => $bill->project_id,
            'notes' => $bill->notes,
            'total' => (float) $bill->total,
            'amount_paid' => (float) $bill->amount_paid,
            'balance_due' => $bill->balanceDue(),
            'is_overdue' => $bill->isOverdue(),
            'items' => $bill->items->map(fn ($item) => [
                'id' => $item->id,
                'account_id' => $item->account_id,
                'description' => $item->description,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'tax_rate' => (float) $item->tax_rate,
            ])->values(),
        ];
    }
}
