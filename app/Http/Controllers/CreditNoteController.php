<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CreditNoteController extends Controller
{
    public function __construct(private readonly PayablesService $payables) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(['sales', 'purchase'])],
            'status' => ['nullable', 'string', 'max:30'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $notes = CreditNote::query()
            ->with(['contact', 'invoice:id,number', 'bill:id,number'])
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('number', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (CreditNote $note) => [
                'id' => $note->id,
                'number' => $note->number,
                'type' => $note->type,
                'contact' => $note->contact?->name,
                'issue_date' => $note->issue_date?->toDateString(),
                'status' => $note->status,
                'currency' => $note->currency,
                'total' => (float) $note->total,
                'reason' => $note->reason,
                'invoice' => $note->invoice?->number,
                'bill' => $note->bill?->number,
            ]);

        return Inertia::render('CreditNotes/Index', [
            'notes' => $notes,
            'filters' => [
                'type' => $filters['type'] ?? null,
                'status' => $filters['status'] ?? null,
                'search' => $filters['search'] ?? null,
            ],
            'stats' => [
                'sales' => round((float) CreditNote::query()->where('type', 'sales')->sum('total'), 2),
                'purchase' => round((float) CreditNote::query()->where('type', 'purchase')->sum('total'), 2),
                'posted' => CreditNote::query()->where('status', 'posted')->count(),
                'draft' => CreditNote::query()->where('status', 'draft')->count(),
            ],
            'contacts' => Contact::query()->orderBy('name')->get(['id', 'name', 'type']),
            'accounts' => Account::query()->whereIn('type', ['revenue', 'expense', 'asset'])->orderBy('code')->get(['id', 'code', 'name']),
            'invoices' => Invoice::query()->orderByDesc('issue_date')->limit(200)->get(['id', 'number', 'contact_id', 'total', 'currency']),
            'bills' => Bill::query()->orderByDesc('bill_date')->limit(200)->get(['id', 'number', 'contact_id', 'total', 'currency']),
            'statuses' => ['draft', 'posted', 'void'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['sales', 'purchase'])],
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
            'bill_id' => ['nullable', 'integer', 'exists:bills,id'],
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'issue_date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['draft', 'posted'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
        ]);

        $note = $this->payables->createCreditNote($data);

        return back()->with('success', "Credit note {$note->number} created.");
    }

    public function post(CreditNote $creditNote): RedirectResponse
    {
        if ($creditNote->status === 'posted') {
            return back()->with('error', 'This credit note has already been posted.');
        }

        $this->payables->postCreditNote($creditNote);

        return back()->with('success', "Credit note {$creditNote->number} posted to the ledger.");
    }

    public function destroy(CreditNote $creditNote): RedirectResponse
    {
        if ($creditNote->status === 'posted') {
            return back()->with('error', 'Posted credit notes cannot be deleted.');
        }

        $creditNote->delete();

        return back()->with('success', 'Credit note deleted.');
    }
}
