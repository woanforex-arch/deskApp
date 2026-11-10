<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JournalEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'entry_date' => $this->entry_date?->toDateString(),
            'memo' => $this->memo,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'posted_at' => $this->posted_at?->toIso8601String(),
            'total_debit' => $this->totalDebit(),
            'total_credit' => $this->totalCredit(),
            'is_balanced' => $this->isBalanced(),
            'lines' => $this->whenLoaded('lines', fn ($lines) => JournalLineResource::collection($lines)->resolve($request)),
            'creator' => $this->whenLoaded('creator', fn ($creator) => (new UserResource($creator))->resolve($request)),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
