<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AccountingPeriod;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\PostingRule;
use App\Services\Accounting\ApprovalService;
use App\Services\Accounting\AuditService;
use App\Services\Accounting\PeriodService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ControlController extends Controller
{
    public function __construct(
        private readonly PeriodService $periods,
        private readonly AuditService $audit,
        private readonly ApprovalService $approvals,
    ) {}

    public function index(): Response
    {
        $periods = AccountingPeriod::query()
            ->with('closer:id,name')
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (AccountingPeriod $period) => [
                'id' => $period->id,
                'name' => $period->name,
                'start_date' => $period->start_date?->toDateString(),
                'end_date' => $period->end_date?->toDateString(),
                'status' => $period->status,
                'closed_by' => $period->closer?->name,
                'closed_at' => $period->closed_at?->toIso8601String(),
                'notes' => $period->notes,
            ]);

        $rules = PostingRule::query()
            ->with(['debitAccount:id,code,name', 'creditAccount:id,code,name', 'taxAccount:id,code,name'])
            ->orderBy('event')
            ->get()
            ->map(fn (PostingRule $rule) => [
                'id' => $rule->id,
                'event' => $rule->event,
                'name' => $rule->name,
                'debit_account' => $rule->debitAccount ? $rule->debitAccount->code.' - '.$rule->debitAccount->name : null,
                'credit_account' => $rule->creditAccount ? $rule->creditAccount->code.' - '.$rule->creditAccount->name : null,
                'tax_account' => $rule->taxAccount ? $rule->taxAccount->code.' - '.$rule->taxAccount->name : null,
                'is_active' => $rule->is_active,
                'description' => $rule->description,
            ]);

        $workflows = ApprovalWorkflow::query()
            ->withCount(['requests as pending_count' => fn ($query) => $query->where('status', 'pending')])
            ->orderBy('type')
            ->orderBy('threshold')
            ->get()
            ->map(fn (ApprovalWorkflow $workflow) => [
                'id' => $workflow->id,
                'name' => $workflow->name,
                'type' => $workflow->type,
                'threshold' => (float) $workflow->threshold,
                'approver_role' => $workflow->approver_role,
                'is_active' => $workflow->is_active,
                'description' => $workflow->description,
                'pending_count' => $workflow->pending_count,
            ]);

        $approvals = ApprovalRequest::query()
            ->with(['workflow:id,name,type', 'requester:id,name', 'approver:id,name'])
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (ApprovalRequest $approval) => [
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
            ]);

        return Inertia::render('Controls/Index', [
            'periods' => $periods,
            'postingRules' => $rules,
            'workflows' => $workflows,
            'approvals' => $approvals,
            'stats' => [
                'open_periods' => AccountingPeriod::query()->where('status', 'open')->count(),
                'closed_periods' => AccountingPeriod::query()->where('status', 'closed')->count(),
                'rules' => PostingRule::query()->where('is_active', true)->count(),
                'workflows' => ApprovalWorkflow::query()->where('is_active', true)->count(),
                'pending_approvals' => ApprovalRequest::query()->where('status', 'pending')->count(),
            ],
            'accounts' => Account::query()->orderBy('code')->get(['id', 'code', 'name', 'type']),
            'types' => ['invoice', 'bill', 'journal', 'payroll', 'expense'],
            'roles' => ['admin', 'accountant', 'approver'],
            'statuses' => ['pending', 'approved', 'rejected'],
        ]);
    }

    public function storePeriod(Request $request): RedirectResponse
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

        return back()->with('success', "Accounting period {$period->name} created.");
    }

    public function closePeriod(Request $request, AccountingPeriod $accountingPeriod): RedirectResponse
    {
        if ($accountingPeriod->status === 'closed') {
            return back()->with('error', 'This period is already closed.');
        }

        $this->periods->close($accountingPeriod, $request->user());
        $this->audit->log('period.closed', $accountingPeriod, [], ['status' => 'closed'], "Closed {$accountingPeriod->name}");

        return back()->with('success', "{$accountingPeriod->name} closed. Postings into this period are now blocked.");
    }

    public function reopenPeriod(Request $request, AccountingPeriod $accountingPeriod): RedirectResponse
    {
        $this->periods->reopen($accountingPeriod);
        $this->audit->log('period.reopened', $accountingPeriod, ['status' => 'closed'], ['status' => 'open'], "Reopened {$accountingPeriod->name}");

        return back()->with('success', "{$accountingPeriod->name} reopened.");
    }

    public function storeRule(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'event' => ['required', 'string', 'max:60', 'unique:posting_rules,event'],
            'name' => ['required', 'string', 'max:150'],
            'debit_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'credit_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'tax_account_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        PostingRule::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Posting rule created.');
    }

    public function storeWorkflow(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(['invoice', 'bill', 'journal', 'payroll', 'expense'])],
            'threshold' => ['required', 'numeric', 'min:0'],
            'approver_role' => ['required', Rule::in(['admin', 'accountant', 'approver'])],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        ApprovalWorkflow::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Approval workflow created.');
    }

    public function decide(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($approvalRequest->status !== 'pending') {
            return back()->with('error', 'This approval request has already been decided.');
        }

        $this->approvals->decide($approvalRequest, $data['status'], $data['notes'] ?? null, $request->user());

        return back()->with('success', "Approval request {$data['status']}.");
    }
}
