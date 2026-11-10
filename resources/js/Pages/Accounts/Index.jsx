import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    BanknotesIcon,
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
import { Checkbox, Select, TextInput, Textarea } from '../../Components/FormControls';
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

export default function AccountsIndex({ accounts, summary, filters, types, categories = [], parents = [] }) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType] = useState(filters.type ?? '');
    const [category, setCategory] = useState(filters.category ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const form = useForm({ ...blankAccount });

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
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                            <Squares2X2Icon className="h-4 w-4 text-slate-400" />
                            {accounts.length} accounts in view
                        </span>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New account
                        </button>
                    </div>
                </PageHeader>

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

                            <select
                                value={type}
                                onChange={(event) => setType(event.target.value)}
                                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            >
                                <option value="">All types</option>
                                {types.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            >
                                <option value="">All categories</option>
                                {categories.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

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
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        New account
                                    </button>
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
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(account)}
                                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                                                        title="Edit account"
                                                    >
                                                        <PencilSquareIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => remove(account)}
                                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                        title="Delete account"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
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
                        <Select
                            label="Type"
                            id="type"
                            value={form.data.type}
                            onChange={(event) => form.setData('type', event.target.value)}
                            error={form.errors.type}
                        >
                            {types.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                        <Select
                            label="Parent account"
                            id="parent_id"
                            value={form.data.parent_id}
                            onChange={(event) => form.setData('parent_id', event.target.value)}
                            error={form.errors.parent_id}
                        >
                            <option value="">No parent</option>
                            {parents
                                .filter((parent) => !editing || parent.id !== editing.id)
                                .map((parent) => (
                                    <option key={parent.id} value={parent.id}>
                                        {parent.code} · {parent.name}
                                    </option>
                                ))}
                        </Select>
                        <Select
                            label="Category"
                            id="category"
                            value={form.data.category}
                            onChange={(event) => form.setData('category', event.target.value)}
                            error={form.errors.category}
                        >
                            <option value="">Uncategorised</option>
                            {categories.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
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
