<?php

namespace App\Http\Requests\Api;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVendorExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $items = collect($this->input('items', []))
            ->filter(fn ($item) => is_array($item) && trim((string) ($item['description'] ?? '')) !== '')
            ->values()
            ->all();

        $this->merge(['items' => $items]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id', 'required_without:vendor_name'],
            'vendor_name' => ['nullable', 'string', 'max:255', 'required_without:contact_id'],
            'vendor_email' => ['nullable', 'email', 'max:255'],
            'vendor_phone' => ['nullable', 'string', 'max:40'],
            'number' => ['nullable', 'string', 'max:40', Rule::unique('bills', 'number')],
            'bill_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:bill_date'],
            'status' => ['sometimes', Rule::in(['draft', 'approved'])],
            'currency' => ['sometimes', 'string', 'size:3'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
            'payment.amount' => ['nullable', 'numeric', 'min:0'],
            'payment.paid_on' => ['nullable', 'date'],
            'payment.method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'payment.reference' => ['nullable', 'string', 'max:255'],
            'payment.notes' => ['nullable', 'string', 'max:2000'],
            'payment.bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ];
    }
}
