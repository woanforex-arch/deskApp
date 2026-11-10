<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RevenueRecognitionEntry;
use App\Models\RevenueSchedule;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RevenueScheduleController extends Controller
{
    public function __construct(private readonly PostingService $posting) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'string', 'max:30'],
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
        ]);

        $schedules = RevenueSchedule::query()
            ->with('invoice:id,number,contact_id')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('invoice_id'), fn ($query) => $query->where('invoice_id', $request->integer('invoice_id')))
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (RevenueSchedule $schedule) => $this->present($schedule));

        $entries = RevenueRecognitionEntry::query()
            ->with('schedule:id,name')
            ->orderByDesc('recognition_date')
            ->limit(150)
            ->get()
            ->map(fn (RevenueRecognitionEntry $entry) => [
                'id' => $entry->id,
                'schedule_id' => $entry->schedule_id,
                'schedule' => $entry->schedule?->name,
                'recognition_date' => $entry->recognition_date?->toDateString(),
                'amount' => (float) $entry->amount,
            ]);

        return response()->json([
            'data' => [
                'schedules' => $schedules,
                'entries' => $entries,
                'stats' => [
                    'total' => round((float) RevenueSchedule::query()->sum('total_amount'), 2),
                    'recognized' => round((float) RevenueSchedule::query()->sum('recognized_amount'), 2),
                    'deferred' => round((float) RevenueSchedule::query()->sum('deferred_amount'), 2),
                    'active' => RevenueSchedule::query()->where('status', 'active')->count(),
                ],
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
            'name' => ['required', 'string', 'max:150'],
            'total_amount' => ['required', 'numeric', 'gt:0'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'method' => ['nullable', Rule::in(['straight_line', 'milestone', 'usage'])],
        ]);

        $schedule = RevenueSchedule::create([
            'invoice_id' => $data['invoice_id'] ?? null,
            'name' => $data['name'],
            'total_amount' => $data['total_amount'],
            'recognized_amount' => 0,
            'deferred_amount' => $data['total_amount'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'method' => $data['method'] ?? 'straight_line',
            'status' => 'active',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->present($schedule->refresh())], 201);
    }

    public function recognize(Request $request, RevenueSchedule $revenueSchedule): JsonResponse
    {
        $remaining = round((float) $revenueSchedule->total_amount - (float) $revenueSchedule->recognized_amount, 2);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:'.$remaining],
            'recognition_date' => ['required', 'date'],
        ]);

        $entry = $this->posting->postRevenueRecognition(
            $revenueSchedule,
            (float) $data['amount'],
            $data['recognition_date'],
            $request->user(),
        );

        return response()->json([
            'data' => $this->present($revenueSchedule->refresh()) + [
                'journal_entry_id' => $entry?->id,
            ],
            'message' => 'Recognised revenue posted.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(RevenueSchedule $schedule): array
    {
        return [
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
        ];
    }
}
