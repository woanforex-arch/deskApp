<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAccountRequest;
use App\Http\Requests\Api\UpdateAccountRequest;
use App\Http\Resources\AccountResource;
use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'type' => ['nullable', Rule::enum(AccountType::class)],
            'category' => ['nullable', 'string', 'max:60'],
            'search' => ['nullable', 'string', 'max:100'],
            'active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $accounts = Account::query()
            ->withSum('journalLines as total_debit', 'debit')
            ->withSum('journalLines as total_credit', 'credit')
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->when($request->filled('category'), fn ($query) => $query->where('category', $request->string('category')))
            ->when($request->filled('active'), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%"));
            })
            ->orderBy('code')
            ->paginate($request->integer('per_page', 50));

        return AccountResource::collection($accounts);
    }

    public function store(StoreAccountRequest $request): JsonResponse
    {
        $account = Account::create($request->validated());

        return (new AccountResource($account))->response()->setStatusCode(201);
    }

    public function show(Account $account): AccountResource
    {
        $account->load('parent', 'children')
            ->loadSum('journalLines as total_debit', 'debit')
            ->loadSum('journalLines as total_credit', 'credit');

        return new AccountResource($account);
    }

    public function update(UpdateAccountRequest $request, Account $account): AccountResource
    {
        $account->update($request->validated());

        return new AccountResource($account->refresh());
    }

    public function destroy(Account $account): JsonResponse
    {
        if ($account->children()->exists() || $account->journalLines()->exists() || $account->invoiceItems()->exists()) {
            return response()->json([
                'message' => 'This account cannot be deleted because it has child accounts or posted transactions.',
            ], 422);
        }

        $account->delete();

        return response()->json(null, 204);
    }
}
