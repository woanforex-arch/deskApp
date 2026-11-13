<?php

namespace App\Http\Requests\Api;

use Illuminate\Validation\Rule;

class UpdateInvoiceRequest extends StoreInvoiceRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $invoice = $this->route('invoice');

        $rules['number'] = [
            'nullable',
            'string',
            'max:40',
            Rule::unique('invoices', 'number')->ignore($invoice?->id),
        ];

        return $rules;
    }
}
