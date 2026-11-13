import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    BuildingOffice2Icon,
    BuildingStorefrontIcon,
    IdentificationIcon,
    PencilSquareIcon,
    PlusIcon,
    RectangleGroupIcon,
    TrashIcon,
    UserGroupIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function OrganisationIndex({ companies, branches, departments, costCenters, projects, users, stats, roles, projectStatuses }) {
    const isAdmin = usePage().props.auth?.user?.is_admin;
    const [tab, setTab] = useState('companies');
    const [modal, setModal] = useState(null);

    const companyForm = useForm({ name: '', code: '', base_currency: 'USD', tax_number: '', registration_number: '' });
    const branchForm = useForm({ company_id: '', name: '', code: '', address: '', manager: '' });
    const departmentForm = useForm({ branch_id: '', name: '', code: '', manager: '' });
    const centerForm = useForm({ branch_id: '', department_id: '', name: '', code: '' });
    const projectForm = useForm({ company_id: '', contact_id: '', name: '', code: '', status: 'active', budget: '', start_date: today(), end_date: '', description: '' });

    const tabs = [
        { key: 'companies', label: 'Companies', icon: BuildingOffice2Icon, count: stats.companies },
        { key: 'branches', label: 'Branches', icon: BuildingStorefrontIcon, count: stats.branches },
        { key: 'departments', label: 'Departments', icon: RectangleGroupIcon, count: stats.departments },
        { key: 'costCenters', label: 'Cost centers', icon: IdentificationIcon, count: stats.cost_centers },
        { key: 'projects', label: 'Projects', icon: UserGroupIcon, count: stats.projects },
        { key: 'users', label: 'Users & roles', icon: UsersIcon, count: stats.users },
    ];

    const submitCompany = (event) => submit(event, companyForm, '/organisation/companies', 'company');
    const submitBranch = (event) => submit(event, branchForm, '/organisation/branches', 'branch');
    const submitDepartment = (event) => submit(event, departmentForm, '/organisation/departments', 'department');
    const submitCenter = (event) => submit(event, centerForm, '/organisation/cost-centers', 'center');
    const submitProject = (event) => submit(event, projectForm, '/organisation/projects', 'project');

    function submit(event, form, endpoint, key) {
        event.preventDefault();
        form.post(endpoint, {
            preserveScroll: true,
            onSuccess: () => {
                setModal(null);
                form.reset();
            },
        });
    }

    const updateRole = (user, role) => {
        router.post(`/organisation/users/${user.id}/role`, { role, is_active: user.is_active }, { preserveScroll: true });
    };

    const removeCompany = (company) => {
        if (!confirm(`Delete the registration for ${company.name} (${company.code})? This cannot be undone.`)) {
            return;
        }

        router.delete(`/organisation/companies/${company.id}`, { preserveScroll: true });
    };

    const removeBranch = (branch) => {
        if (!confirm(`Delete branch ${branch.name} (${branch.code})? Departments, cost centers and user assignments will be detached. This cannot be undone.`)) {
            return;
        }

        router.delete(`/organisation/branches/${branch.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout>
            <Head title="Organisation" />

            <div className="space-y-6">
                <PageHeader eyebrow="Organisation" title="Structure & access" description="Manage legal entities, branches, departments, cost centers, projects and role-based access.">
                    {tab !== 'users' && (
                    <button type="button" onClick={() => setModal(tab)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        Add {tab === 'costCenters' ? 'cost center' : tab === 'companies' ? 'company' : tab.slice(0, -1)}
                    </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard label="Companies" value={stats.companies} hint="Legal entities" icon={BuildingOffice2Icon} accent="brand" />
                    <StatCard label="Branches" value={stats.branches} hint="Operating locations" icon={BuildingStorefrontIcon} accent="sky" />
                    <StatCard label="Departments" value={stats.departments} hint="Reporting units" icon={RectangleGroupIcon} accent="violet" />
                    <StatCard label="Cost centers" value={stats.cost_centers} hint="Allocation targets" icon={IdentificationIcon} accent="amber" />
                    <StatCard label="Projects" value={stats.projects} hint="Tracked engagements" icon={UserGroupIcon} accent="emerald" />
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item.key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>
                        </button>
                    ))}
                </div>

                {tab === 'companies' && (
                    <Card title="Companies" description="Each company posts to its own base currency. Register and edit entities on the company register.">
                        {companies.length === 0 ? <EmptyState title="No companies" description="Add a legal entity." icon={BuildingOffice2Icon} /> : (
                            <Table head={['Company', 'Code', 'Base currency', 'Tax number', 'Branches', 'Status', '']}>
                                {companies.map((company) => (
                                    <tr key={company.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                {company.logo_url ? (
                                                    <img src={company.logo_url} alt="" className="h-9 w-9 flex-none rounded-lg border border-slate-200 bg-white object-contain p-1" />
                                                ) : (
                                                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500">
                                                        {company.name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-900">{company.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {company.business_type ? `${company.business_type} · ` : ''}{company.physical_address ?? '—'}
                                                        {company.business_email ? ` · ${company.business_email}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{company.code}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{company.base_currency}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{company.tax_number ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{company.branches_count}</td>
                                        <td className="px-5 py-3.5"><Badge tone={company.is_active ? 'emerald' : 'slate'} dot>{company.is_active ? 'active' : 'inactive'}</Badge></td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link href="/organisation/register" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
                                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                                    Edit
                                                </Link>
                                                {isAdmin && (
                                                    <button type="button" onClick={() => removeCompany(company)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title={`Delete ${company.code}`}>
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'branches' && (
                    <Card title="Branches" description="Branches roll up to a company and hold departments.">
                        {branches.length === 0 ? <EmptyState title="No branches" description="Add a branch location." icon={BuildingStorefrontIcon} /> : (
                            <Table head={['Branch', 'Company', 'Code', 'Manager', 'Departments', 'Status', '']}>
                                {branches.map((branch) => (
                                    <tr key={branch.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{branch.name}</p><p className="text-xs text-slate-500">{branch.address ?? '—'}</p></td>
                                        <td className="px-5 py-3.5 text-slate-600">{branch.company ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{branch.code}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{branch.manager ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{branch.departments_count} · {branch.cost_centers_count} cost centers</td>
                                        <td className="px-5 py-3.5"><Badge tone={branch.is_active ? 'emerald' : 'slate'} dot>{branch.is_active ? 'active' : 'inactive'}</Badge></td>
                                        <td className="px-5 py-3.5 text-right">
                                            {isAdmin && (
                                                <button type="button" onClick={() => removeBranch(branch)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title={`Delete ${branch.code}`}>
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'departments' && (
                    <Card title="Departments" description="Used for departmental P&L and cost allocation.">
                        {departments.length === 0 ? <EmptyState title="No departments" description="Add a department." icon={RectangleGroupIcon} /> : (
                            <Table head={['Department', 'Branch', 'Code', 'Manager', 'Status']}>
                                {departments.map((department) => (
                                    <tr key={department.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5 font-semibold text-slate-900">{department.name}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{department.branch ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{department.code}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{department.manager ?? '—'}</td>
                                        <td className="px-5 py-3.5"><Badge tone={department.is_active ? 'emerald' : 'slate'} dot>{department.is_active ? 'active' : 'inactive'}</Badge></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'costCenters' && (
                    <Card title="Cost centers" description="Allocate shared costs to these centers.">
                        {costCenters.length === 0 ? <EmptyState title="No cost centers" description="Add a cost center." icon={IdentificationIcon} /> : (
                            <Table head={['Cost center', 'Branch', 'Department', 'Code', 'Status']}>
                                {costCenters.map((center) => (
                                    <tr key={center.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5 font-semibold text-slate-900">{center.name}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{center.branch ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{center.department ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{center.code}</td>
                                        <td className="px-5 py-3.5"><Badge tone={center.is_active ? 'emerald' : 'slate'} dot>{center.is_active ? 'active' : 'inactive'}</Badge></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'projects' && (
                    <Card title="Projects" description="Track profitability by project and engagement.">
                        {projects.length === 0 ? <EmptyState title="No projects" description="Add a project to start tracking profitability." icon={UserGroupIcon} /> : (
                            <Table head={['Project', 'Customer', 'Status', 'Budget', 'Timeline']}>
                                {projects.map((project) => (
                                    <tr key={project.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{project.name}</p><p className="text-xs text-slate-500">{project.code} · {project.company ?? '—'}</p></td>
                                        <td className="px-5 py-3.5 text-slate-600">{project.contact ?? '—'}</td>
                                        <td className="px-5 py-3.5"><Badge tone={statusTone(project.status)} dot>{project.status.replace(/_/g, ' ')}</Badge></td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(project.budget)}</td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(project.start_date)} – {formatDate(project.end_date)}</td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'users' && (
                    <Card title="Users & roles" description="Role-based access control for the workspace.">
                        <Table head={['User', 'Department', 'Branch', 'Role', 'Status']}>
                            {users.map((user) => (
                                <tr key={user.id} className="transition hover:bg-slate-50/70">
                                    <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                                    <td className="px-5 py-3.5 text-slate-600">{user.department ?? '—'}</td>
                                    <td className="px-5 py-3.5 text-slate-600">{user.branch ?? '—'}</td>
                                    <td className="px-5 py-3.5">
                                        {isAdmin ? (
                                            <select value={user.role} onChange={(e) => updateRole(user, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500">
                                                {roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                                            </select>
                                        ) : (
                                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{user.role_label}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5"><Badge tone={user.is_active ? 'emerald' : 'slate'} dot>{user.is_active ? 'active' : 'inactive'}</Badge></td>
                                </tr>
                            ))}
                        </Table>
                    </Card>
                )}
            </div>

            <Modal open={modal === 'companies'} onClose={() => setModal(null)} title="New company" footer={<ActionFooter label="Create company" processing={companyForm.processing} form="company-form" onCancel={() => setModal(null)} />}>
                <form id="company-form" onSubmit={submitCompany} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="company_name" value={companyForm.data.name} onChange={(e) => companyForm.setData('name', e.target.value)} error={companyForm.errors.name} />
                        <TextInput label="Code" id="company_code" value={companyForm.data.code} onChange={(e) => companyForm.setData('code', e.target.value)} error={companyForm.errors.code} />
                        <TextInput label="Base currency" id="base_currency" value={companyForm.data.base_currency} onChange={(e) => companyForm.setData('base_currency', e.target.value.toUpperCase())} maxLength={3} error={companyForm.errors.base_currency} />
                        <TextInput label="Tax number" id="tax_number" value={companyForm.data.tax_number} onChange={(e) => companyForm.setData('tax_number', e.target.value)} error={companyForm.errors.tax_number} />
                        <TextInput label="Registration number" id="registration_number" value={companyForm.data.registration_number} onChange={(e) => companyForm.setData('registration_number', e.target.value)} error={companyForm.errors.registration_number} />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'branches'} onClose={() => setModal(null)} title="New branch" footer={<ActionFooter label="Create branch" processing={branchForm.processing} form="branch-form" onCancel={() => setModal(null)} />}>
                <form id="branch-form" onSubmit={submitBranch} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <RichSelect
                            label="Company"
                            id="branch_company"
                            value={branchForm.data.company_id}
                            onChange={(value) => branchForm.setData('company_id', value)}
                            error={branchForm.errors.company_id}
                            placeholder="No company"
                            emptyText="No companies found"
                            options={companies.map((company) => ({
                                value: company.id,
                                primary: company.name,
                                secondary: company.code ?? '',
                                meta: company.base_currency,
                            }))}
                        />
                        <TextInput label="Name" id="branch_name" value={branchForm.data.name} onChange={(e) => branchForm.setData('name', e.target.value)} error={branchForm.errors.name} />
                        <TextInput label="Code" id="branch_code" value={branchForm.data.code} onChange={(e) => branchForm.setData('code', e.target.value)} error={branchForm.errors.code} />
                        <TextInput label="Manager" id="branch_manager" value={branchForm.data.manager} onChange={(e) => branchForm.setData('manager', e.target.value)} error={branchForm.errors.manager} />
                        <TextInput label="Address" id="branch_address" value={branchForm.data.address} onChange={(e) => branchForm.setData('address', e.target.value)} error={branchForm.errors.address} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'departments'} onClose={() => setModal(null)} title="New department" footer={<ActionFooter label="Create department" processing={departmentForm.processing} form="department-form" onCancel={() => setModal(null)} />}>
                <form id="department-form" onSubmit={submitDepartment} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <RichSelect
                            label="Branch"
                            id="department_branch"
                            value={departmentForm.data.branch_id}
                            onChange={(value) => departmentForm.setData('branch_id', value)}
                            error={departmentForm.errors.branch_id}
                            placeholder="No branch"
                            emptyText="No branches found"
                            options={branches.map((branch) => ({
                                value: branch.id,
                                primary: branch.name,
                                secondary: branch.address ?? '',
                                meta: branch.code,
                            }))}
                        />
                        <TextInput label="Name" id="department_name" value={departmentForm.data.name} onChange={(e) => departmentForm.setData('name', e.target.value)} error={departmentForm.errors.name} />
                        <TextInput label="Code" id="department_code" value={departmentForm.data.code} onChange={(e) => departmentForm.setData('code', e.target.value)} error={departmentForm.errors.code} />
                        <TextInput label="Manager" id="department_manager" value={departmentForm.data.manager} onChange={(e) => departmentForm.setData('manager', e.target.value)} error={departmentForm.errors.manager} />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'costCenters'} onClose={() => setModal(null)} title="New cost center" footer={<ActionFooter label="Create cost center" processing={centerForm.processing} form="center-form" onCancel={() => setModal(null)} />}>
                <form id="center-form" onSubmit={submitCenter} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <RichSelect
                            label="Branch"
                            id="center_branch"
                            value={centerForm.data.branch_id}
                            onChange={(value) => centerForm.setData('branch_id', value)}
                            error={centerForm.errors.branch_id}
                            placeholder="No branch"
                            emptyText="No branches found"
                            options={branches.map((branch) => ({
                                value: branch.id,
                                primary: branch.name,
                                secondary: branch.address ?? '',
                                meta: branch.code,
                            }))}
                        />
                        <RichSelect
                            label="Department"
                            id="center_department"
                            value={centerForm.data.department_id}
                            onChange={(value) => centerForm.setData('department_id', value)}
                            error={centerForm.errors.department_id}
                            placeholder="No department"
                            emptyText="No departments found"
                            options={departments.map((department) => ({
                                value: department.id,
                                primary: department.name,
                                secondary: department.branch ?? '',
                                meta: department.code,
                            }))}
                        />
                        <TextInput label="Name" id="center_name" value={centerForm.data.name} onChange={(e) => centerForm.setData('name', e.target.value)} error={centerForm.errors.name} />
                        <TextInput label="Code" id="center_code" value={centerForm.data.code} onChange={(e) => centerForm.setData('code', e.target.value)} error={centerForm.errors.code} />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'projects'} onClose={() => setModal(null)} title="New project" footer={<ActionFooter label="Create project" processing={projectForm.processing} form="project-form" onCancel={() => setModal(null)} />}>
                <form id="project-form" onSubmit={submitProject} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="project_name" value={projectForm.data.name} onChange={(e) => projectForm.setData('name', e.target.value)} error={projectForm.errors.name} />
                        <TextInput label="Code" id="project_code" value={projectForm.data.code} onChange={(e) => projectForm.setData('code', e.target.value)} error={projectForm.errors.code} />
                        <RichSelect
                            label="Company"
                            id="project_company"
                            value={projectForm.data.company_id}
                            onChange={(value) => projectForm.setData('company_id', value)}
                            error={projectForm.errors.company_id}
                            placeholder="No company"
                            emptyText="No companies found"
                            options={companies.map((company) => ({
                                value: company.id,
                                primary: company.name,
                                secondary: company.code ?? '',
                                meta: company.base_currency,
                            }))}
                        />
                        <RichSelect
                            label="Status"
                            id="project_status"
                            value={projectForm.data.status}
                            onChange={(value) => projectForm.setData('status', value)}
                            error={projectForm.errors.status}
                            emptyText="No statuses found"
                            options={projectStatuses.map((status) => ({
                                value: status,
                                primary: status.replace(/_/g, ' '),
                                badge: status === 'active' ? { label: 'Active', classes: 'bg-emerald-50 text-emerald-600' } : undefined,
                            }))}
                        />
                        <TextInput label="Budget" id="project_budget" type="number" step="0.01" value={projectForm.data.budget} onChange={(e) => projectForm.setData('budget', e.target.value)} error={projectForm.errors.budget} />
                        <TextInput label="Start date" id="project_start" type="date" value={projectForm.data.start_date} onChange={(e) => projectForm.setData('start_date', e.target.value)} error={projectForm.errors.start_date} />
                        <TextInput label="End date" id="project_end" type="date" value={projectForm.data.end_date} onChange={(e) => projectForm.setData('end_date', e.target.value)} error={projectForm.errors.end_date} />
                        <Textarea label="Description" id="project_description" value={projectForm.data.description} onChange={(e) => projectForm.setData('description', e.target.value)} error={projectForm.errors.description} rows={3} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}

function Card({ title, description, children }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
                <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
            {children}
        </div>
    );
}

function Table({ head, children }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {head.map((label) => <th key={label} className="px-5 py-3">{label}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{children}</tbody>
            </table>
        </div>
    );
}

function ActionFooter({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">Cancel</button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Saving…' : label}
            </button>
        </>
    );
}
