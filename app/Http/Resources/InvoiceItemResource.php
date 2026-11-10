<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'quantity' => (float) $this->quantity,
            'unit_price' => (float) $this->unit_price,
            'tax_rate' => (float) $this->tax_rate,
            'amount' => (float) $this->amount,
            'tax_amount' => (float) $this->tax_amount,
            'total' => (float) $this->total,
            'account_id' => $this->account_id,
            'account' => $this->whenLoaded('account', fn ($account) => (new AccountResource($account))->resolve($request)),
        ];
    }
}
