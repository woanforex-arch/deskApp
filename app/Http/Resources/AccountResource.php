<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'normal_balance' => $this->normalBalance()->value,
            'parent_id' => $this->parent_id,
            'category' => $this->category,
            'currency' => $this->currency,
            'is_control' => (bool) $this->is_control,
            'opening_balance' => (float) $this->opening_balance,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'balance' => $this->balance(),
            'parent' => $this->whenLoaded('parent', fn () => $this->parent ? (new self($this->parent))->resolve($request) : null),
            'children' => $this->whenLoaded('children', fn ($children) => self::collection($children)->resolve($request)),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
