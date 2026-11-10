<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DepreciationEntry;
use App\Models\FixedAsset;
use App\Services\Accounting\AssetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FixedAssetController extends Controller
{
    public function __construct(private readonly AssetService $assets) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $assets = FixedAsset::query()
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')))
            ->orderBy('name')
            ->get()
            ->map(fn (FixedAsset $asset) => $this->present($asset));

        return response()->json([
            'data' => $assets,
            'meta' => [
                'cost' => round((float) FixedAsset::query()->sum('cost'), 2),
                'book_value' => round((float) FixedAsset::query()->sum('book_value'), 2),
                'accumulated_depreciation' => round((float) FixedAsset::query()->sum('accumulated_depreciation'), 2),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
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

        return response()->json(['data' => $this->present($asset)], 201);
    }

    public function show(FixedAsset $fixedAsset): JsonResponse
    {
        $fixedAsset->load(['depreciationEntries' => fn ($query) => $query->orderByDesc('depreciation_date'), 'revaluations']);

        return response()->json([
            'data' => $this->present($fixedAsset) + [
                'depreciation_entries' => $fixedAsset->depreciationEntries->map(fn (DepreciationEntry $entry) => [
                    'id' => $entry->id,
                    'period' => $entry->period,
                    'depreciation_date' => $entry->depreciation_date?->toDateString(),
                    'amount' => (float) $entry->amount,
                    'accumulated_after' => (float) $entry->accumulated_after,
                ]),
                'revaluations' => $fixedAsset->revaluations->map(fn ($revaluation) => [
                    'id' => $revaluation->id,
                    'revaluation_date' => $revaluation->revaluation_date?->toDateString(),
                    'old_value' => (float) $revaluation->old_value,
                    'new_value' => (float) $revaluation->new_value,
                    'adjustment' => (float) $revaluation->adjustment,
                ]),
            ],
        ]);
    }

    public function depreciate(Request $request, FixedAsset $fixedAsset): JsonResponse
    {
        $data = $request->validate([
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'depreciation_date' => ['nullable', 'date'],
        ]);

        $asset = $this->assets->depreciate($fixedAsset, $data['period'], $data['depreciation_date'] ?? null, $request->user());

        return response()->json([
            'message' => $asset ? 'Depreciation posted.' : 'No depreciation was required.',
            'data' => $asset ? $this->present($asset) : null,
        ]);
    }

    public function dispose(Request $request, FixedAsset $fixedAsset): JsonResponse
    {
        $data = $request->validate([
            'proceeds' => ['required', 'numeric', 'min:0'],
            'disposal_date' => ['required', 'date'],
        ]);

        $asset = $this->assets->dispose($fixedAsset, (float) $data['proceeds'], $data['disposal_date'], $request->user());

        return response()->json(['message' => 'Asset disposed.', 'data' => $this->present($asset)]);
    }

    public function revalue(Request $request, FixedAsset $fixedAsset): JsonResponse
    {
        $data = $request->validate([
            'new_value' => ['required', 'numeric', 'min:0'],
            'revaluation_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $asset = $this->assets->revalue($fixedAsset, (float) $data['new_value'], $data['revaluation_date'], $data['notes'] ?? null, $request->user());

        return response()->json(['message' => 'Asset revalued.', 'data' => $this->present($asset)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(FixedAsset $asset): array
    {
        return [
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
            'disposed_at' => $asset->disposed_at?->toIso8601String(),
            'disposal_proceeds' => (float) $asset->disposal_proceeds,
            'gain_loss' => (float) $asset->gain_loss,
        ];
    }
}
