import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    ArrowsUpDownIcon,
    BanknotesIcon,
    CalendarDaysIcon,
    ChevronRightIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    CreditCardIcon,
    DocumentTextIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ReceiptPercentIcon,
    TrashIcon,
    UserCircleIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import { Select, TextInput, Textarea, DateInput, inputClasses } from '../../Components/FormControls';
import { currency, currencyChoices, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const NEW_CUSTOMER = '__new';

function blankLine() {
    return { description: '', quantity: 1, unit_price: 0, tax_rate: 0, account_id: '' };
}

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const toNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
};

function FilterChip({ children, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
            {children}
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove filter"
                className="rounded-full p-0.5 transition hover:bg-brand-100"
            >
                <XMarkIcon className="h-3 w-3" />
            </button>
        </span>
    );
}

export default function InvoicesIndex({
    invoices,
    filters,
    stats,
    statuses,
    customers = [],
    accounts = [],
    projects = [],
}) {
    const page = usePage();
    const canWrite = Boolean(page.props.auth?.user?.can_write);
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [sort, setSort] = useState(filters.sort ?? 'issue_date');
    const [direction, setDirection] = useState(filters.direction ?? 'desc');
    const [open, setOpen] = useState(false);

    const { base: baseCurrency, codes: currencyOptions } = currencyChoices(page.props.money);

    const freshInvoice = () => ({
        contact_id: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        number: '',
        issue_date: today(),
        due_date: today(),
        status: 'sent',
        currency: baseCurrency,
        project_id: '',
        notes: '',
        terms: '',
        items: [blankLine()],
    });

    const form = useForm(freshInvoice());

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
        };
    }, [open]);

    const buildQuery = (overrides = {}) => {
        const params = {
            search,
            status,
            from,
            to,
            sort,
            direction,
            ...overrides,
        };

        return Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
        );
    };

    const applyFilters = (event) => {
        event?.preventDefault();

        router.get('/invoices', buildQuery(), { preserveState: true, preserveScroll: true, replace: true });
    };

    const applySort = (nextSort, nextDirection) => {
        setSort(nextSort);
        setDirection(nextDirection);

        router.get(
            '/invoices',
            buildQuery({ sort: nextSort, direction: nextDirection }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const removeFilter = (key) => {
        const overrides = key === 'dates' ? { from: '', to: '' } : { [key]: '' };

        if (key === 'search') {
            setSearch('');
        }

        if (key === 'status') {
            setStatus('');
        }

        if (key === 'dates') {
            setFrom('');
            setTo('');
        }

        router.get('/invoices', buildQuery(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearSearch = () => removeFilter('search');

    const resetFilters = () => {
        setSearch('');
        setStatus('');
        setFrom('');
        setTo('');
        setSort('issue_date');
        setDirection('desc');
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
            buildQuery({ status: value }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const openComposer = () => {
        form.clearErrors();
        form.setData(freshInvoice());
        setOpen(true);
    };

    const setLine = (index, key, value) => {
        const items = form.data.items.map((line, i) => (i === index ? { ...line, [key]: value } : line));
        form.setData('items', items);
    };

    const addLine = () => form.setData('items', [...form.data.items, blankLine()]);
    const removeLine = (index) => {
        if (form.data.items.length === 1) {
            form.setData('items', [blankLine()]);
            return;
        }

        form.setData('items', form.data.items.filter((_, i) => i !== index));
    };

    const lineTotal = (line) =>
        round2(toNumber(line.quantity) * toNumber(line.unit_price) * (1 + toNumber(line.tax_rate) / 100));

    const subtotal = round2(form.data.items.reduce((sum, line) => sum + round2(toNumber(line.quantity) * toNumber(line.unit_price)), 0));
    const tax = round2(form.data.items.reduce((sum, line) => sum + round2(toNumber(line.quantity) * toNumber(line.unit_price) * (toNumber(line.tax_rate) / 100)), 0));
    const total = round2(subtotal + tax);

    const selectedCustomer = form.data.contact_id && form.data.contact_id !== NEW_CUSTOMER
        ? customers.find((customer) => String(customer.id) === String(form.data.contact_id))
        : null;
    const customerAddress = selectedCustomer
        ? [selectedCustomer.address, selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ')
        : '';
    const customerError = form.errors.contact_id || form.errors.customer_name;

    const submitWithStatus = (invoiceStatus) => (event) => {
        event?.preventDefault();

        form.transform((data) => ({
            ...data,
            status: invoiceStatus,
            contact_id: data.contact_id === NEW_CUSTOMER ? null : data.contact_id || null,
            number: data.number || null,
            project_id: data.project_id || null,
            items: data.items.filter((line) => String(line.description).trim() !== ''),
        }));

        form.post('/invoices', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const submit = submitWithStatus('sent');

    const remove = (invoice) => {
        if (confirm(`Delete invoice ${invoice.number}?`)) {
            router.delete(`/invoices/${invoice.id}`, { preserveScroll: true });
        }
    };

    const hasFilters = Boolean(filters.search || filters.status || filters.from || filters.to);
    const statusLabel = statuses.find((option) => option.value === status)?.label;

    return (
        <AppLayout>
            <Head title="Invoices" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Receivables"
                    title="Invoices"
                    description="Track what has been billed, what is outstanding, and what needs a nudge."
                >
                    {canWrite && (
                        <button
                            type="button"
                            onClick={openComposer}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New invoice
                        </button>
                    )}
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
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-brand-50/60 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="shrink-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-display text-base font-semibold text-slate-900">Invoices</h2>
                                    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-900/5">
                                        {invoices.total}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Billed work waiting on payment.
                                </p>
                            </div>

                            <form onSubmit={applyFilters} className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search invoice number or customer…"
                                        className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-60"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                        >
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="relative">
                                    <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={status}
                                        onChange={(event) => setStatus(event.target.value)}
                                        aria-label="Filter by status"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="">All statuses</option>
                                        <option value="open">Open (sent &amp; overdue)</option>
                                        {statuses.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1 shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                                    <CalendarDaysIcon className="h-4 w-4 shrink-0 text-slate-400" />
                                    <input
                                        type="date"
                                        value={from}
                                        max={to || undefined}
                                        onChange={(event) => setFrom(event.target.value)}
                                        aria-label="From date"
                                        title="From date"
                                        className="w-[7.5rem] border-0 bg-transparent py-1 text-xs font-medium text-slate-700 outline-none"
                                    />
                                    <span className="text-[11px] font-medium text-slate-400">→</span>
                                    <input
                                        type="date"
                                        value={to}
                                        min={from || undefined}
                                        onChange={(event) => setTo(event.target.value)}
                                        aria-label="To date"
                                        title="To date"
                                        className="w-[7.5rem] border-0 bg-transparent py-1 text-xs font-medium text-slate-700 outline-none"
                                    />
                                </div>

                                <div className="relative">
                                    <ArrowsUpDownIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={`${sort}:${direction}`}
                                        onChange={(event) => {
                                            const [nextSort, nextDirection] = event.target.value.split(':');
                                            applySort(nextSort, nextDirection);
                                        }}
                                        aria-label="Sort invoices"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="issue_date:desc">Newest first</option>
                                        <option value="issue_date:asc">Oldest first</option>
                                        <option value="number:asc">Invoice A–Z</option>
                                        <option value="number:desc">Invoice Z–A</option>
                                        <option value="total:desc">Amount high–low</option>
                                        <option value="total:asc">Amount low–high</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
                                >
                                    <FunnelIcon className="h-4 w-4" />
                                    Apply
                                </button>

                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                        Clear
                                    </button>
                                )}
                            </form>
                        </div>

                        {hasFilters && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Active</span>
                                {search && <FilterChip onRemove={() => removeFilter('search')}>Search: {search}</FilterChip>}
                                {status && (
                                    <FilterChip onRemove={() => removeFilter('status')}>
                                        {status === 'open' ? 'Open (sent & overdue)' : statusLabel}
                                    </FilterChip>
                                )}
                                {(from || to) && (
                                    <FilterChip onRemove={() => removeFilter('dates')}>
                                        {from ? formatDate(from) : 'Any date'} → {to ? formatDate(to) : 'Any date'}
                                    </FilterChip>
                                )}
                            </div>
                        )}
                    </div>

                    {invoices.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
                            description={
                                hasFilters
                                    ? 'Try a different status, date range, or search term.'
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
                                        onClick={openComposer}
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
                                                        {canWrite && invoice.status === 'draft' && (
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

            {open && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
                    <div className="flex min-h-full items-start justify-center p-3 sm:p-6">
                        <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
                            <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-brand-800 px-5 py-5 text-white sm:px-7 sm:py-6">
                                <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                                <div className="relative flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
                                            Receivable
                                        </p>
                                        <h2 className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">
                                            Create a new invoice
                                        </h2>
                                        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                                            Bill a customer and post the revenue to the ledger when you create it.
                                        </p>
                                        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/15">
                                            <DocumentTextIcon className="h-3.5 w-3.5" />
                                            {form.data.items.length} {form.data.items.length === 1 ? 'line' : 'lines'} · {form.data.currency}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                        aria-label="Close invoice form"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-brand-50 p-2 text-brand-600">
                                                    <UserCircleIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Customer</h3>
                                                    <p className="text-xs text-slate-500">Who is being billed for this invoice?</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                <Select
                                                    label="Customer"
                                                    id="contact_id"
                                                    value={form.data.contact_id}
                                                    onChange={(event) => form.setData('contact_id', event.target.value)}
                                                    error={customerError}
                                                >
                                                    <option value="">Select a customer…</option>
                                                    {customers.map((customer) => (
                                                        <option key={customer.id} value={customer.id}>
                                                            {customer.name}
                                                        </option>
                                                    ))}
                                                    <option value={NEW_CUSTOMER}>＋ New customer</option>
                                                </Select>

                                                {form.data.contact_id === NEW_CUSTOMER && (
                                                    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 sm:grid-cols-2">
                                                        <TextInput
                                                            label="Customer name"
                                                            id="customer_name"
                                                            value={form.data.customer_name}
                                                            onChange={(event) => form.setData('customer_name', event.target.value)}
                                                            error={form.errors.customer_name}
                                                            placeholder="e.g. Paul Mensah"
                                                            className="sm:col-span-2"
                                                        />
                                                        <TextInput
                                                            label="Email"
                                                            id="customer_email"
                                                            type="email"
                                                            value={form.data.customer_email}
                                                            onChange={(event) => form.setData('customer_email', event.target.value)}
                                                            error={form.errors.customer_email}
                                                            placeholder="name@example.com"
                                                        />
                                                        <TextInput
                                                            label="Phone"
                                                            id="customer_phone"
                                                            value={form.data.customer_phone}
                                                            onChange={(event) => form.setData('customer_phone', event.target.value)}
                                                            error={form.errors.customer_phone}
                                                            placeholder="+233 20 000 0000"
                                                        />
                                                    </div>
                                                )}

                                                {selectedCustomer && (
                                                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                                                        <p className="font-semibold text-slate-800">{selectedCustomer.name}</p>
                                                        <p className="mt-0.5">{customerAddress || 'No address on file'}</p>
                                                        {(selectedCustomer.email || selectedCustomer.phone) && (
                                                            <p className="mt-1 text-slate-500">
                                                                {[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-sky-50 p-2 text-sky-600">
                                                    <DocumentTextIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Invoice details</h3>
                                                    <p className="text-xs text-slate-500">Number, dates, and reporting.</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <TextInput
                                                    label="Invoice #"
                                                    id="number"
                                                    value={form.data.number}
                                                    onChange={(event) => form.setData('number', event.target.value)}
                                                    placeholder="Auto-generated"
                                                    error={form.errors.number}
                                                    hint="Auto-generated if left blank"
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
                                                <DateInput
                                                    label="Issue date"
                                                    id="issue_date"
                                                    value={form.data.issue_date}
                                                    onChange={(event) => form.setData('issue_date', event.target.value)}
                                                    error={form.errors.issue_date}
                                                />
                                                <DateInput
                                                    label="Due date"
                                                    id="due_date"
                                                    value={form.data.due_date}
                                                    onChange={(event) => form.setData('due_date', event.target.value)}
                                                    error={form.errors.due_date}
                                                />
                                                <Select
                                                    label="Project"
                                                    id="project_id"
                                                    value={form.data.project_id}
                                                    onChange={(event) => form.setData('project_id', event.target.value)}
                                                    error={form.errors.project_id}
                                                    className="sm:col-span-2"
                                                >
                                                    <option value="">No project</option>
                                                    {projects.map((project) => (
                                                        <option key={project.id} value={project.id}>
                                                            {project.name}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </section>
                                    </div>

                                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-violet-50 p-2 text-violet-600">
                                                    <ClipboardDocumentListIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Line items</h3>
                                                    <p className="text-xs text-slate-500">Describe each service or product billed.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addLine}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                                Add line
                                            </button>
                                        </div>

                                        {form.errors.items && (
                                            <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-xs font-medium text-rose-700">
                                                {form.errors.items}
                                            </div>
                                        )}

                                        <div className="hidden px-7 pt-3 sm:block" aria-hidden="true">
                                            <div className="grid w-full gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid-cols-12">
                                                <span className="sm:col-span-3">Description</span>
                                                <span className="sm:col-span-3">Account</span>
                                                <span className="sm:col-span-1 text-left">Qty</span>
                                                <span className="sm:col-span-2 text-left">Rate</span>
                                                <span className="sm:col-span-1 text-left">Tax</span>
                                                <span className="text-right sm:col-span-2 sm:pr-8">Amount</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 p-4">
                                            {form.data.items.map((line, index) => (
                                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                                    <div className="sm:col-span-3">
                                                        <input
                                                            value={line.description}
                                                            onChange={(event) => setLine(index, 'description', event.target.value)}
                                                            placeholder="e.g. Consulting — November"
                                                            className={inputClasses}
                                                            aria-label={`Line ${index + 1} description`}
                                                        />
                                                        {form.errors[`items.${index}.description`] && (
                                                            <p className="mt-1 text-xs font-medium text-rose-600">{form.errors[`items.${index}.description`]}</p>
                                                        )}
                                                    </div>
                                                    <select
                                                        value={line.account_id}
                                                        onChange={(event) => setLine(index, 'account_id', event.target.value)}
                                                        className={`${inputClasses} sm:col-span-3`}
                                                        aria-label={`Line ${index + 1} revenue account`}
                                                    >
                                                        <option value="">Default revenue account</option>
                                                        {accounts.map((account) => (
                                                            <option key={account.id} value={account.id}>
                                                                {account.code} · {account.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        onChange={(event) => setLine(index, 'quantity', event.target.value)}
                                                        placeholder="Qty"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-1`}
                                                        aria-label={`Line ${index + 1} quantity`}
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.unit_price}
                                                        onChange={(event) => setLine(index, 'unit_price', event.target.value)}
                                                        placeholder="Rate"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                                        aria-label={`Line ${index + 1} rate`}
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={line.tax_rate}
                                                        onChange={(event) => setLine(index, 'tax_rate', event.target.value)}
                                                        placeholder="Tax"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-1`}
                                                        aria-label={`Line ${index + 1} tax rate`}
                                                    />
                                                    <div className="flex items-center justify-end gap-2 sm:col-span-2">
                                                        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-500">
                                                            {currency(lineTotal(line), form.data.currency, { convert: false })}
                                                        </span>
                                                        <span className="inline-flex w-6 flex-none justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLine(index)}
                                                                className="text-slate-400 hover:text-rose-600"
                                                                aria-label={`Remove line ${index + 1}`}
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                                            <button
                                                type="button"
                                                onClick={addLine}
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition hover:text-brand-700"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                                Add another line
                                            </button>
                                            <p className="text-xs text-slate-500">
                                                {form.data.items.length} {form.data.items.length === 1 ? 'line' : 'lines'} · {form.data.currency}
                                            </p>
                                        </div>
                                    </section>

                                    <div className="grid gap-5 lg:grid-cols-3">
                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                                                    <CreditCardIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Notes &amp; terms</h3>
                                                    <p className="text-xs text-slate-500">Printed on the invoice for the customer.</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <Textarea
                                                    label="Notes"
                                                    id="notes"
                                                    value={form.data.notes}
                                                    onChange={(event) => form.setData('notes', event.target.value)}
                                                    error={form.errors.notes}
                                                    rows={4}
                                                    placeholder="Internal note or message printed on the invoice."
                                                />
                                                <Textarea
                                                    label="Terms"
                                                    id="terms"
                                                    value={form.data.terms}
                                                    onChange={(event) => form.setData('terms', event.target.value)}
                                                    error={form.errors.terms}
                                                    rows={4}
                                                    placeholder="Payment terms shown to the customer."
                                                />
                                            </div>
                                        </section>

                                        <section className="flex flex-col overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/10">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-white/10 p-2 text-brand-200">
                                                    <ReceiptPercentIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold">Summary</h3>
                                                    <p className="text-xs text-slate-400">Live totals for this invoice.</p>
                                                </div>
                                            </div>

                                            <dl className="mt-5 space-y-2.5 text-sm">
                                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                                    <dt>Subtotal</dt>
                                                    <dd className="tabular-nums">{currency(subtotal, form.data.currency, { convert: false })}</dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                                    <dt>Tax</dt>
                                                    <dd className="tabular-nums">{currency(tax, form.data.currency, { convert: false })}</dd>
                                                </div>
                                                <div className="my-3 border-t border-white/10" />
                                                <div className="flex items-end justify-between gap-4">
                                                    <dt className="text-sm font-semibold text-slate-200">Total</dt>
                                                    <dd className="font-display text-2xl font-semibold tabular-nums">{currency(total, form.data.currency, { convert: false })}</dd>
                                                </div>
                                            </dl>

                                            <div className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-amber-200 ring-1 ring-inset ring-amber-400/30">
                                                <p className="text-[11px] font-semibold uppercase tracking-wider">Amount due</p>
                                                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
                                                    {currency(total, form.data.currency, { convert: false })}
                                                </p>
                                            </div>

                                            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                                                No payment is recorded here. Receipts can be applied from the invoice detail page after it is sent.
                                            </p>
                                        </section>
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                                            <ClipboardDocumentListIcon className="h-4 w-4" />
                                            {form.data.items.length} {form.data.items.length === 1 ? 'line' : 'lines'}
                                            <span className="text-slate-300">•</span>
                                            {form.data.currency}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={form.processing}
                                            onClick={submitWithStatus('draft')}
                                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                                        >
                                            Save draft
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={form.processing}
                                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                        >
                                            <BanknotesIcon className="h-4 w-4" />
                                            {form.processing ? 'Creating…' : 'Create invoice'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
