<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'currency' => $this->currency,
            'issue_date' => $this->issue_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'ship_to' => $this->ship_to,
            'salesperson' => $this->salesperson,
            'ship_via' => $this->ship_via,
            'promised_date' => $this->promised_date?->toDateString(),
            'delivery_status' => $this->delivery_status,
            'subtotal' => (float) $this->subtotal,
            'tax_total' => (float) $this->tax_total,
            'total' => (float) $this->total,
            'amount_paid' => (float) $this->amount_paid,
            'balance_due' => $this->balanceDue(),
            'notes' => $this->notes,
            'terms' => $this->terms,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'last_reminded_at' => $this->last_reminded_at?->toIso8601String(),
            'contact' => $this->whenLoaded('contact', fn ($contact) => (new ContactResource($contact))->resolve($request)),
            'items' => $this->whenLoaded('items', fn ($items) => InvoiceItemResource::collection($items)->resolve($request)),
            'payments' => $this->whenLoaded('payments', fn ($payments) => PaymentResource::collection($payments)->resolve($request)),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
