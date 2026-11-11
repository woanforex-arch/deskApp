<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Bill;
use App\Models\Contact;
use App\Models\VendorPayment;
use App\Services\Accounting\CurrencyService;
use App\Services\Accounting\PayablesService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VendorPaymentController extends Controller
{
    public function __construct(
        private readonly PayablesService $payables,
        private readonly PostingService $posting,
        private readonly CurrencyService $currency,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', Rule::in(['bank_transfer', 'cash', 'card', 'cheque', 'other'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'sort' => ['nullable', Rule::in(['paid_on', 'reference', 'amount'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $sort = $filters['sort'] ?? 'paid_on';
        $direction = $filters['direction'] ?? 'desc';

        $payments = VendorPayment::query()
            ->with(['contact', 'bill'])
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhereHas('contact', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })
            ->when($filters['method'] ?? null, fn ($query, $method) => $query->where('method', $method))
            ->when($filters['from'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '>=', $date))
            ->when($filters['to'] ?? null, fn ($query, $date) => $query->whereDate('paid_on', '<=', $date))
            ->orderBy($sort, $direction)
            ->orderBy('id', $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (VendorPayment $payment) => [
                'id' => $payment->id,
                'paid_on' => $payment->paid_on?->toDateString(),
                'contact' => $payment->contact?->name,
                'bill' => $payment->bill?->number,
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency,
                'method' => $payment->method,
                'reference' => $payment->reference,
            ]);

        return Inertia::render('VendorPayments/Index', [
            'payments' => $payments,
            'filters' => [
                'search' => $filters['search'] ?? null,
                'method' => $filters['method'] ?? null,
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'stats' => [
                'total' => round((float) VendorPayment::query()->sum('amount'), 2),
                'month' => round((float) VendorPayment::query()->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'), 2),
                'count' => VendorPayment::query()->count(),
                'outstanding_bills' => round((float) Bill::query()->open()->sum(DB::raw('total - amount_paid')), 2),
            ],
            'vendors' => Contact::query()->vendors()->orderBy('name')->get(['id', 'name']),
            'bills' => Bill::query()->open()->with('contact:id,name')->orderBy('due_date')->get(['id', 'number', 'contact_id', 'total', 'amount_paid', 'currency']),
            'bankAccounts' => BankAccount::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'currency']),
            'methods' => ['bank_transfer', 'cash', 'card', 'cheque', 'other'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bill_id' => ['nullable', 'integer', 'exists:bills,id'],
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'paid_on' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', Rule::in(['bank_transfer', 'cash', 'card', 'cheque', 'other'])],
            'reference' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        if (! empty($data['bill_id'])) {
            $this->payables->recordPayment(Bill::query()->findOrFail($data['bill_id']), $data);

            return back()->with('success', 'Vendor payment recorded and posted to the ledger.');
        }

        $payment = DB::transaction(function () use ($data): VendorPayment {
            $currency = $data['currency'] ?? $this->currency->baseCurrency();
            $payment = VendorPayment::create([
                'contact_id' => $data['contact_id'],
                'paid_on' => $data['paid_on'],
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'bank_account_id' => $data['bank_account_id'] ?? null,
                'currency' => $currency,
                'exchange_rate' => $this->currency->rate($currency, $data['paid_on']),
                'created_by' => auth()->id(),
            ]);

            $this->posting->postVendorPayment($payment->refresh());

            return $payment->refresh();
        });

        return back()->with('success', "Vendor payment {$payment->reference} posted.");
    }
}
