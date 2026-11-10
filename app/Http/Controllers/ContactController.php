<?php

namespace App\Http\Controllers;

use App\Enums\ContactType;
use App\Enums\InvoiceStatus;
use App\Http\Requests\Api\StoreContactRequest;
use App\Http\Requests\Api\UpdateContactRequest;
use App\Models\Contact;
use App\Models\Invoice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::enum(ContactType::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $openStatuses = [InvoiceStatus::Sent->value, InvoiceStatus::Overdue->value];

        $contacts = Contact::query()
            ->withCount('invoices')
            ->withSum(['invoices as open_total' => fn ($query) => $query->whereIn('status', $openStatuses)], 'total')
            ->withSum(['invoices as open_paid' => fn ($query) => $query->whereIn('status', $openStatuses)], 'amount_paid')
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%"));
            })
            ->orderBy('name')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Contact $contact) => [
                'id' => $contact->id,
                'name' => $contact->name,
                'email' => $contact->email,
                'phone' => $contact->phone,
                'type' => $contact->type->value,
                'type_label' => $contact->type->label(),
                'tax_number' => $contact->tax_number,
                'address' => $contact->address,
                'city' => $contact->city,
                'country' => $contact->country,
                'notes' => $contact->notes,
                'invoices_count' => $contact->invoices_count,
                'outstanding' => round((float) $contact->open_total - (float) $contact->open_paid, 2),
                'is_active' => $contact->is_active,
            ]);

        return Inertia::render('Contacts/Index', [
            'contacts' => $contacts,
            'filters' => [
                'type' => $filters['type'] ?? null,
                'search' => $filters['search'] ?? null,
            ],
            'stats' => [
                'customers' => Contact::query()->customers()->count(),
                'vendors' => Contact::query()->vendors()->count(),
                'active' => Contact::query()->active()->count(),
                'outstanding' => round(
                    (float) Invoice::query()->open()->sum('total') -
                    (float) Invoice::query()->open()->sum('amount_paid'),
                    2,
                ),
            ],
            'types' => collect(ContactType::cases())
                ->map(fn (ContactType $type) => ['value' => $type->value, 'label' => $type->label()])
                ->values(),
        ]);
    }

    public function store(StoreContactRequest $request): RedirectResponse
    {
        $contact = Contact::create($request->validated());

        return redirect()
            ->route('contacts.index')
            ->with('success', "Contact {$contact->name} created.");
    }

    public function update(UpdateContactRequest $request, Contact $contact): RedirectResponse
    {
        $contact->update($request->validated());

        return redirect()
            ->route('contacts.index')
            ->with('success', "Contact {$contact->name} updated.");
    }

    public function destroy(Contact $contact): RedirectResponse
    {
        if ($contact->invoices()->exists() || $contact->payments()->exists() || $contact->bills()->exists() || $contact->creditNotes()->exists()) {
            return back()->with('error', 'This contact cannot be deleted because it has transactions.');
        }

        $contact->delete();

        return redirect()
            ->route('contacts.index')
            ->with('success', 'Contact deleted.');
    }
}
