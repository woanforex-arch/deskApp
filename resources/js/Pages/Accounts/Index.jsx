import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    BanknotesIcon,
    BuildingLibraryIcon,
    CheckCircleIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    ScaleIcon,
    Squares2X2Icon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Checkbox, RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { currency, statusTone } from '../../lib/format';

const accentByType = {
    asset: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    liability: 'bg-amber-50 text-amber-700 ring-amber-200',
    equity: 'bg-violet-50 text-violet-700 ring-violet-200',
    revenue: 'bg-brand-50 text-brand-700 ring-brand-200',
    expense: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const blankAccount = {
    code: '',
    name: '',
    type: 'asset',
    parent_id: '',
    category: '',
    currency: '',
    is_control: false,
    opening_balance: '',
    description: '',
    is_active: true,
};

const categoryLabel = (value) =>
    value ? value.replaceAll('_', ' ').replaceAll('-', ' ') : '';

const tabs = [
    { key: 'chart', label: 'Chart of accounts', icon: Squares2X2Icon },
    { key: 'configuration', label: 'Accounting configuration', icon: Cog6ToothIcon },
    { key: 'financials', label: 'Company financial information', icon: BuildingLibraryIcon },
];

const configFields = [
    'default_cash_account_id',
    'default_bank_account_id',
    'default_sales_account_id',
    'default_receivable_account_id',
    'default_payable_account_id',
    'inventory_control_account_id',
    'cost_of_sales_account_id',
    'retained_earnings_account_id',
    'opening_balance_account_id',
];

const financialFields = [
    'opening_fiscal_year',
    'opening_cash_balance',
    'opening_inventory_value',
    'outstanding_customer_balances',
    'outstanding_supplier_balances',
    'existing_assets_value',
    'existing_liabilities_value',
    'share_capital',
];

const toNumber = (value) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
};

export default function AccountsIndex({
    accounts,
    summary,
    filters,
    types,
    categories = [],
    parents = [],
    settings = {},
    bankAccounts = [],
}) {
    const page = usePage();
    const canWrite = page.props.auth?.user?.can_write;
    const [tab, setTab] = useState('chart');
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType] = useState(filters.type ?? '');
    const [category, setCategory] = useState(filters.category ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const form = useForm({ ...blankAccount });

    const configDefaults = Object.fromEntries(
        configFields.map((field) => [field, settings[field] ?? '']),
    );
    const financialDefaults = Object.fromEntries(
        financialFields.map((field) => [field, settings[field] ?? (field === 'opening_fiscal_year' ? '' : 0)]),
    );

    const configForm = useForm({ ...configDefaults });
    const financialForm = useForm({ ...financialDefaults });

    const configuredCount = configFields.filter((field) => Boolean(configDefaults[field])).length;

    const openingAssets =
        toNumber(financialForm.data.opening_cash_balance) +
        toNumber(financialForm.data.opening_inventory_value) +
        toNumber(financialForm.data.outstanding_customer_balances) +
        toNumber(financialForm.data.existing_assets_value);
    const openingFunding =
        toNumber(financialForm.data.outstanding_supplier_balances) +
        toNumber(financialForm.data.existing_liabilities_value) +
        toNumber(financialForm.data.share_capital);
    const openingDifference = Math.round((openingAssets - openingFunding) * 100) / 100;
    const openingBalanced = Math.abs(openingDifference) < 0.005;

    const accountsOfType = (accountType) =>
        parents.filter((account) => account.type === accountType);

    const applyFilters = (event) => {
        event?.preventDefault();

        router.get(
            '/accounts',
            {
                ...(search ? { search } : {}),
                ...(type ? { type } : {}),
                ...(category ? { category } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setType('');
        setCategory('');
        router.get('/accounts', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...blankAccount });
        form.clearErrors();
        setOpen(true);
    };

    const openEdit = (account) => {
        setEditing(account);
        form.setData({
            code: account.code,
            name: account.name,
            type: account.type,
            parent_id: account.parent_id ?? '',
            category: account.category ?? '',
            currency: account.currency ?? '',
            is_control: Boolean(account.is_control),
            opening_balance: account.opening_balance ?? '',
            description: account.description ?? '',
            is_active: Boolean(account.is_active),
        });
        form.clearErrors();
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
    };

    const submit = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                closeModal();
                form.reset();
            },
        };

        if (editing) {
            form.put(`/accounts/${editing.id}`, options);
        } else {
            form.post('/accounts', options);
        }
    };

    const remove = (account) => {
        if (confirm(`Delete account ${account.code} · ${account.name}?`)) {
            router.delete(`/accounts/${account.id}`, { preserveScroll: true });
        }
    };

    const submitConfiguration = (event) => {
        event.preventDefault();

        configForm.put('/accounts/configuration', { preserveScroll: true, preserveState: true });
    };

    const submitFinancials = (event) => {
        event.preventDefault();

        financialForm.put('/accounts/financials', { preserveScroll: true, preserveState: true });
    };

    const hasFilters = Boolean(filters.search || filters.type || filters.category);

    return (
        <AppLayout>
            <Head title="Chart of accounts" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Ledger"
                    title="Chart of accounts"
                    description="The structure behind every journal entry, report, and balance in the books."
                >
                    {tab === 'chart' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                                <Squares2X2Icon className="h-4 w-4 text-slate-400" />
                                {accounts.length} accounts in view
                            </span>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={openCreate}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    New account
                                </button>
                            )}
                        </div>
                    )}
                </PageHeader>

                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
                    {tabs.map((item) => (
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

                {tab === 'chart' && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {summary.map((group) => (
                        <div key={group.type} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${accentByType[group.type] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                                    {group.label}
                                </span>
                                <span className="text-xs font-medium text-slate-400">{group.count}</span>
                            </div>
                            <p className="mt-3 font-display text-lg font-semibold text-slate-900">{currency(group.total)}</p>
                            <p className="text-[11px] text-slate-500">Normal balance total</p>
                        </div>
                    ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Accounts</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Balances are calculated from posted journal lines only.
                            </p>
                        </div>

                        <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search code or name…"
                                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-56"
                                />
                            </div>

                            <RichSelect
                                value={type}
                                onChange={(value) => setType(value)}
                                placeholder="All types"
                                options={types.map((option) => ({
                                    value: option.value,
                                    primary: option.label,
                                }))}
                                className="w-full sm:w-auto"
                            />

                            <RichSelect
                                value={category}
                                onChange={(value) => setCategory(value)}
                                placeholder="All categories"
                                options={categories.map((option) => ({
                                    value: option.value,
                                    primary: option.label,
                                }))}
                                className="w-full sm:w-auto"
                            />

                            <button
                                type="submit"
                                className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                            >
                                Filter
                            </button>

                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                    Reset
                                </button>
                            )}
                        </form>
                    </div>

                    {accounts.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No accounts match your filters' : 'No accounts yet'}
                            description={
                                hasFilters
                                    ? 'Try a different type or search term.'
                                    : 'Add your first account to start building the chart of accounts.'
                            }
                            icon={BanknotesIcon}
                            action={
                                hasFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                                    >
                                        Clear filters
                                    </button>
                                ) : (
                                    canWrite && (
                                        <button
                                            type="button"
                                            onClick={openCreate}
                                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                        >
                                            New account
                                        </button>
                                    )
                                )
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Code</th>
                                        <th className="px-5 py-3">Account</th>
                                        <th className="px-5 py-3">Type</th>
                                        <th className="px-5 py-3">Normal balance</th>
                                        <th className="px-5 py-3 text-right">Balance</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {accounts.map((account) => (
                                        <tr key={account.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-slate-500">
                                                {account.code}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className={`font-semibold text-slate-900 ${account.parent_id ? '' : 'text-slate-800'}`}>
                                                    {account.name}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    {account.category && (
                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
                                                            {categoryLabel(account.category)}
                                                        </span>
                                                    )}
                                                    {account.is_control && (
                                                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                                            Control
                                                        </span>
                                                    )}
                                                </div>
                                                {account.description && (
                                                    <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                                                        {account.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5">
                                                <Badge tone={statusTone(account.type)}>{account.type_label}</Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 capitalize text-slate-500">
                                                {account.normal_balance}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                {currency(account.balance)}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5">
                                                <Badge tone={account.is_active ? 'emerald' : 'slate'} dot>
                                                    {account.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canWrite && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(account)}
                                                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                                                            title="Edit account"
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {canWrite && (
                                                        <button
                                                            type="button"
                                                            onClick={() => remove(account)}
                                                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                            title="Delete account"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <span className="inline-flex items-center gap-1.5">
                            <ScaleIcon className="h-4 w-4 text-slate-400" />
                            Account balances roll up from the general journal.
                        </span>
                        <a href="/api/v1/reports/trial-balance" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:text-brand-700">
                            View trial balance API →
                        </a>
                    </div>
                    </div>
                </>
                )}

                {tab === 'configuration' && (
                    <form onSubmit={submitConfiguration} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Accounting configuration</h2>
                                <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                                    Choose the ledger accounts that automated postings fall back to. Leave a default blank to use the standard account code.
                                </p>
                            </div>
                            <span className="inline-flex flex-none items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                                <Cog6ToothIcon className="h-4 w-4 text-slate-400" />
                                {configuredCount} of {configFields.length} configured
                            </span>
                        </div>

                        <div className="space-y-7 p-4 sm:p-5">
                            <section>
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Cash &amp; banking</h3>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <RichSelect
                                            label="Default cash account"
                                            id="default_cash_account_id"
                                            value={configForm.data.default_cash_account_id ?? ''}
                                            onChange={(value) => configForm.setData('default_cash_account_id', value)}
                                            error={configForm.errors.default_cash_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('asset').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.default_cash_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Used for cash receipts and petty-cash postings.</p>
                                        )}
                                    </div>

                                    <div>
                                        <RichSelect
                                            label="Default bank account"
                                            id="default_bank_account_id"
                                            value={configForm.data.default_bank_account_id ?? ''}
                                            onChange={(value) => configForm.setData('default_bank_account_id', value)}
                                            error={configForm.errors.default_bank_account_id}
                                            placeholder="Not configured"
                                            emptyText="No bank accounts match that search"
                                            options={bankAccounts.map((bankAccount) => ({
                                                value: bankAccount.id,
                                                primary: bankAccount.name,
                                                secondary: bankAccount.gl_account ? `${bankAccount.gl_account.code} · ${bankAccount.gl_account.name}` : undefined,
                                                meta: bankAccount.account_number ?? undefined,
                                            }))}
                                        />
                                        {!configForm.errors.default_bank_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">
                                                Bank receipts and payments use this account's ledger.
                                            </p>
                                        )}
                                        {bankAccounts.length === 0 && (
                                            <p className="mt-1.5 text-xs text-slate-500">
                                                No bank accounts yet.{' '}
                                                <Link href="/banking" className="font-semibold text-brand-600 hover:text-brand-700">
                                                    Add one under Banking
                                                </Link>{' '}
                                                to map a default.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Sales &amp; receivables</h3>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <RichSelect
                                            label="Default sales account"
                                            id="default_sales_account_id"
                                            value={configForm.data.default_sales_account_id ?? ''}
                                            onChange={(value) => configForm.setData('default_sales_account_id', value)}
                                            error={configForm.errors.default_sales_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('revenue').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.default_sales_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Income account used when an invoice line has none.</p>
                                        )}
                                    </div>

                                    <div>
                                        <RichSelect
                                            label="Accounts receivable"
                                            id="default_receivable_account_id"
                                            value={configForm.data.default_receivable_account_id ?? ''}
                                            onChange={(value) => configForm.setData('default_receivable_account_id', value)}
                                            error={configForm.errors.default_receivable_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('asset').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.default_receivable_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Control account for customer balances.</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Purchases &amp; inventory</h3>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <RichSelect
                                            label="Accounts payable"
                                            id="default_payable_account_id"
                                            value={configForm.data.default_payable_account_id ?? ''}
                                            onChange={(value) => configForm.setData('default_payable_account_id', value)}
                                            error={configForm.errors.default_payable_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('liability').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.default_payable_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Control account for supplier balances.</p>
                                        )}
                                    </div>

                                    <div>
                                        <RichSelect
                                            label="Inventory control account"
                                            id="inventory_control_account_id"
                                            value={configForm.data.inventory_control_account_id ?? ''}
                                            onChange={(value) => configForm.setData('inventory_control_account_id', value)}
                                            error={configForm.errors.inventory_control_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('asset').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.inventory_control_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Stock value posted from inventory movements.</p>
                                        )}
                                    </div>

                                    <div>
                                        <RichSelect
                                            label="Cost of sales account"
                                            id="cost_of_sales_account_id"
                                            value={configForm.data.cost_of_sales_account_id ?? ''}
                                            onChange={(value) => configForm.setData('cost_of_sales_account_id', value)}
                                            error={configForm.errors.cost_of_sales_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('expense').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.cost_of_sales_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Expense account for the cost of goods sold.</p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Equity &amp; opening balances</h3>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <RichSelect
                                            label="Retained earnings account"
                                            id="retained_earnings_account_id"
                                            value={configForm.data.retained_earnings_account_id ?? ''}
                                            onChange={(value) => configForm.setData('retained_earnings_account_id', value)}
                                            error={configForm.errors.retained_earnings_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('equity').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.retained_earnings_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Carries prior-year results into the new year.</p>
                                        )}
                                    </div>

                                    <div>
                                        <RichSelect
                                            label="Opening balance account"
                                            id="opening_balance_account_id"
                                            value={configForm.data.opening_balance_account_id ?? ''}
                                            onChange={(value) => configForm.setData('opening_balance_account_id', value)}
                                            error={configForm.errors.opening_balance_account_id}
                                            placeholder="Not configured"
                                            emptyText="No accounts match that search"
                                            options={accountsOfType('equity').map((account) => ({
                                                value: account.id,
                                                primary: account.name,
                                                secondary: categoryLabel(account.category) || undefined,
                                                meta: account.code,
                                            }))}
                                        />
                                        {!configForm.errors.opening_balance_account_id && (
                                            <p className="mt-1.5 text-xs text-slate-500">Balancing equity account for opening entries.</p>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <p className="max-w-xl text-xs text-slate-500">
                                These defaults are picked up by automated postings whenever a transaction does not specify an account.
                            </p>
                            <div className="flex flex-none items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        configForm.setData({ ...configDefaults });
                                        configForm.clearErrors();
                                    }}
                                    disabled={configForm.processing}
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                                >
                                    Clear changes
                                </button>
                                <button
                                    type="submit"
                                    disabled={configForm.processing}
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {configForm.processing ? 'Saving…' : 'Save configuration'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {tab === 'financials' && (
                    <form onSubmit={submitFinancials} className="grid gap-6 xl:grid-cols-3">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-2">
                            <div className="border-b border-slate-100 p-4 sm:p-5">
                                <h2 className="font-display text-base font-semibold text-slate-900">Company financial information</h2>
                                <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
                                    Capture the opening position of the business when the books begin. These figures are stored with the accounting settings.
                                </p>
                            </div>

                            <div className="space-y-7 p-4 sm:p-5">
                                <section>
                                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Period</h3>
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                        <TextInput
                                            label="Opening financial year"
                                            id="opening_fiscal_year"
                                            type="number"
                                            min="1900"
                                            max="2200"
                                            value={financialForm.data.opening_fiscal_year ?? ''}
                                            onChange={(event) => financialForm.setData('opening_fiscal_year', event.target.value)}
                                            error={financialForm.errors.opening_fiscal_year}
                                            placeholder="e.g. 2026"
                                            hint="The year these opening balances belong to."
                                        />
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Opening assets</h3>
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                        <TextInput
                                            label="Opening cash balance"
                                            id="opening_cash_balance"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.opening_cash_balance}
                                            onChange={(event) => financialForm.setData('opening_cash_balance', event.target.value)}
                                            error={financialForm.errors.opening_cash_balance}
                                            placeholder="0.00"
                                            hint="Cash on hand and at bank."
                                        />
                                        <TextInput
                                            label="Opening inventory value"
                                            id="opening_inventory_value"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.opening_inventory_value}
                                            onChange={(event) => financialForm.setData('opening_inventory_value', event.target.value)}
                                            error={financialForm.errors.opening_inventory_value}
                                            placeholder="0.00"
                                            hint="Stock valued at cost on day one."
                                        />
                                        <TextInput
                                            label="Outstanding customer balances"
                                            id="outstanding_customer_balances"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.outstanding_customer_balances}
                                            onChange={(event) => financialForm.setData('outstanding_customer_balances', event.target.value)}
                                            error={financialForm.errors.outstanding_customer_balances}
                                            placeholder="0.00"
                                            hint="Receivables carried into the new books."
                                        />
                                        <TextInput
                                            label="Existing assets"
                                            id="existing_assets_value"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.existing_assets_value}
                                            onChange={(event) => financialForm.setData('existing_assets_value', event.target.value)}
                                            error={financialForm.errors.existing_assets_value}
                                            placeholder="0.00"
                                            hint="Property, equipment and other long-term assets."
                                        />
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Liabilities &amp; equity</h3>
                                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                        <TextInput
                                            label="Outstanding supplier balances"
                                            id="outstanding_supplier_balances"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.outstanding_supplier_balances}
                                            onChange={(event) => financialForm.setData('outstanding_supplier_balances', event.target.value)}
                                            error={financialForm.errors.outstanding_supplier_balances}
                                            placeholder="0.00"
                                            hint="Payables carried into the new books."
                                        />
                                        <TextInput
                                            label="Existing liabilities"
                                            id="existing_liabilities_value"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.existing_liabilities_value}
                                            onChange={(event) => financialForm.setData('existing_liabilities_value', event.target.value)}
                                            error={financialForm.errors.existing_liabilities_value}
                                            placeholder="0.00"
                                            hint="Loans, tax and other obligations."
                                        />
                                        <TextInput
                                            label="Share capital or owner's equity"
                                            id="share_capital"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={financialForm.data.share_capital}
                                            onChange={(event) => financialForm.setData('share_capital', event.target.value)}
                                            error={financialForm.errors.share_capital}
                                            placeholder="0.00"
                                            hint="Capital introduced by the owners."
                                        />
                                    </div>
                                </section>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                <p className="max-w-xl text-xs text-slate-500">
                                    Use the opening balance account in a journal entry to bring these figures into the ledger.
                                </p>
                                <div className="flex flex-none items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            financialForm.setData({ ...financialDefaults });
                                            financialForm.clearErrors();
                                        }}
                                        disabled={financialForm.processing}
                                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                                    >
                                        Clear changes
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={financialForm.processing}
                                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {financialForm.processing ? 'Saving…' : 'Save financial information'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                <h3 className="font-display text-sm font-semibold text-slate-900">Opening position check</h3>
                                <p className="mt-0.5 text-xs text-slate-500">What the business owns compared with what funds it.</p>

                                <dl className="mt-4 space-y-2.5 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Cash</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.opening_cash_balance))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Inventory</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.opening_inventory_value))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Receivables</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.outstanding_customer_balances))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Existing assets</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.existing_assets_value))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                                        <dt className="font-semibold text-slate-700">Total assets</dt>
                                        <dd className="font-display text-base font-semibold text-slate-900">{currency(openingAssets)}</dd>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <dt className="text-slate-500">Supplier balances</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.outstanding_supplier_balances))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Existing liabilities</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.existing_liabilities_value))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-slate-500">Share capital</dt>
                                        <dd className="font-medium text-slate-900">{currency(toNumber(financialForm.data.share_capital))}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                                        <dt className="font-semibold text-slate-700">Total funding</dt>
                                        <dd className="font-display text-base font-semibold text-slate-900">{currency(openingFunding)}</dd>
                                    </div>
                                </dl>

                                <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${openingBalanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                    {openingBalanced ? (
                                        <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none" />
                                    ) : (
                                        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
                                    )}
                                    <p>
                                        {openingBalanced
                                            ? 'Opening assets and funding are in balance.'
                                            : `Opening position is out of balance by ${currency(Math.abs(openingDifference))}. Adjust the figures before posting.`}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                <h3 className="font-display text-sm font-semibold text-slate-900">Bringing balances across</h3>
                                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                    Record the opening position as a balanced journal entry dated on the first day of the financial year. Debit the asset accounts and credit the liability and equity accounts, using the opening balance account to absorb any difference.
                                </p>
                                <Link
                                    href="/journal"
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                                >
                                    Open the general journal →
                                </Link>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            <Modal
                open={open}
                onClose={closeModal}
                title={editing ? `Edit ${editing.code}` : 'New account'}
                description="Accounts are the building blocks of every journal entry and report."
                footer={
                    <>
                        <button type="button" onClick={closeModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="account-form"
                            disabled={form.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Create account'}
                        </button>
                    </>
                }
            >
                <form id="account-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Account code"
                            id="code"
                            value={form.data.code}
                            onChange={(event) => form.setData('code', event.target.value)}
                            placeholder="e.g. 1150"
                            error={form.errors.code}
                            required
                        />
                        <TextInput
                            label="Account name"
                            id="name"
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            placeholder="e.g. Petty cash"
                            error={form.errors.name}
                            required
                        />
                        <RichSelect
                            label="Type"
                            id="type"
                            value={form.data.type}
                            onChange={(value) => form.setData('type', value)}
                            error={form.errors.type}
                            placeholder="Select a type"
                            emptyText="No types match that search"
                            options={types.map((option) => ({
                                value: option.value,
                                primary: option.label,
                            }))}
                        />
                        <RichSelect
                            label="Parent account"
                            id="parent_id"
                            value={form.data.parent_id}
                            onChange={(value) => form.setData('parent_id', value)}
                            error={form.errors.parent_id}
                            placeholder="No parent"
                            emptyText="No accounts match that search"
                            options={parents
                                .filter((parent) => !editing || parent.id !== editing.id)
                                .map((parent) => ({
                                    value: parent.id,
                                    primary: parent.name,
                                    secondary: categoryLabel(parent.category) || undefined,
                                    meta: parent.code,
                                }))}
                        />
                        <RichSelect
                            label="Category"
                            id="category"
                            value={form.data.category}
                            onChange={(value) => form.setData('category', value)}
                            error={form.errors.category}
                            placeholder="Uncategorised"
                            emptyText="No categories match that search"
                            options={categories.map((option) => ({
                                value: option.value,
                                primary: option.label,
                            }))}
                        />
                        <TextInput
                            label="Currency"
                            id="currency"
                            value={form.data.currency}
                            onChange={(event) => form.setData('currency', event.target.value.toUpperCase())}
                            placeholder="e.g. USD"
                            maxLength={3}
                            error={form.errors.currency}
                            hint="Leave blank to inherit the company currency."
                        />
                        <TextInput
                            label="Opening balance"
                            id="opening_balance"
                            type="number"
                            step="0.01"
                            value={form.data.opening_balance}
                            onChange={(event) => form.setData('opening_balance', event.target.value)}
                            placeholder="0.00"
                            error={form.errors.opening_balance}
                        />
                    </div>

                    <Textarea
                        label="Description"
                        id="description"
                        value={form.data.description}
                        onChange={(event) => form.setData('description', event.target.value)}
                        error={form.errors.description}
                        rows={3}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Checkbox
                            label="Active"
                            id="is_active"
                            description="Inactive accounts stay in history but are hidden from new entries."
                            checked={form.data.is_active}
                            onChange={(event) => form.setData('is_active', event.target.checked)}
                        />
                        <Checkbox
                            label="Control account"
                            id="is_control"
                            description="Control accounts summarise a subledger (AR, AP, inventory) and block manual postings."
                            checked={form.data.is_control}
                            onChange={(event) => form.setData('is_control', event.target.checked)}
                        />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
