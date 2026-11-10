<?php

namespace App\Http\Requests\Api;

use App\Enums\JournalEntryStatus;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreJournalEntryRequest extends FormRequest
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
            'reference' => ['nullable', 'string', 'max:40', 'unique:journal_entries,reference'],
            'entry_date' => ['required', 'date'],
            'memo' => ['required', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in([JournalEntryStatus::Draft->value, JournalEntryStatus::Posted->value])],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_id' => ['required', 'integer', 'exists:accounts,id'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.credit' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $input = $this->input('lines', []);
            $lines = is_array($input) ? collect($input) : collect();

            $totalDebit = round($lines->sum(fn (array $line) => (float) ($line['debit'] ?? 0)), 2);
            $totalCredit = round($lines->sum(fn (array $line) => (float) ($line['credit'] ?? 0)), 2);

            if ($totalDebit <= 0) {
                $validator->errors()->add('lines', 'A journal entry must contain at least one debit.');
            }

            if (abs($totalDebit - $totalCredit) >= 0.005) {
                $validator->errors()->add('lines', 'Total debits and credits must balance.');
            }

            $lines->each(function (array $line, int $index) use ($validator): void {
                $debit = (float) ($line['debit'] ?? 0);
                $credit = (float) ($line['credit'] ?? 0);

                if (($debit > 0 && $credit > 0) || ($debit <= 0 && $credit <= 0)) {
                    $validator->errors()->add(
                        "lines.{$index}.debit",
                        'Each line must contain either a debit or a credit, but not both.',
                    );
                }
            });
        });
    }
}
