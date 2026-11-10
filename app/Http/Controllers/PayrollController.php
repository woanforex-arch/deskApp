<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Services\Accounting\PayrollService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PayrollController extends Controller
{
    public function __construct(private readonly PayrollService $payroll) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'period' => ['nullable', 'string', 'max:7'],
        ]);

        $employees = Employee::query()
            ->with('department:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->name,
                'email' => $employee->email,
                'department' => $employee->department?->name,
                'position' => $employee->position,
                'hire_date' => $employee->hire_date?->toDateString(),
                'gross_salary' => (float) $employee->gross_salary,
                'pay_frequency' => $employee->pay_frequency,
                'tax_number' => $employee->tax_number,
                'bank_account' => $employee->bank_account,
                'is_active' => $employee->is_active,
            ]);

        $runs = PayrollRun::query()
            ->when($filters['period'] ?? null, fn ($query, $period) => $query->where('period', $period))
            ->withCount('items')
            ->orderByDesc('period')
            ->get()
            ->map(fn (PayrollRun $run) => [
                'id' => $run->id,
                'period' => $run->period,
                'pay_date' => $run->pay_date?->toDateString(),
                'status' => $run->status,
                'gross_total' => (float) $run->gross_total,
                'deductions_total' => (float) $run->deductions_total,
                'net_total' => (float) $run->net_total,
                'items_count' => $run->items_count,
                'approved_at' => $run->approved_at?->toIso8601String(),
            ]);

        $items = PayrollItem::query()
            ->with(['employee:id,name,employee_number', 'run:id,period'])
            ->when($filters['period'] ?? null, fn ($query, $period) => $query->whereHas('run', fn ($query) => $query->where('period', $period)))
            ->orderByDesc('id')
            ->limit(200)
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

        return Inertia::render('Payroll/Index', [
            'employees' => $employees,
            'runs' => $runs,
            'items' => $items,
            'filters' => ['period' => $filters['period'] ?? null],
            'stats' => [
                'employees' => Employee::query()->where('is_active', true)->count(),
                'monthly_gross' => round((float) Employee::query()->where('is_active', true)->sum('gross_salary'), 2),
                'runs' => PayrollRun::query()->count(),
                'posted' => PayrollRun::query()->where('status', 'posted')->count(),
                'net_paid' => round((float) PayrollRun::query()->where('status', 'posted')->sum('net_total'), 2),
            ],
            'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
            'frequencies' => ['monthly', 'biweekly', 'weekly'],
            'periods' => PayrollRun::query()->orderByDesc('period')->pluck('period'),
        ]);
    }

    public function storeEmployee(Request $request): RedirectResponse
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

        Employee::create([...$data, 'pay_frequency' => $data['pay_frequency'] ?? 'monthly', 'is_active' => true]);

        return back()->with('success', 'Employee added to the payroll register.');
    }

    public function storeRun(Request $request): RedirectResponse
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

        return back()->with('success', "Payroll run {$run->period} drafted with {$run->items->count()} employees.");
    }

    public function process(Request $request, PayrollRun $payrollRun): RedirectResponse
    {
        $this->payroll->process($payrollRun, $request->user());

        return back()->with('success', "Payroll run {$payrollRun->period} posted to the ledger.");
    }
}
