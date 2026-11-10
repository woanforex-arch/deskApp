<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditNote;
use App\Services\Accounting\PayablesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CreditNoteController extends Controller
{
    public function __construct(private readonly PayablesService $payables) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', Rule::in(['sales', 'purchase'])],
            'status' => ['nullable', 'string', 'max:20'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $notes = CreditNote::query()
            ->with('contact:id,name')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('contact_id'), fn ($query) => $query->where('contact_id', $request->integer('contact_id')))
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25))
            ->through(fn (CreditNote $note) => $this->present($note));

        return response()->json($notes);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
            'bill_id' => ['nullable', 'integer', 'exists:bills,id'],
            'number' => ['nullable', 'string', 'max:40', 'unique:credit_notes,number'],
            'issue_date' => ['required', 'date'],
            'type' => ['nullable', Rule::in(['sales', 'purchase'])],
            'reason' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['draft', 'posted', 'void'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'exchange_rate' => ['nullable', 'numeric', 'gt:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
        ]);

        $note = $this->payables->createCreditNote($data, $request->user());

        return response()->json(['data' => $this->present($note)], 201);
    }

    public function show(CreditNote $creditNote): JsonResponse
    {
        $creditNote->load(['contact', 'items.account', 'invoice', 'bill']);

        return response()->json([
            'data' => $this->present($creditNote) + [
                'items' => $creditNote->items->map(fn ($item) => [
                    'id' => $item->id,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'tax_rate' => (float) $item->tax_rate,
                    'amount' => (float) $item->amount,
                ]),
                'invoice_number' => $creditNote->invoice?->number,
                'bill_number' => $creditNote->bill?->number,
            ],
        ]);
    }

    public function post(Request $request, CreditNote $creditNote): JsonResponse
    {
        if ($creditNote->status !== 'draft') {
            return response()->json(['message' => 'Only draft credit notes can be posted.'], 422);
        }

        $note = $this->payables->postCreditNote($creditNote, $request->user());

        return response()->json(['message' => 'Credit note posted.', 'data' => $this->present($note)]);
    }

    public function destroy(CreditNote $creditNote): JsonResponse
    {
        if ($creditNote->status !== 'draft') {
            return response()->json(['message' => 'Only draft credit notes can be deleted.'], 422);
        }

        $creditNote->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(CreditNote $note): array
    {
        return [
            'id' => $note->id,
            'number' => $note->number,
            'contact_id' => $note->contact_id,
            'contact' => $note->relationLoaded('contact') ? $note->contact?->name : null,
            'invoice_id' => $note->invoice_id,
            'bill_id' => $note->bill_id,
            'issue_date' => $note->issue_date?->toDateString(),
            'type' => $note->type,
            'reason' => $note->reason,
            'status' => $note->status,
            'currency' => $note->currency,
            'subtotal' => (float) $note->subtotal,
            'tax_total' => (float) $note->tax_total,
            'total' => (float) $note->total,
        ];
    }
}
