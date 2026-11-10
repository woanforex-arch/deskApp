<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Branch;
use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\Department;
use App\Models\Project;
use App\Services\Accounting\LedgerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function __construct(private readonly LedgerService $ledger) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'budget_id' => ['nullable', 'integer', 'exists:budgets,id'],
            'fiscal_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        $budgets = Budget::query()
            ->with(['branch:id,name', 'department:id,name', 'project:id,name'])
            ->withCount('lines')
            ->orderByDesc('fiscal_year')
            ->orderBy('name')
            ->get()
            ->map(fn (Budget $budget) => [
                'id' => $budget->id,
                'name' => $budget->name,
                'fiscal_year' => $budget->fiscal_year,
                'branch' => $budget->branch?->name,
                'department' => $budget->department?->name,
                'project' => $budget->project?->name,
                'status' => $budget->status,
                'lines_count' => $budget->lines_count,
                'total' => $budget->total(),
                'notes' => $budget->notes,
            ]);

        $selected = $filters['budget_id']
            ?? $budgets->firstWhere('fiscal_year', $filters['fiscal_year'] ?? null)['id']
            ?? $budgets->first()['id']
            ?? null;

        $lines = $selected
            ? BudgetLine::query()
                ->with('account:id,code,name,type')
                ->where('budget_id', $selected)
                ->orderBy('account_id')
                ->orderBy('month')
                ->get()
                ->map(fn (BudgetLine $line) => [
                    'id' => $line->id,
                    'account' => $line->account ? $line->account->code.' - '.$line->account->name : null,
                    'account_type' => $line->account?->type?->value,
                    'month' => $line->month,
                    'amount' => (float) $line->amount,
                ])
            : collect();

        $variance = $selected
            ? $this->ledger->budgetVsActual(Budget::query()->findOrFail($selected))
            : ['rows' => [], 'totals' => ['budget' => 0, 'actual' => 0, 'variance' => 0]];

        return Inertia::render('Budgets/Index', [
            'budgets' => $budgets,
            'lines' => $lines,
            'variance' => $variance,
            'selectedBudget' => $selected,
            'filters' => [
                'budget_id' => $selected,
                'fiscal_year' => $filters['fiscal_year'] ?? null,
            ],
            'stats' => [
                'budgets' => Budget::query()->count(),
                'active' => Budget::query()->where('status', 'approved')->count(),
                'budgeted' => round((float) BudgetLine::query()->sum('amount'), 2),
                'variance' => (float) ($variance['totals']['variance'] ?? 0),
            ],
            'accounts' => Account::query()->whereIn('type', ['revenue', 'expense'])->orderBy('code')->get(['id', 'code', 'name', 'type']),
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
            'projects' => Project::query()->orderBy('name')->get(['id', 'name']),
            'statuses' => ['draft', 'approved', 'locked'],
            'months' => range(1, 12),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'fiscal_year' => ['required', 'integer', 'between:2000,2100'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'status' => ['nullable', Rule::in(['draft', 'approved', 'locked'])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.account_id' => ['required', 'integer', 'exists:accounts,id'],
            'lines.*.month' => ['required', 'integer', 'between:1,12'],
            'lines.*.amount' => ['required', 'numeric', 'min:0'],
        ]);

        $budget = DB::transaction(function () use ($data): Budget {
            $budget = Budget::create([
                'name' => $data['name'],
                'fiscal_year' => $data['fiscal_year'],
                'branch_id' => $data['branch_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => auth()->id(),
            ]);

            foreach ($data['lines'] as $line) {
                $budget->lines()->create($line);
            }

            return $budget;
        });

        return back()->with('success', "Budget {$budget->name} created.");
    }

    public function status(Request $request, Budget $budget): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'approved', 'locked'])],
        ]);

        $budget->forceFill(['status' => $data['status']])->save();

        return back()->with('success', "Budget {$budget->name} marked {$data['status']}.");
    }
}
