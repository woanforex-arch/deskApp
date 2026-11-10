<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Budget;
use App\Services\Accounting\DashboardService;
use App\Services\Accounting\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly DashboardService $dashboard,
    ) {}

    public function dashboard(): JsonResponse
    {
        return response()->json([
            'data' => $this->dashboard->metrics(),
        ]);
    }

    public function trialBalance(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : null;

        return response()->json([
            'data' => $this->ledger->trialBalance($from, $to),
        ]);
    }

    public function profitAndLoss(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from')
            ? Carbon::parse($request->date('from'))
            : Carbon::today()->startOfYear();
        $to = $request->filled('to')
            ? Carbon::parse($request->date('to'))
            : Carbon::today();

        return response()->json([
            'data' => $this->ledger->profitAndLoss($from, $to),
        ]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = $request->filled('as_of') ? Carbon::parse($request->date('as_of')) : Carbon::today();

        return response()->json(['data' => $this->ledger->balanceSheet($asOf)]);
    }

    public function cashFlow(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json(['data' => $this->ledger->cashFlow($from, $to)]);
    }

    public function generalLedger(Request $request): JsonResponse
    {
        $request->validate([
            'account_id' => ['required', 'integer', 'exists:accounts,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json([
            'data' => $this->ledger->generalLedger($request->integer('account_id'), $from, $to),
        ]);
    }

    public function aging(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['nullable', 'in:receivable,payable'],
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = $request->filled('as_of') ? Carbon::parse($request->date('as_of')) : Carbon::today();

        return response()->json([
            'data' => $this->ledger->aging($request->string('type', 'receivable')->toString(), $asOf),
        ]);
    }

    public function sales(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json(['data' => $this->ledger->salesReport($from, $to)]);
    }

    public function expenses(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json(['data' => $this->ledger->expenseReport($from, $to)]);
    }

    public function customerStatement(Request $request): JsonResponse
    {
        $request->validate([
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json([
            'data' => $this->ledger->customerStatement($request->integer('contact_id'), $from, $to),
        ]);
    }

    public function bankReconciliation(Request $request): JsonResponse
    {
        $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = $request->filled('as_of') ? Carbon::parse($request->date('as_of')) : Carbon::today();

        return response()->json(['data' => $this->ledger->bankReconciliationReport($asOf)]);
    }

    public function fixedAssetRegister(Request $request): JsonResponse
    {
        $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = $request->filled('as_of') ? Carbon::parse($request->date('as_of')) : Carbon::today();

        return response()->json(['data' => $this->ledger->fixedAssetRegister($asOf)]);
    }

    public function vat(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfQuarter();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json(['data' => $this->ledger->vatReturn($from, $to)]);
    }

    public function budgetVsActual(Request $request): JsonResponse
    {
        $request->validate([
            'budget_id' => ['required', 'integer', 'exists:budgets,id'],
        ]);

        $budget = Budget::query()->findOrFail($request->integer('budget_id'));

        return response()->json(['data' => $this->ledger->budgetVsActual($budget)]);
    }

    public function dimensions(Request $request): JsonResponse
    {
        $request->validate([
            'dimension' => ['required', 'in:department,project,branch,cost_center'],
            'dimension_id' => ['required', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->filled('from') ? Carbon::parse($request->date('from')) : Carbon::today()->startOfYear();
        $to = $request->filled('to') ? Carbon::parse($request->date('to')) : Carbon::today();

        return response()->json([
            'data' => $this->ledger->dimensionProfitAndLoss($request->string('dimension')->toString(), $request->integer('dimension_id'), $from, $to),
        ]);
    }

    public function audit(Request $request): JsonResponse
    {
        $request->validate([
            'action' => ['nullable', 'string', 'max:40'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = AuditLog::query()
            ->with('user:id,name')
            ->when($request->filled('action'), fn ($query) => $query->where('action', $request->string('action')))
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
