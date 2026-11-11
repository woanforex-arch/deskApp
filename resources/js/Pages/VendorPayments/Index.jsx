import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowsUpDownIcon,
    BanknotesIcon,
    CalendarDaysIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ReceiptPercentIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

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

export default function VendorPaymentsIndex({ payments, filters, stats, vendors, bills, bankAccounts, methods }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const [method, setMethod] = useState(filters.method ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [sort, setSort] = useState(filters.sort ?? 'paid_on');
    const [direction, setDirection] = useState(filters.direction ?? 'desc');

    const form = useForm({
        bill_id: '',
        contact_id: '',
        paid_on: today(),
        amount: '',
        method: 'bank_transfer',
        reference: '',
        notes: '',
        bank_account_id: '',
        currency: 'USD',
    });

    const buildQuery = (overrides = {}) => {
        const params = {
            search,
            method,
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
        router.get('/vendor-payments', buildQuery(), { preserveState: true, preserveScroll: true, replace: true });
    };

    const applySort = (nextSort, nextDirection) => {
        setSort(nextSort);
        setDirection(nextDirection);

        router.get(
            '/vendor-payments',
            buildQuery({ sort: nextSort, direction: nextDirection }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const removeFilter = (key) => {
        const overrides = key === 'dates' ? { from: '', to: '' } : { [key]: '' };

        if (key === 'search') {
            setSearch('');
        }

        if (key === 'method') {
            setMethod('');
        }

        if (key === 'dates') {
            setFrom('');
            setTo('');
        }

        router.get('/vendor-payments', buildQuery(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearSearch = () => removeFilter('search');

    const resetFilters = () => {
        setSearch('');
        setMethod('');
        setFrom('');
        setTo('');
        setSort('paid_on');
        setDirection('desc');
        router.get('/vendor-payments', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const selectBill = (value) => {
        form.setData('bill_id', value);
        const bill = bills.find((item) => String(item.id) === String(value));
        if (bill) {
            form.setData('contact_id', bill.contact_id);
            form.setData('amount', String(Math.max(bill.total - bill.amount_paid, 0)));
            form.setData('currency', bill.currency);
        }
    };

    const submit = (event) => {
        event.preventDefault();
        form.post('/vendor-payments', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const hasFilters = Boolean(filters.search || filters.method || filters.from || filters.to);
    const methodLabel = method?.replace(/_/g, ' ');

    return (
        <AppLayout>
            <Head title="Vendor payments" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Payables"
                    title="Vendor payments"
                    description="Every disbursement to a supplier, with optional bill matching and ledger posting."
                >
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Record payment
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total paid" value={currency(stats.total)} hint="All recorded vendor payments" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="This month" value={currency(stats.month)} hint="Payments in the current month" icon={CalendarDaysIcon} accent="sky" />
                    <StatCard label="Payments" value={stats.count} hint="Payment records" icon={ReceiptPercentIcon} accent="violet" />
                    <StatCard label="Open bills" value={currency(stats.outstanding_bills)} hint="Still to be settled" icon={ReceiptPercentIcon} accent="rose" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-brand-50/60 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="shrink-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-display text-base font-semibold text-slate-900">Payments</h2>
                                    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-900/5">
                                        {payments.total}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Every disbursement to a supplier, matched to bills.
                                </p>
                            </div>

                            <form onSubmit={applyFilters} className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search reference or vendor…"
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
                                        value={method}
                                        onChange={(event) => setMethod(event.target.value)}
                                        aria-label="Filter by payment method"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="">All methods</option>
                                        {methods.map((option) => (
                                            <option key={option} value={option}>
                                                {option.replace(/_/g, ' ')}
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
                                        aria-label="Sort payments"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="paid_on:desc">Newest first</option>
                                        <option value="paid_on:asc">Oldest first</option>
                                        <option value="reference:asc">Reference A–Z</option>
                                        <option value="reference:desc">Reference Z–A</option>
                                        <option value="amount:desc">Amount high–low</option>
                                        <option value="amount:asc">Amount low–high</option>
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
                                {method && methodLabel && <FilterChip onRemove={() => removeFilter('method')}>{methodLabel}</FilterChip>}
                                {(from || to) && (
                                    <FilterChip onRemove={() => removeFilter('dates')}>
                                        {from ? formatDate(from) : 'Any date'} → {to ? formatDate(to) : 'Any date'}
                                    </FilterChip>
                                )}
                            </div>
                        )}
                    </div>

                    {payments.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No payments match your filters' : 'No vendor payments yet'}
                            description={
                                hasFilters
                                    ? 'Try a different method, date range, or search term.'
                                    : 'Record a payment to see it here.'
                            }
                            icon={BanknotesIcon}
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Vendor</th>
                                            <th className="px-5 py-3">Bill</th>
                                            <th className="px-5 py-3">Reference</th>
                                            <th className="px-5 py-3">Method</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {payments.data.map((payment) => (
                                            <tr key={payment.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(payment.paid_on)}</td>
                                                <td className="max-w-[14rem] truncate px-5 py-3.5 font-medium text-slate-900">{payment.contact ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{payment.bill ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{payment.reference ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 capitalize text-slate-500">{payment.method.replace(/_/g, ' ')}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(payment.amount, payment.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination paginator={payments} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Record vendor payment"
                description="Attach the payment to an open bill, or record a standalone disbursement."
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button type="submit" form="vendor-payment-form" disabled={form.processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                            {form.processing ? 'Posting…' : 'Post payment'}
                        </button>
                    </>
                }
            >
                <form id="vendor-payment-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Open bill (optional)" id="bill_id" value={form.data.bill_id} onChange={(e) => selectBill(e.target.value)} error={form.errors.bill_id} className="sm:col-span-2">
                            <option value="">Standalone payment</option>
                            {bills.map((bill) => (
                                <option key={bill.id} value={bill.id}>
                                    {bill.number} · {bill.contact?.name} · {currency(bill.total - bill.amount_paid, bill.currency)}
                                </option>
                            ))}
                        </Select>
                        <Select label="Vendor" id="contact_id" value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)} error={form.errors.contact_id}>
                            <option value="">Select a vendor</option>
                            {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                    {vendor.name}
                                </option>
                            ))}
                        </Select>
                        <TextInput label="Payment date" id="paid_on" type="date" value={form.data.paid_on} onChange={(e) => form.setData('paid_on', e.target.value)} error={form.errors.paid_on} />
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} error={form.errors.amount} />
                        <Select label="Currency" id="currency" value={form.data.currency} onChange={(e) => form.setData('currency', e.target.value)} error={form.errors.currency}>
                            {['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR'].map((code) => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </Select>
                        <Select label="Method" id="method" value={form.data.method} onChange={(e) => form.setData('method', e.target.value)} error={form.errors.method}>
                            {methods.map((method) => (
                                <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>
                            ))}
                        </Select>
                        <Select label="Bank account" id="bank_account_id" value={form.data.bank_account_id} onChange={(e) => form.setData('bank_account_id', e.target.value)} error={form.errors.bank_account_id}>
                            <option value="">Unassigned</option>
                            {bankAccounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
                            ))}
                        </Select>
                        <TextInput label="Reference" id="reference" value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} error={form.errors.reference} />
                    </div>
                    <Textarea label="Notes" id="notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} error={form.errors.notes} rows={3} />
                </form>
            </Modal>
        </AppLayout>
    );
}
