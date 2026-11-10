<?php

namespace App\Services\Accounting;

use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollService
{
    public function __construct(
        private readonly PostingService $posting,
        private readonly ApprovalService $approvals,
    ) {}

    /**
     * Build a payroll run for a YYYY-MM period from active employees.
     */
    public function createRun(string $period, ?string $payDate = null, array $options = [], ?User $user = null): PayrollRun
    {
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            throw ValidationException::withMessages(['period' => 'The period must be in YYYY-MM format.']);
        }

        if (PayrollRun::query()->where('period', $period)->exists()) {
            throw ValidationException::withMessages(['period' => 'A payroll run for this period already exists.']);
        }

        $incomeTaxRate = (float) ($options['income_tax_rate'] ?? 10);
        $socialRate = (float) ($options['social_security_rate'] ?? 5);

        return DB::transaction(function () use ($period, $payDate, $incomeTaxRate, $socialRate, $user): PayrollRun {
            $run = PayrollRun::create([
                'period' => $period,
                'pay_date' => $payDate ?? Carbon::createFromFormat('Y-m', $period)->endOfMonth()->toDateString(),
                'status' => 'draft',
                'created_by' => $user?->id ?? auth()->id(),
            ]);

            Employee::query()->where('is_active', true)->orderBy('name')->get()
                ->each(function (Employee $employee) use ($run, $incomeTaxRate, $socialRate): void {
                    $gross = (float) $employee->gross_salary;
                    $tax = round($gross * $incomeTaxRate / 100, 2);
                    $social = round($gross * $socialRate / 100, 2);
                    $other = 0.0;

                    $run->items()->create([
                        'employee_id' => $employee->id,
                        'gross' => $gross,
                        'income_tax' => $tax,
                        'social_security' => $social,
                        'other_deductions' => $other,
                        'net' => round($gross - $tax - $social - $other, 2),
                    ]);
                });

            $run->recalculateTotals();
            $this->approvals->submit('payroll', $run->refresh(), $user);

            return $run->refresh()->load('items.employee');
        });
    }

    public function process(PayrollRun $run, ?User $user = null): PayrollRun
    {
        if ($run->status === 'posted') {
            throw ValidationException::withMessages(['status' => 'This payroll run has already been posted.']);
        }

        if ((float) $run->gross_total <= 0) {
            throw ValidationException::withMessages(['gross_total' => 'Add employees with salaries before processing this run.']);
        }

        return DB::transaction(function () use ($run, $user): PayrollRun {
            $this->posting->postPayroll($run->refresh(), $user);

            return $run->refresh()->load('items.employee');
        });
    }
}
