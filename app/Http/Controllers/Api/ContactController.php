<?php

namespace App\Http\Controllers\Api;

use App\Enums\ContactType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreContactRequest;
use App\Http\Requests\Api\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ContactController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'type' => ['nullable', Rule::enum(ContactType::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $contacts = Contact::query()
            ->withCount('invoices')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%"));
            })
            ->orderBy('name')
            ->paginate($request->integer('per_page', 25));

        return ContactResource::collection($contacts);
    }

    public function store(StoreContactRequest $request): JsonResponse
    {
        $contact = Contact::create($request->validated());

        return (new ContactResource($contact))->response()->setStatusCode(201);
    }

    public function show(Contact $contact): ContactResource
    {
        $contact->loadCount('invoices');

        return new ContactResource($contact);
    }

    public function update(UpdateContactRequest $request, Contact $contact): ContactResource
    {
        $contact->update($request->validated());

        return new ContactResource($contact->refresh());
    }

    public function destroy(Contact $contact): JsonResponse
    {
        if ($contact->invoices()->exists() || $contact->payments()->exists()) {
            return response()->json([
                'message' => 'This contact cannot be deleted because it has invoices or payments.',
            ], 422);
        }

        $contact->delete();

        return response()->json(null, 204);
    }
}
