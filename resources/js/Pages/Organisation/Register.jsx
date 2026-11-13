import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowRightIcon,
    BuildingOffice2Icon,
    BuildingStorefrontIcon,
    CheckBadgeIcon,
    CheckCircleIcon,
    GlobeAltIcon,
    PencilSquareIcon,
    PlusIcon,
    ShieldCheckIcon,
    TrashIcon,
    UserGroupIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Checkbox, RichSelect, TextInput, Textarea, inputClasses } from '../../Components/FormControls';

const logoInputClasses = `${inputClasses} block w-full cursor-pointer rounded-xl border border-slate-300 bg-white text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-l-xl file:border-0 file:border-r file:border-slate-300 file:border-solid file:bg-slate-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-100`;

function suggestCode(name) {
    return name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toUpperCase()
        .slice(0, 30);
}

const blankCompany = {
    name: '',
    code: '',
    base_currency: 'USD',
    business_type: '',
    trading_name: '',
    tax_number: '',
    registration_number: '',
    business_email: '',
    website: '',
    postal_address: '',
    physical_address: '',
};

const registerTabs = [
    { key: 'registration', label: 'Company registration', icon: BuildingOffice2Icon },
    { key: 'users', label: 'Users & permissions', icon: UserGroupIcon },
];

export default function CompanyRegistration({ companies = [], currencies = [], defaultCurrency = 'USD', users = [], roles = [], stats }) {
    const isAdmin = usePage().props.auth?.user?.is_admin;
    const currentUserId = usePage().props.auth?.user?.id;
    const [tab, setTab] = useState('registration');
    const [editing, setEditing] = useState(null);
    const [roleBusy, setRoleBusy] = useState(false);

    const companyForm = useForm({ ...blankCompany, base_currency: defaultCurrency });
    const editForm = useForm({ ...blankCompany, logo: null, clear_logo: false });

    const setField = (field, value) => companyForm.setData({ ...companyForm.data, [field]: value });
    const setEditField = (field, value) => editForm.setData({ ...editForm.data, [field]: value });

    const setName = (value) => {
        const previousSuggestion = suggestCode(companyForm.data.name);
        const keepCode = companyForm.data.code !== '' && companyForm.data.code !== previousSuggestion;

        companyForm.setData({
            ...companyForm.data,
            name: value,
            code: keepCode ? companyForm.data.code : suggestCode(value),
        });
    };

    const submit = (event) => {
        event.preventDefault();

        companyForm.post('/organisation/companies', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => companyForm.reset(),
        });
    };

    const openEdit = (company) => {
        setEditing(company);
        editForm.setData({
            ...blankCompany,
            name: company.name,
            code: company.code,
            base_currency: company.base_currency,
            business_type: company.business_type ?? '',
            trading_name: company.trading_name ?? '',
            tax_number: company.tax_number ?? '',
            registration_number: company.registration_number ?? '',
            business_email: company.business_email ?? '',
            website: company.website ?? '',
            postal_address: company.postal_address ?? '',
            physical_address: company.physical_address ?? '',
            logo: null,
            clear_logo: false,
        });
        editForm.clearErrors();
    };

    const closeEdit = () => {
        setEditing(null);
        editForm.clearErrors();
    };

    const submitEdit = (event) => {
        event.preventDefault();

        editForm.put(`/organisation/companies/${editing.id}`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => closeEdit(),
        });
    };

    const removeCompany = (company) => {
        if (!confirm(`Delete the registration for ${company.name} (${company.code})? This cannot be undone.`)) {
            return;
        }

        router.delete(`/organisation/companies/${company.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                if (editing?.id === company.id) {
                    closeEdit();
                }
            },
        });
    };

    const changeRole = (user, role) => {
        if (!role || role === user.role) {
            return;
        }

        setRoleBusy(true);
        router.post(`/organisation/users/${user.id}/role`, { role, is_active: user.is_active }, {
            preserveScroll: true,
            onFinish: () => setRoleBusy(false),
        });
    };

    const toggleActive = (user) => {
        router.post(`/organisation/users/${user.id}/role`, { role: user.role, is_active: !user.is_active }, { preserveScroll: true });
    };

    const isSelf = (user) => user.id === currentUserId;

    return (
        <AppLayout>
            <Head title="Company registration" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Organisation"
                    title="Company registration"
                    description="Register a legal entity with its statutory details and reporting currency. You can add branches, departments, and cost centers afterwards."
                >
                    <Link
                        href="/organisation"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                        Structure &amp; access
                        <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Registered companies" value={stats?.companies ?? companies.length} hint="Legal entities" icon={BuildingOffice2Icon} accent="brand" />
                    <StatCard label="Active companies" value={stats?.active_companies ?? companies.filter((company) => company.is_active).length} hint="Currently trading" icon={CheckBadgeIcon} accent="emerald" />
                    <StatCard label="Branches" value={stats?.branches ?? 0} hint="Operating locations" icon={BuildingStorefrontIcon} accent="sky" />
                    <StatCard label="Workspace users" value={stats?.users ?? users.length} hint="People with access" icon={UserGroupIcon} accent="violet" />
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
                    {registerTabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === 'registration' && (
                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-4 sm:p-5">
                                <h2 className="font-display text-base font-semibold text-slate-900">New company</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Company codes must be unique and immutable once used in the ledger.</p>
                            </div>

                            <form onSubmit={submit} className="p-4 sm:p-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="company_logo" className="mb-1.5 block text-sm font-medium text-slate-700">Company logo</label>
                                        <input
                                            id="company_logo"
                                            name="logo"
                                            type="file"
                                            accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
                                            onChange={(event) => companyForm.setData('logo', event.target.files[0] ?? null)}
                                            className={logoInputClasses}
                                        />
                                        <p className="mt-1.5 text-xs text-slate-500">JPG, PNG or SVG — up to 2 MB.</p>
                                        {companyForm.errors.logo && <p className="mt-1.5 text-xs font-medium text-rose-600">{companyForm.errors.logo}</p>}
                                    </div>
                                    <TextInput
                                        label="Business type"
                                        id="company_business_type"
                                        value={companyForm.data.business_type}
                                        onChange={(event) => setField('business_type', event.target.value)}
                                        error={companyForm.errors.business_type}
                                        placeholder="e.g. Manufacturing, Retail, Services"
                                    />
                                    <TextInput
                                        label="Legal name"
                                        id="company_name"
                                        value={companyForm.data.name}
                                        onChange={(event) => setName(event.target.value)}
                                        error={companyForm.errors.name}
                                        placeholder="Acme Trading Ltd"
                                        autoFocus
                                    />
                                    <TextInput
                                        label="Trading name"
                                        id="company_trading_name"
                                        value={companyForm.data.trading_name}
                                        onChange={(event) => setField('trading_name', event.target.value)}
                                        error={companyForm.errors.trading_name}
                                        placeholder="Acme"
                                    />
                                    <TextInput
                                        label="Company code"
                                        id="company_code"
                                        value={companyForm.data.code}
                                        onChange={(event) => setField('code', event.target.value.toUpperCase())}
                                        error={companyForm.errors.code}
                                        hint="Short unique identifier, e.g. ACME."
                                        maxLength={30}
                                    />
                                    <RichSelect
                                        label="Base currency"
                                        id="company_base_currency"
                                        value={companyForm.data.base_currency}
                                        onChange={(value) => setField('base_currency', value)}
                                        error={companyForm.errors.base_currency}
                                        hint="The ledger posts in this currency."
                                        emptyText="No currencies found"
                                        options={currencies.map((code) => ({ value: code, primary: code }))}
                                    />
                                    <TextInput
                                        label="Tax number"
                                        id="company_tax_number"
                                        value={companyForm.data.tax_number}
                                        onChange={(event) => setField('tax_number', event.target.value)}
                                        error={companyForm.errors.tax_number}
                                        placeholder="VAT / TIN"
                                    />
                                    <TextInput
                                        label="Registration number"
                                        id="company_registration_number"
                                        value={companyForm.data.registration_number}
                                        onChange={(event) => setField('registration_number', event.target.value)}
                                        error={companyForm.errors.registration_number}
                                        placeholder="Companies registry number"
                                    />
                                    <TextInput
                                        label="Business email"
                                        id="company_business_email"
                                        type="email"
                                        value={companyForm.data.business_email}
                                        onChange={(event) => setField('business_email', event.target.value)}
                                        error={companyForm.errors.business_email}
                                        placeholder="billing@acme.example"
                                    />
                                    <TextInput
                                        label="Website"
                                        id="company_website"
                                        value={companyForm.data.website}
                                        onChange={(event) => setField('website', event.target.value)}
                                        error={companyForm.errors.website}
                                        placeholder="https://acme.example"
                                    />
                                    <Textarea
                                        label="Postal / digital address"
                                        id="company_postal_address"
                                        value={companyForm.data.postal_address}
                                        onChange={(event) => setField('postal_address', event.target.value)}
                                        error={companyForm.errors.postal_address}
                                        rows={2}
                                        placeholder="PO Box, digital address (e.g. GA-123-4567)"
                                    />
                                    <Textarea
                                        label="Physical location"
                                        id="company_physical_address"
                                        value={companyForm.data.physical_address}
                                        onChange={(event) => setField('physical_address', event.target.value)}
                                        error={companyForm.errors.physical_address}
                                        rows={2}
                                        placeholder="Street, city, region, country"
                                        className="sm:col-span-2"
                                    />
                                </div>

                                <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => companyForm.reset()}
                                        disabled={companyForm.processing}
                                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={companyForm.processing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        {companyForm.processing ? 'Registering…' : 'Register company'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
                                <div>
                                    <h2 className="font-display text-base font-semibold text-slate-900">Registered companies</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">Entities already in this workspace.</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{companies.length}</span>
                            </div>

                            {companies.length === 0 ? (
                                <EmptyState title="No companies yet" description="Register your first legal entity using the form." icon={BuildingOffice2Icon} />
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {companies.map((company) => (
                                        <li key={company.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                                            <div className="flex min-w-0 gap-3">
                                                {company.logo_url ? (
                                                    <img
                                                        src={company.logo_url}
                                                        alt={`${company.name} logo`}
                                                        className="h-10 w-10 flex-none rounded-lg border border-slate-200 bg-white object-contain p-1"
                                                    />
                                                ) : (
                                                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                                                        {company.name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-900">{company.name}</p>
                                                    {company.trading_name && company.trading_name !== company.name && (
                                                        <p className="mt-0.5 truncate text-xs text-slate-500">Trading as {company.trading_name}</p>
                                                    )}
                                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                                        {company.code} · {company.base_currency}
                                                        {company.registration_number ? ` · ${company.registration_number}` : ''}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-400">
                                                        {company.business_type ? `${company.business_type} · ` : ''}
                                                        {company.branches_count} {company.branches_count === 1 ? 'branch' : 'branches'}
                                                    </p>
                                                    {(company.business_email || company.website) && (
                                                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                                                            {company.website && <GlobeAltIcon className="h-3.5 w-3.5 flex-none" />}
                                                            {company.website ?? company.business_email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-none flex-col items-end gap-2">
                                                <Badge tone={company.is_active ? 'emerald' : 'slate'} dot>
                                                    {company.is_active ? 'active' : 'inactive'}
                                                </Badge>
                                                <div className="flex items-center gap-1.5">
                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(company)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                                                        >
                                                            <PencilSquareIcon className="h-3.5 w-3.5" />
                                                            Edit
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCompany(company)}
                                                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                            title={`Delete ${company.code}`}
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
                            <h3 className="text-sm font-semibold text-brand-900">What happens next?</h3>
                            <ul className="mt-2 space-y-1.5 text-xs text-brand-800/80">
                                <li>• Add branches and departments under Structure &amp; access.</li>
                                <li>• Set the base currency before posting any entries.</li>
                                <li>• Assign users a role to control who can register entities.</li>
                            </ul>
                        </div>
                    </aside>
                </div>
                )}

                {tab === 'users' && (
                    <div className="space-y-6">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
                                <div>
                                    <h2 className="font-display text-base font-semibold text-slate-900">Users</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        People with access to this workspace.
                                        {isAdmin ? ' Administrators can change roles and deactivate accounts below.' : ' Only administrators can change roles.'}
                                    </p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{users.length}</span>
                            </div>

                            {users.length === 0 ? (
                                <EmptyState title="No users yet" description="Invited team members appear here." icon={UserGroupIcon} />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                <th className="px-5 py-3">User</th>
                                                <th className="px-5 py-3">Role</th>
                                                <th className="px-5 py-3">Department</th>
                                                <th className="px-5 py-3">Branch</th>
                                                <th className="px-5 py-3">Status</th>
                                                {isAdmin && <th className="px-5 py-3 text-right">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map((user) => (
                                                <tr key={user.id} className="transition hover:bg-slate-50/70">
                                                    <td className="px-5 py-3.5">
                                                        <p className="font-semibold text-slate-900">
                                                            {user.name}
                                                            {isSelf(user) && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">YOU</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{user.email}</p>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        {isAdmin && !isSelf(user) ? (
                                                            <select
                                                                value={user.role}
                                                                onChange={(event) => changeRole(user, event.target.value)}
                                                                disabled={roleBusy}
                                                                className={`${inputClasses} min-w-44`}
                                                                aria-label={`Role for ${user.name}`}
                                                            >
                                                                {roles.map((role) => (
                                                                    <option key={role.key} value={role.key}>{role.label}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div>
                                                                <p className="font-medium text-slate-800">{user.role_label}</p>
                                                                <p className="mt-0.5 text-xs text-slate-400">
                                                                    {[user.is_admin && 'Full control', user.can_approve && 'Approves entries', user.can_write && 'Records transactions']
                                                                        .filter(Boolean)
                                                                        .join(' · ') || 'Read-only access'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600">{user.department ?? '—'}</td>
                                                    <td className="px-5 py-3.5 text-slate-600">{user.branch ?? '—'}</td>
                                                    <td className="px-5 py-3.5"><Badge tone={user.is_active ? 'emerald' : 'slate'} dot>{user.is_active ? 'active' : 'deactivated'}</Badge></td>
                                                    {isAdmin && (
                                                        <td className="px-5 py-3.5 text-right">
                                                            {isSelf(user) ? (
                                                                <span className="text-xs text-slate-400">—</span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleActive(user)}
                                                                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                                                                >
                                                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-4 sm:p-5">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
                                    <h2 className="font-display text-base font-semibold text-slate-900">Permission levels</h2>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500">Every role maps onto the workspace permission gates: record transactions, approve entries, and full administrative control.</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Role</th>
                                            <th className="px-5 py-3 text-center">Record transactions</th>
                                            <th className="px-5 py-3 text-center">Approve entries</th>
                                            <th className="px-5 py-3 text-center">Manage workspace</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {roles.map((role) => (
                                            <tr key={role.key} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-semibold text-slate-900">{role.label}</p>
                                                    <p className="text-xs uppercase tracking-wide text-slate-400">{role.key}</p>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">{role.can_write ? <CheckCircleIcon className="mx-auto h-5 w-5 text-emerald-600" /> : <XCircleIcon className="mx-auto h-5 w-5 text-slate-300" />}</td>
                                                <td className="px-5 py-3.5 text-center">{role.can_approve ? <CheckCircleIcon className="mx-auto h-5 w-5 text-emerald-600" /> : <XCircleIcon className="mx-auto h-5 w-5 text-slate-300" />}</td>
                                                <td className="px-5 py-3.5 text-center">{role.is_admin ? <CheckCircleIcon className="mx-auto h-5 w-5 text-emerald-600" /> : <XCircleIcon className="mx-auto h-5 w-5 text-slate-300" />}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
                            <h3 className="text-sm font-semibold text-brand-900">How permissions work</h3>
                            <ul className="mt-2 space-y-1.5 text-xs text-brand-800/80">
                                <li>• Administrators manage everything: companies, users, currencies and platform settings.</li>
                                <li>• General managers record and approve transactions but cannot manage users.</li>
                                <li>• Accountants and cashiers record transactions; their postings wait for an approval.</li>
                                <li>• Auditors and viewers have read-only access across reports and the ledger.</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={editing !== null}
                onClose={closeEdit}
                title={editing ? `Edit ${editing.name}` : 'Edit company'}
                description="Update the statutory and contact details of this legal entity."
                footer={<ActionFooter label={editForm.processing ? 'Saving…' : 'Save changes'} processing={editForm.processing} form="edit-company-form" onCancel={closeEdit} />}
            >
                {editing && (
                    <form id="edit-company-form" onSubmit={submitEdit} className="space-y-4">
                        {editing.logo_url && !editForm.data.clear_logo && (
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <img src={editing.logo_url} alt="" className="h-12 w-12 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                                <p className="text-xs text-slate-500">Current logo — upload a new file to replace it, or clear it below.</p>
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="edit_logo" className="mb-1.5 block text-sm font-medium text-slate-700">Company logo</label>
                                <input
                                    id="edit_logo"
                                    name="logo"
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.svg,image/jpeg,image/png,image/svg+xml"
                                    onChange={(event) => editForm.setData('logo', event.target.files[0] ?? null)}
                                    className={logoInputClasses}
                                />
                                <p className="mt-1.5 text-xs text-slate-500">JPG, PNG or SVG — up to 2 MB.</p>
                                {editForm.errors.logo && <p className="mt-1.5 text-xs font-medium text-rose-600">{editForm.errors.logo}</p>}
                            </div>
                            <TextInput
                                label="Business type"
                                id="edit_business_type"
                                value={editForm.data.business_type}
                                onChange={(event) => setEditField('business_type', event.target.value)}
                                error={editForm.errors.business_type}
                            />
                            <TextInput
                                label="Legal name"
                                id="edit_name"
                                value={editForm.data.name}
                                onChange={(event) => setEditField('name', event.target.value)}
                                error={editForm.errors.name}
                            />
                            <TextInput
                                label="Trading name"
                                id="edit_trading_name"
                                value={editForm.data.trading_name}
                                onChange={(event) => setEditField('trading_name', event.target.value)}
                                error={editForm.errors.trading_name}
                            />
                            <TextInput
                                label="Company code"
                                id="edit_code"
                                value={editForm.data.code}
                                onChange={(event) => setEditField('code', event.target.value.toUpperCase())}
                                error={editForm.errors.code}
                                maxLength={30}
                            />
                            <RichSelect
                                label="Base currency"
                                id="edit_base_currency"
                                value={editForm.data.base_currency}
                                onChange={(value) => setEditField('base_currency', value)}
                                error={editForm.errors.base_currency}
                                emptyText="No currencies found"
                                options={currencies.map((code) => ({ value: code, primary: code }))}
                            />
                            <TextInput
                                label="Tax number"
                                id="edit_tax_number"
                                value={editForm.data.tax_number}
                                onChange={(event) => setEditField('tax_number', event.target.value)}
                                error={editForm.errors.tax_number}
                            />
                            <TextInput
                                label="Registration number"
                                id="edit_registration_number"
                                value={editForm.data.registration_number}
                                onChange={(event) => setEditField('registration_number', event.target.value)}
                                error={editForm.errors.registration_number}
                            />
                            <TextInput
                                label="Business email"
                                id="edit_business_email"
                                type="email"
                                value={editForm.data.business_email}
                                onChange={(event) => setEditField('business_email', event.target.value)}
                                error={editForm.errors.business_email}
                            />
                            <TextInput
                                label="Website"
                                id="edit_website"
                                value={editForm.data.website}
                                onChange={(event) => setEditField('website', event.target.value)}
                                error={editForm.errors.website}
                            />
                            <Textarea
                                label="Postal / digital address"
                                id="edit_postal_address"
                                value={editForm.data.postal_address}
                                onChange={(event) => setEditField('postal_address', event.target.value)}
                                error={editForm.errors.postal_address}
                                rows={2}
                            />
                            <Textarea
                                label="Physical location"
                                id="edit_physical_address"
                                value={editForm.data.physical_address}
                                onChange={(event) => setEditField('physical_address', event.target.value)}
                                error={editForm.errors.physical_address}
                                rows={2}
                                className="sm:col-span-2"
                            />
                        </div>
                        {editing.logo_url && (
                            <Checkbox
                                label="Clear company logo"
                                id="edit_clear_logo"
                                checked={editForm.data.clear_logo}
                                onChange={(event) => editForm.setData('clear_logo', event.target.checked)}
                                description="Removes the current logo. Ignored if you upload a new file."
                            />
                        )}
                    </form>
                )}
            </Modal>
        </AppLayout>
    );
}

function ActionFooter({ label, processing, form, onCancel }) {
    return (
        <div className="flex items-center justify-end gap-2">
            <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
            >
                Cancel
            </button>
            <button
                type="submit"
                form={form}
                disabled={processing}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
                {label}
            </button>
        </div>
    );
}
