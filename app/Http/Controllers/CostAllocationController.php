<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\CostAllocation;
use App\Models\CostCenter;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CostAllocationController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(): Response
    {
        $allocations = CostAllocation::query()
            ->with(['source:id,name,code', 'target:id,name,code', 'account:id,code,name'])
            ->orderBy('name')
            ->get()
            ->map(fn (CostAllocation $allocation) => [
                'id' => $allocation->id,
                'name' => $allocation->name,
                'source' => $allocation->source ? $allocation->source->code.' - '.$allocation->source->name : null,
                'target' => $allocation->target ? $allocation->target->code.' - '.$allocation->target->name : null,
                'account' => $allocation->account ? $allocation->account->code.' - '.$allocation->account->name : null,
                'percentage' => (float) $allocation->percentage,
                'basis' => $allocation->basis,
                'is_active' => $allocation->is_active,
            ]);

        return Inertia::render('CostAllocations/Index', [
            'allocations' => $allocations,
            'stats' => [
                'total' => CostAllocation::query()->count(),
                'active' => CostAllocation::query()->where('is_active', true)->count(),
                'cost_centers' => CostCenter::query()->count(),
                'percentage' => round((float) CostAllocation::query()->where('is_active', true)->sum('percentage'), 2),
            ],
            'costCenters' => CostCenter::query()->orderBy('name')->get(['id', 'code', 'name']),
            'accounts' => Account::query()->whereIn('type', ['expense', 'asset'])->orderBy('code')->get(['id', 'code', 'name']),
            'bases' => ['percentage', 'headcount', 'revenue', 'usage'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'source_cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
            'target_cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
            'account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'percentage' => ['required', 'numeric', 'between:0,100'],
            'basis' => ['required', Rule::in(['percentage', 'headcount', 'revenue', 'usage'])],
        ]);

        CostAllocation::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Cost allocation rule created.');
    }

    public function run(Request $request, CostAllocation $costAllocation): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'allocation_date' => ['required', 'date'],
        ]);

        $this->posting->postCostAllocation($costAllocation, (float) $data['amount'], $data['allocation_date'], $request->user());

        return back()->with('success', "Cost allocation {$costAllocation->name} posted.");
    }
}
