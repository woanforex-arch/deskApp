<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Services\Accounting\InventoryService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly PostingService $posting,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:100'],
            'low_stock' => ['nullable', 'boolean'],
        ]);

        $items = InventoryItem::query()
            ->with(['inventoryAccount:id,code,name', 'cogsAccount:id,code,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%"));
            })
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')))
            ->orderBy('name')
            ->get()
            ->when($request->boolean('low_stock'), fn ($items) => $items->filter(fn (InventoryItem $item) => $item->isLowStock()))
            ->map(fn (InventoryItem $item) => $this->present($item))
            ->values();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
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

        $item = InventoryItem::create([
            ...$data,
            'unit' => $data['unit'] ?? 'unit',
            'cost_method' => $data['cost_method'] ?? 'weighted_average',
            'unit_cost' => $data['unit_cost'] ?? 0,
            'quantity_on_hand' => $data['quantity_on_hand'] ?? 0,
            'reorder_level' => $data['reorder_level'] ?? 0,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->present($item->load(['inventoryAccount', 'cogsAccount']))], 201);
    }

    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->load(['inventoryAccount:id,code,name', 'cogsAccount:id,code,name', 'movements' => fn ($query) => $query->orderByDesc('movement_date')->limit(100)]);

        return response()->json([
            'data' => $this->present($inventoryItem) + [
                'movements' => $inventoryItem->movements->map(fn (InventoryMovement $movement) => [
                    'id' => $movement->id,
                    'movement_date' => $movement->movement_date?->toDateString(),
                    'type' => $movement->type,
                    'quantity' => (float) $movement->quantity,
                    'unit_cost' => (float) $movement->unit_cost,
                    'total_cost' => (float) $movement->total_cost,
                    'reference' => $movement->reference,
                ]),
            ],
        ]);
    }

    public function movement(Request $request, InventoryItem $inventoryItem): JsonResponse
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

        return response()->json([
            'data' => [
                'id' => $movement->id,
                'type' => $movement->type,
                'movement_date' => $movement->movement_date?->toDateString(),
                'quantity' => (float) $movement->quantity,
                'unit_cost' => (float) $movement->unit_cost,
                'total_cost' => (float) $movement->total_cost,
                'journal_entry_id' => $movement->journal_entry_id,
                'item' => $this->present($inventoryItem->refresh()->load(['inventoryAccount', 'cogsAccount'])),
            ],
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(InventoryItem $item): array
    {
        return [
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
        ];
    }
}
