<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\DepreciationEntry;
use App\Models\FixedAsset;
use App\Services\Accounting\AssetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FixedAssetController extends Controller
{
    public function __construct(private readonly AssetService $assets) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $assets = FixedAsset::query()
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->orderBy('name')
            ->get()
            ->map(fn (FixedAsset $asset) => [
                'id' => $asset->id,
                'code' => $asset->code,
                'name' => $asset->name,
                'category' => $asset->category,
                'purchase_date' => $asset->purchase_date?->toDateString(),
                'cost' => (float) $asset->cost,
                'salvage_value' => (float) $asset->salvage_value,
                'useful_life_years' => $asset->useful_life_years,
                'depreciation_method' => $asset->depreciation_method,
                'monthly_depreciation' => $asset->monthlyDepreciation(),
                'accumulated_depreciation' => (float) $asset->accumulated_depreciation,
                'book_value' => (float) $asset->book_value,
                'status' => $asset->status,
                'location' => $asset->location,
                'assigned_to' => $asset->assigned_to,
                'gain_loss' => (float) $asset->gain_loss,
                'notes' => $asset->notes,
            ]);

        $depreciation = DepreciationEntry::query()
            ->with('asset:id,name,code')
            ->orderByDesc('depreciation_date')
            ->limit(100)
            ->get()
            ->map(fn (DepreciationEntry $entry) => [
                'id' => $entry->id,
                'asset' => $entry->asset?->name,
                'code' => $entry->asset?->code,
                'period' => $entry->period,
                'depreciation_date' => $entry->depreciation_date?->toDateString(),
                'amount' => (float) $entry->amount,
                'accumulated_after' => (float) $entry->accumulated_after,
            ]);

        return Inertia::render('FixedAssets/Index', [
            'assets' => $assets,
            'depreciation' => $depreciation,
            'filters' => [
                'status' => $filters['status'] ?? null,
                'category' => $filters['category'] ?? null,
            ],
            'stats' => [
                'cost' => round((float) FixedAsset::query()->sum('cost'), 2),
                'book_value' => round((float) FixedAsset::query()->sum('book_value'), 2),
                'accumulated' => round((float) FixedAsset::query()->sum('accumulated_depreciation'), 2),
                'active' => FixedAsset::query()->where('status', 'active')->count(),
                'disposed' => FixedAsset::query()->where('status', 'disposed')->count(),
            ],
            'categories' => FixedAsset::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
            'accounts' => Account::query()->whereIn('type', ['asset', 'expense'])->orderBy('code')->get(['id', 'code', 'name']),
            'statuses' => ['active', 'disposed', 'written_off'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:40', 'unique:fixed_assets,code'],
            'category' => ['nullable', 'string', 'max:100'],
            'purchase_date' => ['required', 'date'],
            'cost' => ['required', 'numeric', 'min:0'],
            'salvage_value' => ['nullable', 'numeric', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'between:1,50'],
            'depreciation_method' => ['nullable', Rule::in(['straight_line', 'declining_balance'])],
            'location' => ['nullable', 'string', 'max:120'],
            'assigned_to' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $asset = $this->assets->create($data);

        return back()->with('success', "Fixed asset {$asset->code} registered.");
    }

    public function depreciate(Request $request, FixedAsset $fixedAsset): RedirectResponse
    {
        $data = $request->validate([
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'depreciation_date' => ['nullable', 'date'],
        ]);

        $this->assets->depreciate($fixedAsset, $data['period'], $data['depreciation_date'] ?? null, $request->user());

        return back()->with('success', "Depreciation posted for {$fixedAsset->name} ({$data['period']}).");
    }

    public function dispose(Request $request, FixedAsset $fixedAsset): RedirectResponse
    {
        $data = $request->validate([
            'proceeds' => ['required', 'numeric', 'min:0'],
            'disposal_date' => ['required', 'date'],
        ]);

        $this->assets->dispose($fixedAsset, (float) $data['proceeds'], $data['disposal_date'], $request->user());

        return back()->with('success', "{$fixedAsset->name} disposed and posted.");
    }

    public function revalue(Request $request, FixedAsset $fixedAsset): RedirectResponse
    {
        $data = $request->validate([
            'new_value' => ['required', 'numeric', 'min:0'],
            'revaluation_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->assets->revalue($fixedAsset, (float) $data['new_value'], $data['revaluation_date'], $data['notes'] ?? null, $request->user());

        return back()->with('success', "{$fixedAsset->name} revalued.");
    }
}
