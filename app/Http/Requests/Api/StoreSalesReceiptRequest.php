<?php

namespace App\Http\Requests\Api;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSalesReceiptRequest extends FormRequest
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
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'customer_name' => ['nullable', 'string', 'max:255', 'required_without:contact_id'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'number' => ['nullable', 'string', 'max:40', 'unique:invoices,number'],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'status' => ['sometimes', Rule::in([InvoiceStatus::Draft->value, InvoiceStatus::Sent->value])],
            'currency' => ['sometimes', 'string', 'size:3'],
            'terms' => ['nullable', 'string', 'max:255'],
            'ship_to' => ['nullable', 'string', 'max:255'],
            'salesperson' => ['nullable', 'string', 'max:255'],
            'ship_via' => ['nullable', 'string', 'max:100'],
            'promised_date' => ['nullable', 'date'],
            'delivery_status' => ['nullable', 'string', 'max:40'],
            'sales_type' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'between:0,100'],
            'payment.amount' => ['nullable', 'numeric', 'min:0'],
            'payment.paid_on' => ['nullable', 'date'],
            'payment.method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'payment.reference' => ['nullable', 'string', 'max:255'],
            'payment.notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
