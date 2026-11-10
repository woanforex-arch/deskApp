<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'fiscal_year' => ['nullable', 'integer', 'between:2000,2100'],
            'status' => ['nullable', 'string', 'max:20'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $budgets = Budget::query()
            ->withCount('lines')
            ->when($request->filled('fiscal_year'), fn ($query) => $query->where('fiscal_year', $request->integer('fiscal_year')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderByDesc('fiscal_year')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 25))
            ->through(fn (Budget $budget) => $this->present($budget));

        return response()->json($budgets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'fiscal_year' => ['required', 'integer', 'between:2000,2100'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'status' => ['nullable', Rule::in(['draft', 'approved', 'archived'])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.account_id' => ['required', 'integer', 'exists:accounts,id'],
            'lines.*.month' => ['required', 'integer', 'between:1,12'],
            'lines.*.amount' => ['required', 'numeric'],
        ]);

        $budget = Budget::create([
            'name' => $data['name'],
            'fiscal_year' => $data['fiscal_year'],
            'branch_id' => $data['branch_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'project_id' => $data['project_id'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        foreach ($data['lines'] as $line) {
            $budget->lines()->create([
                'account_id' => $line['account_id'],
                'month' => $line['month'],
                'amount' => $line['amount'],
            ]);
        }

        return response()->json(['data' => $this->present($budget->refresh()->load('lines.account'))], 201);
    }

    public function show(Budget $budget): JsonResponse
    {
        $budget->load(['lines.account:id,code,name,type', 'branch:id,name', 'department:id,name', 'project:id,name']);

        return response()->json([
            'data' => $this->present($budget) + [
                'lines' => $budget->lines->map(fn (BudgetLine $line) => [
                    'id' => $line->id,
                    'account_id' => $line->account_id,
                    'account' => $line->account ? $line->account->code.' · '.$line->account->name : null,
                    'type' => $line->account?->type?->value ?? $line->account?->type,
                    'month' => $line->month,
                    'amount' => (float) $line->amount,
                ]),
            ],
        ]);
    }

    public function status(Request $request, Budget $budget): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'approved', 'archived'])],
        ]);

        $budget->update(['status' => $data['status']]);

        return response()->json(['data' => $this->present($budget->refresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Budget $budget): array
    {
        return [
            'id' => $budget->id,
            'name' => $budget->name,
            'fiscal_year' => $budget->fiscal_year,
            'status' => $budget->status,
            'branch' => $budget->relationLoaded('branch') ? $budget->branch?->name : null,
            'department' => $budget->relationLoaded('department') ? $budget->department?->name : null,
            'project' => $budget->relationLoaded('project') ? $budget->project?->name : null,
            'notes' => $budget->notes,
            'total' => $budget->total(),
            'lines_count' => $budget->lines_count ?? $budget->lines()->count(),
        ];
    }
}
