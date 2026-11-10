<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\RevenueRecognitionEntry;
use App\Models\RevenueSchedule;
use App\Services\Accounting\PostingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RevenueScheduleController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        $schedules = RevenueSchedule::query()
            ->with('invoice:id,number,contact_id')
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (RevenueSchedule $schedule) => [
                'id' => $schedule->id,
                'name' => $schedule->name,
                'invoice' => $schedule->invoice?->number,
                'invoice_id' => $schedule->invoice_id,
                'total_amount' => (float) $schedule->total_amount,
                'recognized_amount' => (float) $schedule->recognized_amount,
                'deferred_amount' => (float) $schedule->deferred_amount,
                'start_date' => $schedule->start_date?->toDateString(),
                'end_date' => $schedule->end_date?->toDateString(),
                'method' => $schedule->method,
                'status' => $schedule->status,
                'last_recognized_on' => $schedule->last_recognized_on?->toDateString(),
                'months_remaining' => $schedule->monthsRemaining(),
            ]);

        $entries = RevenueRecognitionEntry::query()
            ->with('schedule:id,name')
            ->orderByDesc('recognition_date')
            ->limit(150)
            ->get()
            ->map(fn (RevenueRecognitionEntry $entry) => [
                'id' => $entry->id,
                'schedule' => $entry->schedule?->name,
                'recognition_date' => $entry->recognition_date?->toDateString(),
                'amount' => (float) $entry->amount,
            ]);

        return Inertia::render('RevenueSchedules/Index', [
            'schedules' => $schedules,
            'entries' => $entries,
            'filters' => ['status' => $filters['status'] ?? null],
            'stats' => [
                'total' => round((float) RevenueSchedule::query()->sum('total_amount'), 2),
                'recognized' => round((float) RevenueSchedule::query()->sum('recognized_amount'), 2),
                'deferred' => round((float) RevenueSchedule::query()->sum('deferred_amount'), 2),
                'active' => RevenueSchedule::query()->where('status', 'active')->count(),
            ],
            'invoices' => Invoice::query()->orderByDesc('issue_date')->limit(200)->get(['id', 'number', 'total', 'currency']),
            'statuses' => ['active', 'completed', 'paused'],
            'methods' => ['straight_line', 'milestone', 'usage'],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
            'name' => ['required', 'string', 'max:150'],
            'total_amount' => ['required', 'numeric', 'gt:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'method' => ['nullable', Rule::in(['straight_line', 'milestone', 'usage'])],
        ]);

        RevenueSchedule::create([
            'invoice_id' => $data['invoice_id'] ?? null,
            'name' => $data['name'],
            'total_amount' => $data['total_amount'],
            'recognized_amount' => 0,
            'deferred_amount' => $data['total_amount'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'method' => $data['method'] ?? 'straight_line',
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        return back()->with('success', 'Revenue schedule created. Revenue will be released from deferred income.');
    }

    public function recognize(Request $request, RevenueSchedule $revenueSchedule): RedirectResponse
    {
        $remaining = round((float) $revenueSchedule->total_amount - (float) $revenueSchedule->recognized_amount, 2);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:'.$remaining],
            'recognition_date' => ['required', 'date'],
        ]);

        $this->posting->postRevenueRecognition(
            $revenueSchedule,
            (float) $data['amount'],
            $data['recognition_date'],
            $request->user(),
        );

        return back()->with('success', "Recognised revenue posted for {$revenueSchedule->name}.");
    }
}
