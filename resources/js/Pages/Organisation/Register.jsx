import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    BuildingOffice2Icon,
    BuildingStorefrontIcon,
    CheckBadgeIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import { Select, TextInput, Textarea } from '../../Components/FormControls';

function suggestCode(name) {
    return name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toUpperCase()
        .slice(0, 30);
}

export default function CompanyRegistration({ companies = [], currencies = [], defaultCurrency = 'USD', stats }) {
    const companyForm = useForm({
        name: '',
        code: '',
        base_currency: defaultCurrency,
        tax_number: '',
        registration_number: '',
        address: '',
    });

    const setField = (field, value) => companyForm.setData({ ...companyForm.data, [field]: value });

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
            preserveScroll: true,
            onSuccess: () => {
                companyForm.reset('name', 'code', 'tax_number', 'registration_number', 'address');
            },
        });
    };

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
                        Structure & access
                        <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard label="Registered companies" value={stats?.companies ?? companies.length} hint="Legal entities" icon={BuildingOffice2Icon} accent="brand" />
                    <StatCard label="Active companies" value={stats?.active_companies ?? companies.filter((company) => company.is_active).length} hint="Currently trading" icon={CheckBadgeIcon} accent="emerald" />
                    <StatCard label="Branches" value={stats?.branches ?? 0} hint="Operating locations" icon={BuildingStorefrontIcon} accent="sky" />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                            <div className="border-b border-slate-100 p-4 sm:p-5">
                                <h2 className="font-display text-base font-semibold text-slate-900">New company</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Company codes must be unique and immutable once used in the ledger.</p>
                            </div>

                            <form onSubmit={submit} className="p-4 sm:p-5">
                                <div className="grid gap-4 sm:grid-cols-2">
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
                                        label="Company code"
                                        id="company_code"
                                        value={companyForm.data.code}
                                        onChange={(event) => setField('code', event.target.value.toUpperCase())}
                                        error={companyForm.errors.code}
                                        hint="Short unique identifier, e.g. ACME."
                                        maxLength={30}
                                    />
                                    <Select
                                        label="Base currency"
                                        id="company_base_currency"
                                        value={companyForm.data.base_currency}
                                        onChange={(event) => setField('base_currency', event.target.value)}
                                        error={companyForm.errors.base_currency}
                                        hint="The ledger posts in this currency."
                                    >
                                        {currencies.map((code) => (
                                            <option key={code} value={code}>{code}</option>
                                        ))}
                                    </Select>
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
                                    <Textarea
                                        label="Registered address"
                                        id="company_address"
                                        value={companyForm.data.address}
                                        onChange={(event) => setField('address', event.target.value)}
                                        error={companyForm.errors.address}
                                        rows={3}
                                        className="sm:col-span-2"
                                        placeholder="Street, city, country"
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
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-slate-900">{company.name}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {company.code} · {company.base_currency}
                                                    {company.registration_number ? ` · ${company.registration_number}` : ''}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    {company.branches_count} {company.branches_count === 1 ? 'branch' : 'branches'}
                                                </p>
                                            </div>
                                            <Badge tone={company.is_active ? 'emerald' : 'slate'} dot>
                                                {company.is_active ? 'active' : 'inactive'}
                                            </Badge>
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
            </div>
        </AppLayout>
    );
}
