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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class OrganisationController extends Controller
{
    private function companyPayload(Company $company): array
    {
        return [
            'id' => $company->id,
            'name' => $company->name,
            'code' => $company->code,
            'base_currency' => $company->base_currency,
            'business_type' => $company->business_type,
            'trading_name' => $company->trading_name,
            'tax_number' => $company->tax_number,
            'registration_number' => $company->registration_number,
            'business_email' => $company->business_email,
            'website' => $company->website,
            'postal_address' => $company->postal_address,
            'physical_address' => $company->physical_address,
            'logo_url' => $company->logoUrl(),
            'is_active' => $company->is_active,
            'branches_count' => $company->branches_count,
        ];
    }

    public function index(): Response
    {
        return Inertia::render('Organisation/Index', [
            'companies' => Company::query()->withCount('branches')->orderBy('name')->get()->map(fn (Company $company) => $this->companyPayload($company)),
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
            'roles' => $this->rolesPayload(),
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
            'companies' => Company::query()->withCount('branches')->orderBy('name')->get()->map(fn (Company $company) => $this->companyPayload($company)),
            'currencies' => $currencies->values(),
            'defaultCurrency' => $defaultCurrency,
            'users' => $this->usersPayload(),
            'roles' => $this->rolesPayload(),
            'stats' => [
                'companies' => Company::query()->count(),
                'active_companies' => Company::query()->where('is_active', true)->count(),
                'branches' => Branch::query()->count(),
                'users' => User::query()->count(),
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

    /**
     * Company register validation rules shared by store and update.
     *
     * @return array<string, mixed>
     */
    private function companyRules(?Company $company = null): array
    {
        $updating = $company !== null;

        return [
            'name' => [$updating ? 'sometimes' : 'required', 'string', 'max:150'],
            'code' => [$updating ? 'sometimes' : 'required', 'string', 'max:30', Rule::unique('companies', 'code')->ignore($company?->id)],
            'base_currency' => [$updating ? 'sometimes' : 'required', 'string', 'size:3', 'regex:/^[A-Za-z]{3}$/'],
            'business_type' => ['nullable', 'string', 'max:60'],
            'trading_name' => ['nullable', 'string', 'max:150'],
            'tax_number' => ['nullable', 'string', 'max:60'],
            'registration_number' => ['nullable', 'string', 'max:60'],
            'business_email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'string', 'max:255'],
            'postal_address' => ['nullable', 'string', 'max:500'],
            'physical_address' => ['nullable', 'string', 'max:500'],
            'logo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,svg', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Upload, replace, or clear the company logo.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function applyLogo(Request $request, Company $company, array &$attributes): void
    {
        if ($request->boolean('clear_logo')) {
            if ($company->logo_path) {
                Storage::disk('local')->delete($company->logo_path);
            }

            $attributes['logo_path'] = null;

            return;
        }

        if (! $request->hasFile('logo')) {
            return;
        }

        $path = $request->file('logo')->store('company-logos', 'local');

        if ($company->logo_path) {
            Storage::disk('local')->delete($company->logo_path);
        }

        $attributes['logo_path'] = $path;
    }

    public function serveLogo(Company $company): SymfonyResponse
    {
        abort_unless($company->logo_path !== null && Storage::disk('local')->exists($company->logo_path), 404);

        return Storage::disk('local')->response($company->logo_path);
    }

    public function storeCompany(Request $request): RedirectResponse
    {
        $data = $request->validate($this->companyRules());

        $company = new Company($data);
        $company->is_active = $data['is_active'] ?? true;
        $company->save();

        $attributes = [];

        $this->applyLogo($request, $company, $attributes);

        if ($attributes !== []) {
            $company->forceFill($attributes)->save();
        }

        return back()->with('success', "Company {$company->code} registered.");
    }

    public function updateCompany(Request $request, Company $company): RedirectResponse
    {
        $data = $request->validate($this->companyRules($company));

        $fill = collect($data)
            ->only([
                'name',
                'code',
                'base_currency',
                'business_type',
                'trading_name',
                'tax_number',
                'registration_number',
                'business_email',
                'website',
                'postal_address',
                'physical_address',
            ])
            ->all();

        if (array_key_exists('is_active', $data)) {
            $fill['is_active'] = $data['is_active'];
        }

        $company->fill($fill)->save();

        $attributes = [];

        $this->applyLogo($request, $company, $attributes);

        if ($attributes !== []) {
            $company->forceFill($attributes)->save();
        }

        return back()->with('success', "Company {$company->refresh()->code} updated.");
    }

    public function deleteCompany(Request $request, Company $company): RedirectResponse
    {
        if ($reason = $this->companyDeletionBlocker($company)) {
            return back()->with('error', $reason);
        }

        if ($company->logo_path) {
            Storage::disk('local')->delete($company->logo_path);
        }

        $code = $company->code;

        $company->delete();

        return back()->with('success', "Company {$code} registration deleted.");
    }

    /**
     * Returns a rejection reason when the company is referenced by
     * structure or ledger records, or null when it may be deleted.
     */
    private function companyDeletionBlocker(Company $company): ?string
    {
        $reasons = collect([
            'branches' => $company->branches()->exists(),
            'chart of accounts' => $company->accounts()->exists(),
            'journal entries' => $company->journalEntries()->exists(),
        ]);

        foreach (['invoices', 'bills'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'company_id')) {
                $reasons["posted {$table}"] = DB::table($table)
                    ->where('company_id', $company->id)
                    ->exists();
            }
        }

        $used = $reasons->filter()->keys();

        if ($used->isNotEmpty()) {
            return "{$company->code} is used by {$used->join(', ', ' and ')} and cannot be deleted.";
        }

        return null;
    }

    public function deleteBranch(Request $request, Branch $branch): RedirectResponse
    {
        if ($reason = $this->branchDeletionBlocker($branch)) {
            return back()->with('error', $reason);
        }

        $code = $branch->code;

        $branch->delete();

        return back()->with('success', "Branch {$code} deleted.");
    }

    /**
     * Returns a rejection reason when the branch is referenced by ledger
     * records, or null when it may be deleted. Departments, cost centers
     * and user assignments are detached through the nullable foreign keys.
     */
    private function branchDeletionBlocker(Branch $branch): ?string
    {
        $tables = [
            'chart of accounts' => 'accounts',
            'journal entries' => 'journal_entries',
            'posted invoices' => 'invoices',
            'posted bills' => 'bills',
            'budgets' => 'budgets',
        ];

        $reasons = collect($tables)
            ->filter(fn (string $table) => Schema::hasTable($table)
                && Schema::hasColumn($table, 'branch_id')
                && DB::table($table)->where('branch_id', $branch->id)->exists())
            ->keys();

        if ($reasons->isNotEmpty()) {
            return "{$branch->code} is used by {$reasons->join(', ', ' and ')} and cannot be deleted.";
        }

        return null;
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
            'role' => ['required', 'string', Rule::in(User::roleKeys())],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user->forceFill([
            'role' => $data['role'],
            'is_active' => $data['is_active'] ?? $user->is_active,
        ])->save();

        return back()->with('success', "{$user->name} updated.");
    }

    /**
     * Workspace users for the Users & permissions tab.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function usersPayload(): Collection
    {
        return User::query()
            ->with(['department:id,name', 'branch:id,name'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->roleLabel(),
                'can_write' => $user->canWrite(),
                'can_approve' => $user->canApprove(),
                'is_admin' => $user->isAdmin(),
                'department' => $user->department?->name,
                'branch' => $user->branch?->name,
                'is_active' => $user->is_active,
            ]);
    }

    /**
     * Roles and their capabilities for the permissions matrix.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function rolesPayload(): Collection
    {
        return collect(User::ROLES)
            ->map(fn (array $definition, string $key) => [
                'key' => $key,
                'label' => $definition['label'],
                'can_write' => $definition['can_write'],
                'can_approve' => $definition['can_approve'],
                'is_admin' => $definition['is_admin'],
            ])
            ->values();
    }
}
