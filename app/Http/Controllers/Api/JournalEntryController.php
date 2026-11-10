<?php

namespace App\Http\Controllers\Api;

use App\Enums\JournalEntryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreJournalEntryRequest;
use App\Http\Resources\JournalEntryResource;
use App\Models\JournalEntry;
use App\Services\Accounting\JournalEntryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class JournalEntryController extends Controller
{
    public function __construct(private readonly JournalEntryService $journalEntries) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(JournalEntryStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $entries = JournalEntry::query()
            ->withCount('lines')
            ->withSum('lines as total_debit', 'debit')
            ->withSum('lines as total_credit', 'credit')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('entry_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('entry_date', '<=', $request->date('to')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('memo', 'like', "%{$search}%"));
            })
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return JournalEntryResource::collection($entries);
    }

    public function store(StoreJournalEntryRequest $request): JsonResponse
    {
        $entry = $this->journalEntries->create($request->validated(), $request->user());

        return (new JournalEntryResource($entry))->response()->setStatusCode(201);
    }

    public function show(JournalEntry $journalEntry): JournalEntryResource
    {
        $journalEntry->load(['lines.account', 'creator']);

        return new JournalEntryResource($journalEntry);
    }

    public function post(JournalEntry $journalEntry): JournalEntryResource
    {
        $entry = $this->journalEntries->post($journalEntry);

        return new JournalEntryResource($entry);
    }
}
