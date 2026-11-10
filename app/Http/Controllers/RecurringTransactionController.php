<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\RecurringTransaction;
use App\Services\Accounting\RecurringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RecurringTransactionController extends Controller
{
    public function __construct(private readonly RecurringService $recurring) {}

    public function index(): Response
    {
        $templates = RecurringTransaction::query()
            ->with('creator:id,name')
            ->orderByDesc('is_active')
            ->orderBy('next_run_at')
            ->get()
            ->map(fn (RecurringTransaction $template) => [
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
            ]);

        return Inertia::render('RecurringTransactions/Index', [
            'templates' => $templates,
            'stats' => [
                'total' => RecurringTransaction::query()->count(),
                'active' => RecurringTransaction::query()->where('is_active', true)->count(),
                'due' => RecurringTransaction::query()->where('is_active', true)
                    ->where(fn ($query) => $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', now()))
                    ->count(),
                'inactive' => RecurringTransaction::query()->where('is_active', false)->count(),
            ],
            'customers' => Contact::query()->customers()->orderBy('name')->get(['id', 'name']),
            'vendors' => Contact::query()->vendors()->orderBy('name')->get(['id', 'name']),
            'types' => ['invoice', 'bill', 'journal'],
            'frequencies' => ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
        ]);
    }

    public function store(Request $request): RedirectResponse
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

        RecurringTransaction::create([
            'name' => $data['name'],
            'type' => $data['type'],
            'frequency' => $data['frequency'],
            'interval' => $data['interval'] ?? 1,
            'next_run_at' => $data['next_run_at'],
            'template' => $template,
            'is_active' => true,
            'created_by' => auth()->id(),
        ]);

        return back()->with('success', 'Recurring transaction scheduled.');
    }

    public function run(Request $request, RecurringTransaction $recurringTransaction): RedirectResponse
    {
        $this->recurring->run($recurringTransaction, $request->user());

        return back()->with('success', "Recurring transaction {$recurringTransaction->name} executed.");
    }

    public function runDue(Request $request): RedirectResponse
    {
        $results = $this->recurring->runDue($request->user());

        return back()->with('success', count($results).' due recurring transaction(s) executed.');
    }

    public function toggle(RecurringTransaction $recurringTransaction): RedirectResponse
    {
        $recurringTransaction->forceFill(['is_active' => ! $recurringTransaction->is_active])->save();

        return back()->with('success', "{$recurringTransaction->name} ".($recurringTransaction->is_active ? 'activated' : 'paused').'.');
    }
}
