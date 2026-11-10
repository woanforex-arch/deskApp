<?php

namespace App\Services\Accounting;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\Bill;
use App\Models\Invoice;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApprovalService
{
    public function __construct(private readonly AuditService $audit) {}

    /**
     * Submit an approvable document to the workflow that matches its type and amount.
     */
    public function submit(string $type, Model $approvable, ?User $user = null): ?ApprovalRequest
    {
        $amount = $this->amountFor($approvable);
        $workflow = ApprovalWorkflow::matching($type, $amount);

        if ($workflow === null) {
            return null;
        }

        if ($approvable->approvals()->pending()->exists()) {
            return $approvable->approvals()->pending()->latest()->first();
        }

        $request = $approvable->approvals()->create([
            'approval_workflow_id' => $workflow->id,
            'status' => 'pending',
            'requested_by' => $user?->id ?? auth()->id(),
        ]);

        $updates = [];
        if ($approvable instanceof Invoice) {
            $updates['approval_status'] = 'pending';
            if ($approvable->status->value === 'draft') {
                $approvable->forceFill($updates)->saveQuietly();
            }
        } elseif ($approvable instanceof Bill) {
            $updates['status'] = 'pending_approval';
            $approvable->forceFill($updates)->saveQuietly();
        } elseif ($approvable instanceof PayrollRun) {
            $updates['status'] = 'pending_approval';
            $approvable->forceFill($updates)->saveQuietly();
        } else {
            $approvable->forceFill($updates + ($approvable->getAttribute('status') ? ['status' => 'pending_approval'] : []))->saveQuietly();
        }

        $this->audit->log('approval.requested', $request, [], [
            'type' => $type,
            'amount' => $amount,
            'workflow' => $workflow->name,
        ], "Approval requested for {$type} #{$approvable->getKey()}");

        return $request;
    }

    public function approve(ApprovalRequest $request, ?User $user = null, ?string $notes = null): ApprovalRequest
    {
        return $this->decide($request, 'approved', $notes, $user);
    }

    public function reject(ApprovalRequest $request, ?User $user = null, ?string $notes = null): ApprovalRequest
    {
        return $this->decide($request, 'rejected', $notes, $user);
    }

    public function decide(ApprovalRequest $request, string $status, ?string $notes = null, ?User $user = null): ApprovalRequest
    {
        if (! in_array($status, ['approved', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => 'Invalid approval decision.']);
        }

        if ($request->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'This approval request has already been decided.']);
        }

        return DB::transaction(function () use ($request, $status, $notes, $user): ApprovalRequest {
            $request->forceFill([
                'status' => $status,
                'approved_by' => $user?->id ?? auth()->id(),
                'notes' => $notes ?? $request->notes,
                'decided_at' => now(),
            ])->save();

            $approvable = $request->approvable;

            if ($approvable instanceof Invoice) {
                $approvable->forceFill(['approval_status' => $status])->saveQuietly();
            } elseif ($approvable instanceof Bill) {
                if ($status === 'approved') {
                    app(PayablesService::class)->approveBill($approvable, $user);
                } else {
                    $approvable->forceFill(['status' => 'draft'])->saveQuietly();
                }
            } elseif ($approvable instanceof PayrollRun) {
                $approvable->forceFill([
                    'status' => $status === 'approved' ? 'approved' : 'draft',
                    'approved_by' => $status === 'approved' ? ($user?->id ?? auth()->id()) : null,
                    'approved_at' => $status === 'approved' ? now() : null,
                ])->saveQuietly();
            }

            $this->audit->log(
                'approval.'.$status,
                $request,
                ['status' => 'pending'],
                ['status' => $status, 'approver_id' => $user?->id ?? auth()->id()],
                "Approval {$status} for ".class_basename($request->approvable_type)." #{$request->approvable_id}",
            );

            return $request->refresh();
        });
    }

    private function amountFor(Model $approvable): float
    {
        return (float) ($approvable->total ?? $approvable->gross_total ?? 0);
    }
}
