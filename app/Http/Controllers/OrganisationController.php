<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Company;
use App\Models\CostCenter;
use App\Models\Currency;
use App\Models\Department;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrganisationController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Organisation/Index', [
            'companies' => Company::query()->withCount('branches')->orderBy('name')->get()->map(fn (Company $company) => [
                'id' => $company->id,
                'name' => $company->name,
                'code' => $company->code,
                'base_currency' => $company->base_currency,
                'tax_number' => $company->tax_number,
                'registration_number' => $company->registration_number,
                'address' => $company->address,
                'is_active' => $company->is_active,
                'branches_count' => $company->branches_count,
            ]),
            'branches' => Branch::query()->with('company:id,name')->withCount(['departments', 'costCenters'])->orderBy('name')->get()->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'company' => $branch->company?->name,
                'company_id' => $branch->company_id,
                'address' => $branch->address,
                'manager' => $branch->manager,
                'is_active' => $branch->is_active,
                'departments_count' => $branch->departments_count,
                'cost_centers_count' => $branch->cost_centers_count,
            ]),
            'departments' => Department::query()->with('branch:id,name')->orderBy('name')->get()->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                'branch' => $department->branch?->name,
                'branch_id' => $department->branch_id,
                'manager' => $department->manager,
                'is_active' => $department->is_active,
            ]),
            'costCenters' => CostCenter::query()->with(['branch:id,name', 'department:id,name'])->orderBy('name')->get()->map(fn (CostCenter $center) => [
                'id' => $center->id,
                'name' => $center->name,
                'code' => $center->code,
                'branch' => $center->branch?->name,
                'department' => $center->department?->name,
                'branch_id' => $center->branch_id,
                'department_id' => $center->department_id,
                'is_active' => $center->is_active,
            ]),
            'projects' => Project::query()->with(['company:id,name', 'contact:id,name'])->orderBy('name')->get()->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'code' => $project->code,
                'company' => $project->company?->name,
                'contact' => $project->contact?->name,
                'status' => $project->status,
                'budget' => (float) $project->budget,
                'start_date' => $project->start_date?->toDateString(),
                'end_date' => $project->end_date?->toDateString(),
                'description' => $project->description,
            ]),
            'users' => User::query()->with(['department:id,name', 'branch:id,name'])->orderBy('name')->get()->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'department' => $user->department?->name,
                'branch' => $user->branch?->name,
                'is_active' => $user->is_active,
            ]),
            'stats' => [
                'companies' => Company::query()->count(),
                'branches' => Branch::query()->count(),
                'departments' => Department::query()->count(),
                'cost_centers' => CostCenter::query()->count(),
                'projects' => Project::query()->count(),
                'users' => User::query()->count(),
            ],
            'roles' => ['admin', 'accountant', 'approver', 'viewer'],
            'projectStatuses' => ['active', 'completed', 'on_hold', 'cancelled'],
        ]);
    }

    public function register(): Response
    {
        $baseCurrency = Currency::query()->where('is_base', true)->value('code');
        $defaultCurrency = $this->isoCurrency($baseCurrency) ?? 'USD';

        $currencies = Currency::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->pluck('code')
            ->map(fn ($code) => $this->isoCurrency($code))
            ->filter()
            ->unique()
            ->values();

        if ($currencies->isEmpty()) {
            $currencies = collect(['USD', 'EUR', 'GBP', 'GHS', 'KES', 'NGN', 'ZAR']);
        } elseif (! $currencies->contains($defaultCurrency)) {
            $currencies->prepend($defaultCurrency);
        }

        return Inertia::render('Organisation/Register', [
            'companies' => Company::query()->withCount('branches')->orderBy('name')->get()->map(fn (Company $company) => [
                'id' => $company->id,
                'name' => $company->name,
                'code' => $company->code,
                'base_currency' => $company->base_currency,
                'tax_number' => $company->tax_number,
                'registration_number' => $company->registration_number,
                'address' => $company->address,
                'is_active' => $company->is_active,
                'branches_count' => $company->branches_count,
            ]),
            'currencies' => $currencies->values(),
            'defaultCurrency' => $defaultCurrency,
            'stats' => [
                'companies' => Company::query()->count(),
                'active_companies' => Company::query()->where('is_active', true)->count(),
                'branches' => Branch::query()->count(),
            ],
        ]);
    }

    private function isoCurrency(?string $code): ?string
    {
        $normalized = strtoupper(trim((string) $code));

        if (in_array($normalized, ['GH₵', '₵'], true)) {
            return 'GHS';
        }

        return preg_match('/^[A-Z]{3}$/', $normalized) === 1 ? $normalized : null;
    }

    public function storeCompany(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:30', 'unique:companies,code'],
            'base_currency' => ['required', 'string', 'size:3', 'regex:/^[A-Za-z]{3}$/'],
            'tax_number' => ['nullable', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:60'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        Company::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Company created.');
    }

    public function storeBranch(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:30', 'unique:branches,code'],
            'address' => ['nullable', 'string', 'max:255'],
            'manager' => ['nullable', 'string', 'max:120'],
        ]);

        Branch::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Branch created.');
    }

    public function storeDepartment(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:30', 'unique:departments,code'],
            'manager' => ['nullable', 'string', 'max:120'],
        ]);

        Department::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Department created.');
    }

    public function storeCostCenter(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:30', 'unique:cost_centers,code'],
        ]);

        CostCenter::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Cost center created.');
    }

    public function storeProject(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'contact_id' => ['nullable', 'integer', 'exists:contacts,id'],
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:30', 'unique:projects,code'],
            'status' => ['nullable', Rule::in(['active', 'completed', 'on_hold', 'cancelled'])],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        Project::create([...$data, 'status' => $data['status'] ?? 'active', 'budget' => $data['budget'] ?? 0]);

        return back()->with('success', 'Project created.');
    }

    public function updateUserRole(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['admin', 'accountant', 'approver', 'viewer'])],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user->forceFill([
            'role' => $data['role'],
            'is_active' => $data['is_active'] ?? $user->is_active,
        ])->save();

        return back()->with('success', "{$user->name} updated.");
    }
}
