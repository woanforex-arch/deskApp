<?php

namespace App\Http\Requests\Api;

use App\Enums\AccountType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:accounts,id', Rule::notIn([$this->route('account')?->id])],
            'code' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('accounts', 'code')->ignore($this->route('account'))],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'type' => ['sometimes', 'required', Rule::enum(AccountType::class)],
            'category' => ['nullable', 'string', 'max:60'],
            'currency' => ['nullable', 'string', 'size:3'],
            'is_control' => ['sometimes', 'boolean'],
            'opening_balance' => ['nullable', 'numeric'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'The account code ":input" is already taken. Account codes must be unique across the chart of accounts.',
        ];
    }
}
