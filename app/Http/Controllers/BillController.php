<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\Project;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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
            ->with('contact')
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
            ->through(fn (Bill $bill) => [
                'id' => $bill->id,
                'number' => $bill->number,
                'contact' => $bill->contact?->name,
                'bill_date' => $bill->bill_date?->toDateString(),
                'due_date' => $bill->due_date?->toDateString(),
                'status' => $bill->status,
                'total' => (float) $bill->total,
                'amount_paid' => (float) $bill->amount_paid,
                'balance_due' => $bill->balanceDue(),
                'currency' => $bill->currency,
                'is_overdue' => $bill->isOverdue(),
            ]);

        return Inertia::render('Bills/Index', [
            'bills' => $bills,
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
            'vendors' => Contact::query()->vendors()->orderBy('name')->get(['id', 'name']),
            'accounts' => Account::query()->whereIn('type', ['expense', 'asset'])->orderBy('code')->get(['id', 'code', 'name']),
            'projects' => Project::query()->where('status', 'active')->orderBy('name')->get(['id', 'name']),
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
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
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

        $bill = $this->payables->createBill($data);

        $message = $selfApproved && $bill->status === 'draft'
            ? "Bill {$bill->number} created as draft. Only approvers can post bills directly."
            : "Bill {$bill->number} created.";

        return redirect()->route('bills.show', $bill)->with('success', $message);
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

    public function destroy(Bill $bill): RedirectResponse
    {
        if (! in_array($bill->status, ['draft', 'void'], true)) {
            return back()->with('error', 'Only draft bills can be deleted.');
        }

        $bill->delete();

        return redirect()->route('bills.index')->with('success', 'Bill deleted.');
    }
}
