import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    BanknotesIcon,
    ChevronRightIcon,
    ClockIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ReceiptPercentIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea, inputClasses } from '../../Components/FormControls';
import { currency, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

function blankLine() {
    return { description: '', quantity: 1, unit_price: 0, tax_rate: 0, account_id: '' };
}

export default function InvoicesIndex({
    invoices,
    filters,
    stats,
    statuses,
    customers = [],
    accounts = [],
    projects = [],
    currencies = [],
    paymentMethods = [],
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [open, setOpen] = useState(false);

    const currencyOptions = currencies.length > 0 ? currencies : ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR'];

    const form = useForm({
        contact_id: '',
        number: '',
        issue_date: today(),
        due_date: today(),
        status: 'draft',
        currency: currencyOptions[0] ?? 'USD',
        project_id: '',
        notes: '',
        terms: '',
        items: [blankLine()],
    });

    const applyFilters = (event) => {
        event?.preventDefault();

        router.get(
            '/invoices',
            {
                ...(search ? { search } : {}),
                ...(status ? { status } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setStatus('');
        router.get('/invoices', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const filterByStatus = (nextStatus) => {
        const value = nextStatus === status ? '' : nextStatus;

        if (value === status) {
            return;
        }

        setStatus(value);

        router.get(
            '/invoices',
            {
                ...(search ? { search } : {}),
                ...(value ? { status: value } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const setLine = (index, key, value) => {
        const items = form.data.items.map((line, i) => (i === index ? { ...line, [key]: value } : line));
        form.setData('items', items);
    };

    const addLine = () => form.setData('items', [...form.data.items, blankLine()]);
    const removeLine = (index) => form.setData('items', form.data.items.filter((_, i) => i !== index));

    const lineTotal = (line) =>
        Math.round(Number(line.quantity || 0) * Number(line.unit_price || 0) * (1 + Number(line.tax_rate || 0) / 100) * 100) / 100;

    const subtotal = form.data.items.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
    const tax = form.data.items.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0) * (Number(line.tax_rate || 0) / 100), 0);

    const submit = (event) => {
        event.preventDefault();
        form.post('/invoices', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const remove = (invoice) => {
        if (confirm(`Delete invoice ${invoice.number}?`)) {
            router.delete(`/invoices/${invoice.id}`, { preserveScroll: true });
        }
    };

    const hasFilters = Boolean(filters.search || filters.status);

    return (
        <AppLayout>
            <Head title="Invoices" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Receivables"
                    title="Invoices"
                    description="Track what has been billed, what is outstanding, and what needs a nudge."
                >
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New invoice
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total billed"
                        value={currency(stats.total_billed)}
                        hint="Excludes voided invoices"
                        icon={BanknotesIcon}
                        accent="brand"
                        onClick={() => filterByStatus('')}
                        active={!status}
                        activeLabel="Show all invoices"
                    />
                    <StatCard
                        label="Outstanding"
                        value={currency(stats.outstanding)}
                        hint="Sent & overdue balances"
                        icon={ReceiptPercentIcon}
                        accent="sky"
                        onClick={() => filterByStatus('open')}
                        active={status === 'open'}
                        activeLabel="Show outstanding invoices"
                    />
                    <StatCard
                        label="Overdue"
                        value={currency(stats.overdue_amount)}
                        hint={`${stats.overdue_count} invoices past due`}
                        icon={ClockIcon}
                        accent="rose"
                        onClick={() => filterByStatus('overdue')}
                        active={status === 'overdue'}
                        activeLabel="Show overdue invoices"
                    />
                    <StatCard
                        label="Paid invoices"
                        value={stats.paid_count}
                        hint="Fully settled"
                        icon={DocumentTextIcon}
                        accent="emerald"
                        onClick={() => filterByStatus('paid')}
                        active={status === 'paid'}
                        activeLabel="Show paid invoices"
                    />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <form onSubmit={applyFilters} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search invoice number or customer…"
                                    className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value)}
                                    className="rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                >
                                    <option value="">All statuses</option>
                                    <option value="open">Open (sent &amp; overdue)</option>
                                    {statuses.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    Filter
                                </button>

                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {invoices.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
                            description={
                                hasFilters
                                    ? 'Try a different status or search term.'
                                    : 'Create your first invoice to start billing customers.'
                            }
                            icon={DocumentTextIcon}
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
                                        onClick={() => setOpen(true)}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        New invoice
                                    </button>
                                )
                            }
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Invoice</th>
                                            <th className="px-5 py-3">Customer</th>
                                            <th className="px-5 py-3">Issued</th>
                                            <th className="px-5 py-3">Due</th>
                                            <th className="px-5 py-3 text-right">Total</th>
                                            <th className="px-5 py-3 text-right">Balance</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoices.data.map((invoice) => (
                                            <tr key={invoice.id} className="group transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Link
                                                        href={`/invoices/${invoice.id}`}
                                                        className="font-semibold text-slate-900 hover:text-brand-700"
                                                    >
                                                        {invoice.number}
                                                    </Link>
                                                </td>
                                                <td className="max-w-[14rem] truncate px-5 py-3.5 text-slate-600">
                                                    {invoice.contact ?? '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                                                    {formatDate(invoice.issue_date)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                                                    {formatDate(invoice.due_date)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {currency(invoice.total, invoice.currency)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {currency(invoice.balance_due, invoice.currency)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Badge tone={statusTone(invoice.status)} dot>
                                                        {invoice.status_label}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Link
                                                            href={`/invoices/${invoice.id}`}
                                                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                                                        >
                                                            View
                                                            <ChevronRightIcon className="h-3.5 w-3.5" />
                                                        </Link>
                                                        {invoice.status === 'draft' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(invoice)}
                                                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                title="Delete invoice"
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

                            <Pagination paginator={invoices} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="New invoice"
                description="Bill a customer and post the revenue to the ledger when sent."
                size="xl"
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="invoice-form"
                            disabled={form.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : 'Save invoice'}
                        </button>
                    </>
                }
            >
                <form id="invoice-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            label="Customer"
                            id="contact_id"
                            value={form.data.contact_id}
                            onChange={(event) => form.setData('contact_id', event.target.value)}
                            error={form.errors.contact_id}
                        >
                            <option value="">Select a customer</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                </option>
                            ))}
                        </Select>
                        <TextInput
                            label="Invoice number"
                            id="number"
                            value={form.data.number}
                            onChange={(event) => form.setData('number', event.target.value)}
                            placeholder="Auto-generated"
                            error={form.errors.number}
                        />
                        <TextInput
                            label="Issue date"
                            id="issue_date"
                            type="date"
                            value={form.data.issue_date}
                            onChange={(event) => form.setData('issue_date', event.target.value)}
                            error={form.errors.issue_date}
                        />
                        <TextInput
                            label="Due date"
                            id="due_date"
                            type="date"
                            value={form.data.due_date}
                            onChange={(event) => form.setData('due_date', event.target.value)}
                            error={form.errors.due_date}
                        />
                        <Select
                            label="Currency"
                            id="currency"
                            value={form.data.currency}
                            onChange={(event) => form.setData('currency', event.target.value)}
                            error={form.errors.currency}
                        >
                            {currencyOptions.map((code) => (
                                <option key={code} value={code}>
                                    {code}
                                </option>
                            ))}
                        </Select>
                        <Select
                            label="Project"
                            id="project_id"
                            value={form.data.project_id}
                            onChange={(event) => form.setData('project_id', event.target.value)}
                            error={form.errors.project_id}
                        >
                            <option value="">No project</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </Select>
                        <Select
                            label="Status"
                            id="status"
                            value={form.data.status}
                            onChange={(event) => form.setData('status', event.target.value)}
                            error={form.errors.status}
                        >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                        </Select>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Line items</p>
                            <button type="button" onClick={addLine} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                + Add line
                            </button>
                        </div>
                        <div className="hidden px-7 pt-3 sm:block" aria-hidden="true">
                            <div className="grid w-full gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid-cols-12">
                                <span className="sm:col-span-3">Description</span>
                                <span className="sm:col-span-3">Account</span>
                                <span className="sm:col-span-1 text-left">Qty</span>
                                <span className="sm:col-span-2 text-left">Unit price</span>
                                <span className="sm:col-span-1 text-left">Tax</span>
                                <span className="text-right sm:col-span-2 sm:pr-8">Amount</span>
                            </div>
                        </div>
                        <div className="space-y-3 p-4">
                            {form.data.items.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <input
                                        className={`${inputClasses} sm:col-span-3`}
                                        placeholder="Description"
                                        value={line.description}
                                        onChange={(event) => setLine(index, 'description', event.target.value)}
                                        aria-label={`Line ${index + 1} description`}
                                    />
                                    <select
                                        className={`${inputClasses} sm:col-span-3`}
                                        value={line.account_id}
                                        onChange={(event) => setLine(index, 'account_id', event.target.value)}
                                        aria-label={`Line ${index + 1} account`}
                                    >
                                        <option value="">Revenue account</option>
                                        {accounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.code} · {account.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} sm:col-span-1`}
                                        placeholder="Qty"
                                        value={line.quantity}
                                        onChange={(event) => setLine(index, 'quantity', event.target.value)}
                                        aria-label={`Line ${index + 1} quantity`}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} sm:col-span-2`}
                                        placeholder="Unit price"
                                        value={line.unit_price}
                                        onChange={(event) => setLine(index, 'unit_price', event.target.value)}
                                        aria-label={`Line ${index + 1} unit price`}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} sm:col-span-1`}
                                        placeholder="Tax"
                                        value={line.tax_rate}
                                        onChange={(event) => setLine(index, 'tax_rate', event.target.value)}
                                        aria-label={`Line ${index + 1} tax rate`}
                                    />
                                    <div className="flex items-center justify-end gap-2 sm:col-span-2">
                                        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-500">
                                            {currency(lineTotal(line), form.data.currency, { convert: false })}
                                        </span>
                                        <span className="inline-flex w-6 flex-none justify-end">
                                            {form.data.items.length > 1 && (
                                                <button type="button" onClick={() => removeLine(index)} className="text-slate-400 hover:text-rose-600" aria-label={`Remove line ${index + 1}`}>
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Textarea
                            label="Notes"
                            id="notes"
                            value={form.data.notes}
                            onChange={(event) => form.setData('notes', event.target.value)}
                            error={form.errors.notes}
                            rows={3}
                        />
                        <Textarea
                            label="Terms"
                            id="terms"
                            value={form.data.terms}
                            onChange={(event) => form.setData('terms', event.target.value)}
                            error={form.errors.terms}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Subtotal</p>
                            <p className="font-semibold text-slate-900">
                                {currency(subtotal, form.data.currency, { convert: false })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Tax</p>
                            <p className="font-semibold text-slate-900">
                                {currency(tax, form.data.currency, { convert: false })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="font-display text-base font-semibold text-slate-900">
                                {currency(subtotal + tax, form.data.currency, { convert: false })}
                            </p>
                        </div>
                    </div>

                    {paymentMethods.length > 0 && (
                        <p className="text-xs text-slate-400">
                            Record receipts from the invoice detail page after it has been sent.
                        </p>
                    )}
                </form>
            </Modal>
        </AppLayout>
    );
}
