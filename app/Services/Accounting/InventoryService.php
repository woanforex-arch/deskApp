<?php

namespace App\Services\Accounting;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;

class InventoryService
{
    /**
     * Receive stock using a moving weighted-average cost.
     *
     * @param  array<string, mixed>  $options
     */
    public function receive(InventoryItem $item, float $quantity, float $unitCost, array $options = []): InventoryMovement
    {
        $oldQuantity = (float) $item->quantity_on_hand;
        $oldCost = (float) $item->unit_cost;
        $newQuantity = $oldQuantity + $quantity;
        $newCost = $newQuantity > 0
            ? (($oldQuantity * $oldCost) + ($quantity * $unitCost)) / $newQuantity
            : $unitCost;

        $item->forceFill([
            'quantity_on_hand' => round($newQuantity, 4),
            'unit_cost' => round($newCost, 4),
        ])->save();

        return $item->movements()->create([
            'movement_date' => $options['movement_date'] ?? today()->toDateString(),
            'type' => $options['type'] ?? 'purchase',
            'quantity' => $quantity,
            'unit_cost' => round($unitCost, 4),
            'total_cost' => round($quantity * $unitCost, 2),
            'reference' => $options['reference'] ?? null,
            'notes' => $options['notes'] ?? null,
            'journal_entry_id' => $options['journal_entry_id'] ?? null,
            'created_by' => $options['created_by'] ?? auth()->id(),
        ]);
    }

    /**
     * Issue stock at the current weighted-average cost.
     *
     * @param  array<string, mixed>  $options
     */
    public function issue(InventoryItem $item, float $quantity, array $options = []): InventoryMovement
    {
        $unitCost = (float) ($options['unit_cost'] ?? $item->unit_cost);
        $newQuantity = (float) $item->quantity_on_hand - $quantity;

        $item->forceFill([
            'quantity_on_hand' => round($newQuantity, 4),
        ])->save();

        return $item->movements()->create([
            'movement_date' => $options['movement_date'] ?? today()->toDateString(),
            'type' => $options['type'] ?? 'sale',
            'quantity' => -1 * $quantity,
            'unit_cost' => round($unitCost, 4),
            'total_cost' => round($quantity * $unitCost, 2),
            'reference' => $options['reference'] ?? null,
            'notes' => $options['notes'] ?? null,
            'journal_entry_id' => $options['journal_entry_id'] ?? null,
            'created_by' => $options['created_by'] ?? auth()->id(),
        ]);
    }

    /**
     * Adjust the on-hand quantity and post the valuation movement.
     *
     * @param  array<string, mixed>  $options
     */
    public function adjust(InventoryItem $item, float $newQuantity, array $options = []): InventoryMovement
    {
        $oldQuantity = (float) $item->quantity_on_hand;
        $delta = $newQuantity - $oldQuantity;
        $unitCost = (float) ($options['unit_cost'] ?? $item->unit_cost);

        $item->forceFill(['quantity_on_hand' => round($newQuantity, 4)])->save();

        return $item->movements()->create([
            'movement_date' => $options['movement_date'] ?? today()->toDateString(),
            'type' => 'adjustment',
            'quantity' => round($delta, 4),
            'unit_cost' => round($unitCost, 4),
            'total_cost' => round($delta * $unitCost, 2),
            'reference' => $options['reference'] ?? null,
            'notes' => $options['notes'] ?? null,
            'journal_entry_id' => $options['journal_entry_id'] ?? null,
            'created_by' => $options['created_by'] ?? auth()->id(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $options
     */
    public function revalue(InventoryItem $item, float $unitCost, array $options = []): InventoryMovement
    {
        $quantity = (float) $item->quantity_on_hand;
        $oldValue = $quantity * (float) $item->unit_cost;
        $newValue = $quantity * $unitCost;

        $item->forceFill(['unit_cost' => round($unitCost, 4)])->save();

        return $item->movements()->create([
            'movement_date' => $options['movement_date'] ?? today()->toDateString(),
            'type' => 'revaluation',
            'quantity' => 0,
            'unit_cost' => round($unitCost, 4),
            'total_cost' => round($newValue - $oldValue, 2),
            'reference' => $options['reference'] ?? null,
            'notes' => $options['notes'] ?? 'Stock revaluation',
            'journal_entry_id' => $options['journal_entry_id'] ?? null,
            'created_by' => $options['created_by'] ?? auth()->id(),
        ]);
    }
}
