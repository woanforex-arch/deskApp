<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Services\Accounting\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PayrollController extends Controller
{
    public function __construct(private readonly PayrollService $payroll) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $employees = Employee::query()
            ->with('department:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Employee $employee) => $this->presentEmployee($employee));

        $runs = PayrollRun::query()
            ->withCount('items')
            ->orderByDesc('period')
            ->get()
            ->map(fn (PayrollRun $run) => $this->presentRun($run));

        $items = PayrollItem::query()
            ->with(['employee:id,name,employee_number', 'run:id,period'])
            ->when($request->filled('period'), fn ($query) => $query->whereHas('run', fn ($query) => $query->where('period', $request->string('period'))))
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->map(fn (PayrollItem $item) => [
                'id' => $item->id,
                'period' => $item->run?->period,
                'employee' => $item->employee?->name,
                'employee_number' => $item->employee?->employee_number,
                'gross' => (float) $item->gross,
                'income_tax' => (float) $item->income_tax,
                'social_security' => (float) $item->social_security,
                'other_deductions' => (float) $item->other_deductions,
                'net' => (float) $item->net,
            ]);

        return response()->json([
            'data' => [
                'employees' => $employees,
                'runs' => $runs,
                'items' => $items,
            ],
            'meta' => [
                'monthly_gross' => round((float) Employee::query()->where('is_active', true)->sum('gross_salary'), 2),
                'posted_net' => round((float) PayrollRun::query()->where('status', 'posted')->sum('net_total'), 2),
            ],
        ]);
    }

    public function storeEmployee(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_number' => ['required', 'string', 'max:40', 'unique:employees,employee_number'],
            'name' => ['required', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:150'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position' => ['nullable', 'string', 'max:120'],
            'hire_date' => ['nullable', 'date'],
            'gross_salary' => ['required', 'numeric', 'min:0'],
            'pay_frequency' => ['nullable', Rule::in(['monthly', 'biweekly', 'weekly'])],
            'tax_number' => ['nullable', 'string', 'max:40'],
            'bank_account' => ['nullable', 'string', 'max:60'],
        ]);

        $employee = Employee::create([
            ...$data,
            'pay_frequency' => $data['pay_frequency'] ?? 'monthly',
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->presentEmployee($employee->load('department'))], 201);
    }

    public function storeRun(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'pay_date' => ['nullable', 'date'],
            'income_tax_rate' => ['nullable', 'numeric', 'between:0,100'],
            'social_security_rate' => ['nullable', 'numeric', 'between:0,100'],
        ]);

        $run = $this->payroll->createRun(
            $data['period'],
            $data['pay_date'] ?? null,
            [
                'income_tax_rate' => $data['income_tax_rate'] ?? 10,
                'social_security_rate' => $data['social_security_rate'] ?? 5,
            ],
            $request->user(),
        );

        return response()->json(['data' => $this->presentRun($run)], 201);
    }

    public function showRun(PayrollRun $payrollRun): JsonResponse
    {
        $payrollRun->load('items.employee');

        return response()->json([
            'data' => $this->presentRun($payrollRun) + [
                'items' => $payrollRun->items->map(fn (PayrollItem $item) => [
                    'id' => $item->id,
                    'employee' => $item->employee?->name,
                    'employee_number' => $item->employee?->employee_number,
                    'gross' => (float) $item->gross,
                    'income_tax' => (float) $item->income_tax,
                    'social_security' => (float) $item->social_security,
                    'other_deductions' => (float) $item->other_deductions,
                    'net' => (float) $item->net,
                ]),
            ],
        ]);
    }

    public function process(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $run = $this->payroll->process($payrollRun, $request->user());

        return response()->json(['message' => 'Payroll posted to the ledger.', 'data' => $this->presentRun($run)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentRun(PayrollRun $run): array
    {
        return [
            'id' => $run->id,
            'period' => $run->period,
            'pay_date' => $run->pay_date?->toDateString(),
            'status' => $run->status,
            'gross_total' => (float) $run->gross_total,
            'deductions_total' => (float) $run->deductions_total,
            'net_total' => (float) $run->net_total,
            'journal_entry_id' => $run->journal_entry_id,
            'approved_at' => $run->approved_at?->toIso8601String(),
            'items_count' => $run->items_count ?? $run->items()->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentEmployee(Employee $employee): array
    {
        return [
            'id' => $employee->id,
            'employee_number' => $employee->employee_number,
            'name' => $employee->name,
            'email' => $employee->email,
            'department' => $employee->department?->name,
            'position' => $employee->position,
            'hire_date' => $employee->hire_date?->toDateString(),
            'gross_salary' => (float) $employee->gross_salary,
            'pay_frequency' => $employee->pay_frequency,
            'is_active' => $employee->is_active,
        ];
    }
}
