<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RecurringTransaction;
use App\Services\Accounting\RecurringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecurringTransactionController extends Controller
{
    public function __construct(private readonly RecurringService $recurring) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', Rule::in(['invoice', 'bill', 'journal'])],
        ]);

        $templates = RecurringTransaction::query()
            ->with('creator:id,name')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->orderByDesc('is_active')
            ->orderBy('next_run_at')
            ->get()
            ->map(fn (RecurringTransaction $template) => $this->present($template));

        return response()->json([
            'data' => [
                'templates' => $templates,
                'stats' => [
                    'total' => RecurringTransaction::query()->count(),
                    'active' => RecurringTransaction::query()->where('is_active', true)->count(),
                    'due' => RecurringTransaction::query()->where('is_active', true)
                        ->where(fn ($query) => $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', now()))
                        ->count(),
                    'inactive' => RecurringTransaction::query()->where('is_active', false)->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(['invoice', 'bill', 'journal'])],
            'frequency' => ['required', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
            'interval' => ['nullable', 'integer', 'between:1,12'],
            'next_run_at' => ['required', 'date'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'memo' => ['nullable', 'string', 'max:255'],
        ]);

        $template = match ($data['type']) {
            'invoice' => [
                'contact_id' => $data['contact_id'] ?? null,
                'issue_date' => now()->toDateString(),
                'due_date' => now()->addDays(30)->toDateString(),
                'status' => 'draft',
                'items' => [[
                    'description' => $data['memo'] ?? $data['name'],
                    'quantity' => 1,
                    'unit_price' => $data['amount'] ?? 0,
                    'tax_rate' => 0,
                ]],
            ],
            'bill' => [
                'contact_id' => $data['contact_id'] ?? null,
                'bill_date' => now()->toDateString(),
                'due_date' => now()->addDays(30)->toDateString(),
                'status' => 'draft',
                'items' => [[
                    'description' => $data['memo'] ?? $data['name'],
                    'quantity' => 1,
                    'unit_price' => $data['amount'] ?? 0,
                    'tax_rate' => 0,
                ]],
            ],
            default => [
                'entry_date' => now()->toDateString(),
                'memo' => $data['memo'] ?? $data['name'],
                'lines' => [],
            ],
        };

        $recurring = RecurringTransaction::create([
            'name' => $data['name'],
            'type' => $data['type'],
            'frequency' => $data['frequency'],
            'interval' => $data['interval'] ?? 1,
            'next_run_at' => $data['next_run_at'],
            'template' => $template,
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->present($recurring->refresh())], 201);
    }

    public function run(Request $request, RecurringTransaction $recurringTransaction): JsonResponse
    {
        $record = $this->recurring->run($recurringTransaction, $request->user());

        return response()->json([
            'data' => $this->present($recurringTransaction->refresh()),
            'created' => $record?->id ?? null,
            'message' => 'Recurring transaction executed.',
        ]);
    }

    public function runDue(Request $request): JsonResponse
    {
        $results = $this->recurring->runDue($request->user());

        return response()->json([
            'data' => [
                'executed' => count($results),
                'created_ids' => array_values(array_filter(array_map(fn ($record) => $record?->id ?? null, $results))),
            ],
            'message' => count($results).' due recurring transaction(s) executed.',
        ]);
    }

    public function toggle(RecurringTransaction $recurringTransaction): JsonResponse
    {
        $recurringTransaction->forceFill(['is_active' => ! $recurringTransaction->is_active])->save();

        return response()->json(['data' => $this->present($recurringTransaction->refresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(RecurringTransaction $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'type' => $template->type,
            'frequency' => $template->frequency,
            'interval' => $template->interval,
            'next_run_at' => $template->next_run_at?->toIso8601String(),
            'last_run_at' => $template->last_run_at?->toIso8601String(),
            'is_active' => $template->is_active,
            'creator' => $template->creator?->name,
            'template' => $template->template,
        ];
    }
}
