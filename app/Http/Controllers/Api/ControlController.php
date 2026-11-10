<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingPeriod;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\PostingRule;
use App\Services\Accounting\ApprovalService;
use App\Services\Accounting\AuditService;
use App\Services\Accounting\PeriodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ControlController extends Controller
{
    public function __construct(
        private readonly PeriodService $periods,
        private readonly AuditService $audit,
        private readonly ApprovalService $approvals,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'periods' => AccountingPeriod::query()->with('closer:id,name')->orderByDesc('start_date')->get()
                    ->map(fn (AccountingPeriod $period) => $this->presentPeriod($period)),
                'posting_rules' => PostingRule::query()
                    ->with(['debitAccount:id,code,name', 'creditAccount:id,code,name', 'taxAccount:id,code,name'])
                    ->orderBy('event')
                    ->get()
                    ->map(fn (PostingRule $rule) => $this->presentRule($rule)),
                'workflows' => ApprovalWorkflow::query()
                    ->withCount(['requests as pending_count' => fn ($query) => $query->where('status', 'pending')])
                    ->orderBy('type')
                    ->orderBy('threshold')
                    ->get()
                    ->map(fn (ApprovalWorkflow $workflow) => $this->presentWorkflow($workflow)),
                'approvals' => ApprovalRequest::query()
                    ->with(['workflow:id,name,type', 'requester:id,name', 'approver:id,name'])
                    ->orderByDesc('id')
                    ->limit(100)
                    ->get()
                    ->map(fn (ApprovalRequest $approval) => $this->presentApproval($approval)),
                'stats' => [
                    'open_periods' => AccountingPeriod::query()->where('status', 'open')->count(),
                    'closed_periods' => AccountingPeriod::query()->where('status', 'closed')->count(),
                    'rules' => PostingRule::query()->where('is_active', true)->count(),
                    'workflows' => ApprovalWorkflow::query()->where('is_active', true)->count(),
                    'pending_approvals' => ApprovalRequest::query()->where('status', 'pending')->count(),
                ],
            ],
        ]);
    }

    public function storePeriod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:80'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'status' => ['nullable', Rule::in(['open', 'closed'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $period = AccountingPeriod::create([
            'name' => $data['name'] ?: Carbon::parse($data['start_date'])->format('F Y'),
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'status' => $data['status'] ?? 'open',
            'notes' => $data['notes'] ?? null,
        ]);

        $this->audit->log('period.created', $period, [], $period->only(['name', 'start_date', 'end_date', 'status']));

        return response()->json(['data' => $this->presentPeriod($period->refresh())], 201);
    }

    public function closePeriod(Request $request, AccountingPeriod $accountingPeriod): JsonResponse
    {
        if ($accountingPeriod->status === 'closed') {
            return response()->json(['message' => 'This period is already closed.'], 422);
        }

        $this->periods->close($accountingPeriod, $request->user());
        $this->audit->log('period.closed', $accountingPeriod, [], ['status' => 'closed'], "Closed {$accountingPeriod->name}");

        return response()->json(['data' => $this->presentPeriod($accountingPeriod->refresh()), 'message' => 'Period closed.']);
    }

    public function reopenPeriod(AccountingPeriod $accountingPeriod): JsonResponse
    {
        $this->periods->reopen($accountingPeriod);
        $this->audit->log('period.reopened', $accountingPeriod, ['status' => 'closed'], ['status' => 'open'], "Reopened {$accountingPeriod->name}");

        return response()->json(['data' => $this->presentPeriod($accountingPeriod->refresh()), 'message' => 'Period reopened.']);
    }

    public function storeRule(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'string', 'max:60', 'unique:posting_rules,event'],
            'name' => ['required', 'string', 'max:150'],
            'debit_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'credit_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'tax_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $rule = PostingRule::create([...$data, 'is_active' => true]);

        return response()->json(['data' => $this->presentRule($rule->refresh()->load(['debitAccount', 'creditAccount', 'taxAccount']))], 201);
    }

    public function storeWorkflow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(['invoice', 'bill', 'journal', 'payroll', 'expense'])],
            'threshold' => ['required', 'numeric', 'min:0'],
            'approver_role' => ['required', Rule::in(['admin', 'accountant', 'approver'])],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $workflow = ApprovalWorkflow::create([...$data, 'is_active' => true]);

        return response()->json(['data' => $this->presentWorkflow($workflow->refresh())], 201);
    }

    public function decide(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($approvalRequest->status !== 'pending') {
            return response()->json(['message' => 'This approval request has already been decided.'], 422);
        }

        $this->approvals->decide($approvalRequest, $data['status'], $data['notes'] ?? null, $request->user());

        return response()->json(['data' => $this->presentApproval($approvalRequest->refresh()), 'message' => "Approval request {$data['status']}."]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentPeriod(AccountingPeriod $period): array
    {
        $period->loadMissing('closer:id,name');

        return [
            'id' => $period->id,
            'name' => $period->name,
            'start_date' => $period->start_date?->toDateString(),
            'end_date' => $period->end_date?->toDateString(),
            'status' => $period->status,
            'closed_by' => $period->closer?->name,
            'closed_at' => $period->closed_at?->toIso8601String(),
            'notes' => $period->notes,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentRule(PostingRule $rule): array
    {
        return [
            'id' => $rule->id,
            'event' => $rule->event,
            'name' => $rule->name,
            'debit_account' => $rule->debitAccount ? $rule->debitAccount->code.' - '.$rule->debitAccount->name : null,
            'credit_account' => $rule->creditAccount ? $rule->creditAccount->code.' - '.$rule->creditAccount->name : null,
            'tax_account' => $rule->taxAccount ? $rule->taxAccount->code.' - '.$rule->taxAccount->name : null,
            'is_active' => $rule->is_active,
            'description' => $rule->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentWorkflow(ApprovalWorkflow $workflow): array
    {
        return [
            'id' => $workflow->id,
            'name' => $workflow->name,
            'type' => $workflow->type,
            'threshold' => (float) $workflow->threshold,
            'approver_role' => $workflow->approver_role,
            'is_active' => $workflow->is_active,
            'description' => $workflow->description,
            'pending_count' => $workflow->pending_count ?? $workflow->requests()->where('status', 'pending')->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentApproval(ApprovalRequest $approval): array
    {
        $approval->loadMissing(['workflow:id,name,type', 'requester:id,name', 'approver:id,name']);

        return [
            'id' => $approval->id,
            'workflow' => $approval->workflow?->name,
            'type' => $approval->workflow?->type,
            'subject' => class_basename($approval->approvable_type).' #'.$approval->approvable_id,
            'status' => $approval->status,
            'requested_by' => $approval->requester?->name,
            'approved_by' => $approval->approver?->name,
            'notes' => $approval->notes,
            'decided_at' => $approval->decided_at?->toIso8601String(),
            'created_at' => $approval->created_at?->toIso8601String(),
        ];
    }
}
