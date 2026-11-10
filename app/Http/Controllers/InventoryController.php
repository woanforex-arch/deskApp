<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Services\Accounting\InventoryService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly PostingService $posting,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $items = InventoryItem::query()
            ->with(['inventoryAccount:id,code,name', 'cogsAccount:id,code,name'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%"));
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryItem $item) => [
                'id' => $item->id,
                'sku' => $item->sku,
                'name' => $item->name,
                'category' => $item->category,
                'unit' => $item->unit,
                'cost_method' => $item->cost_method,
                'unit_cost' => (float) $item->unit_cost,
                'quantity_on_hand' => (float) $item->quantity_on_hand,
                'reorder_level' => (float) $item->reorder_level,
                'value' => $item->value(),
                'low_stock' => $item->isLowStock(),
                'inventory_account' => $item->inventoryAccount ? $item->inventoryAccount->code.' · '.$item->inventoryAccount->name : null,
                'cogs_account' => $item->cogsAccount ? $item->cogsAccount->code.' · '.$item->cogsAccount->name : null,
                'is_active' => $item->is_active,
            ]);

        $movements = InventoryMovement::query()
            ->with(['item:id,name,sku'])
            ->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->limit(150)
            ->get()
            ->map(fn (InventoryMovement $movement) => [
                'id' => $movement->id,
                'item' => $movement->item?->name,
                'sku' => $movement->item?->sku,
                'movement_date' => $movement->movement_date?->toDateString(),
                'type' => $movement->type,
                'quantity' => (float) $movement->quantity,
                'unit_cost' => (float) $movement->unit_cost,
                'total_cost' => (float) $movement->total_cost,
                'reference' => $movement->reference,
                'notes' => $movement->notes,
            ]);

        return Inertia::render('Inventory/Index', [
            'items' => $items,
            'movements' => $movements,
            'filters' => [
                'search' => $filters['search'] ?? null,
                'category' => $filters['category'] ?? null,
            ],
            'stats' => [
                'value' => round((float) InventoryItem::query()->get()->sum(fn (InventoryItem $item) => $item->value()), 2),
                'items' => InventoryItem::query()->count(),
                'low_stock' => InventoryItem::query()->get()->filter(fn (InventoryItem $item) => $item->isLowStock())->count(),
                'movements' => InventoryMovement::query()->count(),
            ],
            'accounts' => Account::query()->whereIn('type', ['asset', 'expense'])->orderBy('code')->get(['id', 'code', 'name', 'type']),
            'categories' => InventoryItem::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'sku' => ['required', 'string', 'max:40', 'unique:inventory_items,sku'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:100'],
            'unit' => ['nullable', 'string', 'max:20'],
            'cost_method' => ['nullable', Rule::in(['weighted_average', 'fifo', 'lifo', 'standard'])],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'quantity_on_hand' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'inventory_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'cogs_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
        ]);

        InventoryItem::create([
            ...$data,
            'unit' => $data['unit'] ?? 'unit',
            'cost_method' => $data['cost_method'] ?? 'weighted_average',
            'unit_cost' => $data['unit_cost'] ?? 0,
            'quantity_on_hand' => $data['quantity_on_hand'] ?? 0,
            'reorder_level' => $data['reorder_level'] ?? 0,
            'is_active' => true,
        ]);

        return back()->with('success', 'Inventory item created.');
    }

    public function movement(Request $request, InventoryItem $inventoryItem): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['receive', 'issue', 'adjust', 'revalue'])],
            'movement_date' => ['required', 'date'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $movement = DB::transaction(function () use ($data, $inventoryItem): InventoryMovement {
            $options = [
                'movement_date' => $data['movement_date'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ];

            $movement = match ($data['type']) {
                'receive' => $this->inventory->receive($inventoryItem, (float) $data['quantity'], (float) ($data['unit_cost'] ?? $inventoryItem->unit_cost), $options),
                'issue' => $this->inventory->issue($inventoryItem, (float) $data['quantity'], $options),
                'adjust' => $this->inventory->adjust($inventoryItem, (float) $data['quantity'], $options),
                'revalue' => $this->inventory->revalue($inventoryItem, (float) $data['unit_cost'], $options),
            };

            $value = match ($data['type']) {
                'receive' => (float) $movement->total_cost,
                'issue' => -1 * (float) $movement->total_cost,
                default => (float) $movement->total_cost,
            };

            if (abs($value) > 0.004) {
                $entry = $this->posting->postInventoryAdjustment(
                    $inventoryItem->refresh(),
                    $value,
                    $data['movement_date'],
                    ucfirst($data['type']).' — '.$inventoryItem->name,
                );

                if ($entry) {
                    $movement->forceFill(['journal_entry_id' => $entry->id])->save();
                }
            }

            return $movement->refresh();
        });

        return back()->with('success', "Stock {$data['type']} recorded for {$inventoryItem->name}.");
    }
}
