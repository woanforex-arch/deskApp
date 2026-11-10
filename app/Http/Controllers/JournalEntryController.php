<?php

namespace App\Http\Controllers;

use App\Enums\JournalEntryStatus;
use App\Http\Requests\Api\StoreJournalEntryRequest;
use App\Http\Requests\Api\UpdateJournalEntryRequest;
use App\Models\Account;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Services\Accounting\JournalEntryService;
use App\Services\Accounting\LedgerService;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class JournalEntryController extends Controller
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly JournalEntryService $journalEntries,
        private readonly PostingService $posting,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(JournalEntryStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $entries = JournalEntry::query()
            ->with(['lines' => fn ($query) => $query->with('account:id,code,name')->orderBy('id')])
            ->withCount('lines')
            ->withSum('lines as total_debit', 'debit')
            ->withSum('lines as total_credit', 'credit')
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['search'] ?? null, function ($query, $search): void {
                $query->where(fn ($query) => $query
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('memo', 'like', "%{$search}%"));
            })
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (JournalEntry $entry) => [
                'id' => $entry->id,
                'reference' => $entry->reference,
                'entry_date' => $entry->entry_date?->toDateString(),
                'memo' => $entry->memo,
                'status' => $entry->status->value,
                'status_label' => $entry->status->label(),
                'total_debit' => $entry->totalDebit(),
                'total_credit' => $entry->totalCredit(),
                'lines_count' => $entry->lines_count,
                'lines' => $entry->lines->map(fn (JournalLine $line) => [
                    'id' => $line->id,
                    'account_id' => $line->account_id,
                    'account' => $line->account ? $line->account->code.' · '.$line->account->name : null,
                    'description' => $line->description,
                    'debit' => (float) $line->debit,
                    'credit' => (float) $line->credit,
                ])->values(),
                'posted_at' => $entry->posted_at?->toIso8601String(),
            ]);

        $trialBalance = $this->ledger->trialBalance();

        return Inertia::render('Journal/Index', [
            'entries' => $entries,
            'filters' => [
                'status' => $filters['status'] ?? null,
                'search' => $filters['search'] ?? null,
            ],
            'statuses' => collect(JournalEntryStatus::cases())
                ->map(fn (JournalEntryStatus $status) => ['value' => $status->value, 'label' => $status->label()])
                ->values(),
            'trialBalance' => $trialBalance['totals'],
            'stats' => [
                'total' => JournalEntry::query()->count(),
                'draft' => JournalEntry::query()->where('status', JournalEntryStatus::Draft->value)->count(),
                'posted' => JournalEntry::query()->where('status', JournalEntryStatus::Posted->value)->count(),
                'void' => JournalEntry::query()->where('status', JournalEntryStatus::Void->value)->count(),
            ],
            'accounts' => Account::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'type'])
                ->map(fn (Account $account) => [
                    'id' => $account->id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'type' => $account->type->value,
                ])
                ->values(),
            'nextReference' => JournalEntry::generateReference(),
        ]);
    }

    public function store(StoreJournalEntryRequest $request): RedirectResponse
    {
        $entry = $this->journalEntries->create($request->validated(), $request->user());

        return redirect()
            ->route('journal.index')
            ->with('success', "Journal entry {$entry->reference} created.");
    }

    public function post(JournalEntry $journalEntry): RedirectResponse
    {
        $this->journalEntries->post($journalEntry);

        return back()->with('success', "Journal entry {$journalEntry->reference} posted to the ledger.");
    }

    public function destroy(JournalEntry $journalEntry): RedirectResponse
    {
        if ($journalEntry->status !== JournalEntryStatus::Draft) {
            return back()->with('error', 'Only draft journal entries can be deleted.');
        }

        $reference = $journalEntry->reference;
        $journalEntry->delete();

        return back()->with('success', "Journal entry {$reference} deleted.");
    }

    public function update(UpdateJournalEntryRequest $request, JournalEntry $journalEntry): RedirectResponse
    {
        if ($journalEntry->status !== JournalEntryStatus::Draft) {
            return back()->with('error', 'Only draft journal entries can be edited. Void posted entries to correct them.');
        }

        $entry = $this->journalEntries->update($journalEntry, $request->validated());

        return back()->with('success', "Journal entry {$entry->reference} updated.");
    }

    public function duplicate(JournalEntry $journalEntry): RedirectResponse
    {
        $copy = $this->journalEntries->duplicate($journalEntry, auth()->user());

        return back()->with('success', "Journal entry duplicated as draft {$copy->reference}.");
    }

    public function void(JournalEntry $journalEntry): RedirectResponse
    {
        if ($journalEntry->status !== JournalEntryStatus::Posted) {
            return back()->with('error', 'Only posted journal entries can be voided.');
        }

        $reversal = $this->posting->void($journalEntry, auth()->user());

        return back()->with('success', "Journal entry {$journalEntry->reference} voided. Reversal {$reversal->reference} posted.");
    }

    public function destroyVoid(JournalEntry $journalEntry): RedirectResponse
    {
        try {
            $deleted = $this->journalEntries->deleteVoid($journalEntry);
        } catch (ValidationException $exception) {
            $message = $exception->errors()['journal_entry'][0] ?? 'Unable to delete this void entry.';

            return back()->with('error', $message);
        }

        $reversal = $deleted['reversal'] ? " and reversal {$deleted['reversal']}" : '';

        return back()->with('success', "Void journal entry {$deleted['void']}{$reversal} deleted.");
    }
}
