import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowsUpDownIcon,
    ArrowUturnLeftIcon,
    CalendarDaysIcon,
    CheckCircleIcon,
    DocumentDuplicateIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, inputClasses } from '../../Components/FormControls';
import { currency, currencyChoices, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, account_id: '' });

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

export default function CreditNotesIndex({ notes, filters, stats, contacts, accounts, invoices, bills, statuses }) {
    const page = usePage();
    const { base: baseCurrency } = currencyChoices(page.props.money);
    const canApprove = page.props.auth?.user?.can_approve;
    const canWrite = page.props.auth?.user?.can_write;
    const [open, setOpen] = useState(false);
    const [type, setType] = useState(filters.type ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [sort, setSort] = useState(filters.sort ?? 'issue_date');
    const [direction, setDirection] = useState(filters.direction ?? 'desc');

    const form = useForm({
        type: 'sales',
        invoice_id: '',
        bill_id: '',
        contact_id: '',
        issue_date: today(),
        reason: '',
        status: 'posted',
        currency: baseCurrency,
        items: [blankLine()],
    });

    const buildQuery = (overrides = {}) => {
        const params = {
            type,
            status,
            search,
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
        router.get('/credit-notes', buildQuery(), { preserveState: true, preserveScroll: true, replace: true });
    };

    const applySort = (nextSort, nextDirection) => {
        setSort(nextSort);
        setDirection(nextDirection);

        router.get(
            '/credit-notes',
            buildQuery({ sort: nextSort, direction: nextDirection }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const removeFilter = (key) => {
        const overrides = key === 'dates' ? { from: '', to: '' } : { [key]: '' };

        if (key === 'type') {
            setType('');
        }

        if (key === 'status') {
            setStatus('');
        }

        if (key === 'search') {
            setSearch('');
        }

        if (key === 'dates') {
            setFrom('');
            setTo('');
        }

        router.get('/credit-notes', buildQuery(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const clearSearch = () => removeFilter('search');

    const resetFilters = () => {
        setType('');
        setStatus('');
        setSearch('');
        setFrom('');
        setTo('');
        setSort('issue_date');
        setDirection('desc');
        router.get('/credit-notes', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const setLine = (index, key, value) =>
        form.setData('items', form.data.items.map((line, i) => (i === index ? { ...line, [key]: value } : line)));

    const submit = (event) => {
        event.preventDefault();
        form.post('/credit-notes', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const post = (note) => {
        if (confirm(`Post credit note ${note.number} to the ledger?`)) {
            router.post(`/credit-notes/${note.id}/post`, {}, { preserveScroll: true });
        }
    };

    const remove = (note) => {
        if (confirm(`Delete credit note ${note.number}?`)) {
            router.delete(`/credit-notes/${note.id}`, { preserveScroll: true });
        }
    };

    const total = form.data.items.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0) * (1 + Number(line.tax_rate || 0) / 100),
        0,
    );

    const hasFilters = Boolean(filters.type || filters.status || filters.search || filters.from || filters.to);
    const typeLabel = type === 'sales' ? 'Sales' : type === 'purchase' ? 'Purchase' : '';

    return (
        <AppLayout>
            <Head title="Credit notes" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Receivables & payables"
                    title="Credit notes"
                    description="Issue sales credits and capture purchase credits, then post them to the ledger."
                >
                    {canWrite && (
                        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <PlusIcon className="h-4 w-4" />
                            New credit note
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Sales credits" value={currency(stats.sales)} hint="Customer credit notes" icon={ArrowUturnLeftIcon} accent="brand" />
                    <StatCard label="Purchase credits" value={currency(stats.purchase)} hint="Vendor credit notes" icon={DocumentDuplicateIcon} accent="amber" />
                    <StatCard label="Posted" value={stats.posted} hint="Reflected in the ledger" icon={CheckCircleIcon} accent="emerald" />
                    <StatCard label="Draft" value={stats.draft} hint="Awaiting posting" icon={DocumentDuplicateIcon} accent="slate" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-brand-50/60 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="shrink-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-display text-base font-semibold text-slate-900">Credit notes</h2>
                                    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-900/5">
                                        {notes.total}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Sales and purchase credits, posted straight to the ledger.
                                </p>
                            </div>

                            <form onSubmit={applyFilters} className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search number or contact…"
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
                                        value={type}
                                        onChange={(event) => setType(event.target.value)}
                                        aria-label="Filter by type"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="">All types</option>
                                        <option value="sales">Sales</option>
                                        <option value="purchase">Purchase</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <select
                                        value={status}
                                        onChange={(event) => setStatus(event.target.value)}
                                        aria-label="Filter by status"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="">All statuses</option>
                                        {statuses.map((option) => (
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
                                        aria-label="Sort credit notes"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto"
                                    >
                                        <option value="issue_date:desc">Newest first</option>
                                        <option value="issue_date:asc">Oldest first</option>
                                        <option value="number:asc">Number A–Z</option>
                                        <option value="number:desc">Number Z–A</option>
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
                                {type && typeLabel && <FilterChip onRemove={() => removeFilter('type')}>{typeLabel}</FilterChip>}
                                {status && <FilterChip onRemove={() => removeFilter('status')}>{status.replace(/_/g, ' ')}</FilterChip>}
                                {(from || to) && (
                                    <FilterChip onRemove={() => removeFilter('dates')}>
                                        {from ? formatDate(from) : 'Any date'} → {to ? formatDate(to) : 'Any date'}
                                    </FilterChip>
                                )}
                            </div>
                        )}
                    </div>

                    {notes.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No credit notes match your filters' : 'No credit notes yet'}
                            description={
                                hasFilters
                                    ? 'Try a different type, status, date range, or search term.'
                                    : 'Create a credit note to adjust an invoice or bill.'
                            }
                            icon={ArrowUturnLeftIcon}
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Credit note</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">Contact</th>
                                            <th className="px-5 py-3">Issued</th>
                                            <th className="px-5 py-3">Source</th>
                                            <th className="px-5 py-3 text-right">Total</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {notes.data.map((note) => (
                                            <tr key={note.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">{note.number}</td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={note.type === 'sales' ? 'brand' : 'amber'}>{note.type}</Badge>
                                                </td>
                                                <td className="max-w-[13rem] truncate px-5 py-3.5 text-slate-600">{note.contact ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(note.issue_date)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{note.invoice ?? note.bill ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(note.total, note.currency)}</td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={statusTone(note.status)} dot>{note.status}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {note.status !== 'posted' && canApprove && (
                                                            <button type="button" onClick={() => post(note)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                                Post
                                                            </button>
                                                        )}
                                                        {note.status !== 'posted' && canWrite && (
                                                            <button type="button" onClick={() => remove(note)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
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
                            <Pagination paginator={notes} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="New credit note"
                description="Sales credits reduce receivables; purchase credits reduce payables."
                size="xl"
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button type="submit" form="credit-note-form" disabled={form.processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                            {form.processing ? 'Saving…' : 'Save credit note'}
                        </button>
                    </>
                }
            >
                <form id="credit-note-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Type" id="type" value={form.data.type} onChange={(e) => form.setData('type', e.target.value)} error={form.errors.type}>
                            <option value="sales">Sales credit</option>
                            <option value="purchase">Purchase credit</option>
                        </Select>
                        <Select label="Contact" id="contact_id" value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)} error={form.errors.contact_id}>
                            <option value="">Select contact</option>
                            {contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                        </Select>
                        {form.data.type === 'sales' ? (
                            <Select label="Invoice (optional)" id="invoice_id" value={form.data.invoice_id} onChange={(e) => form.setData('invoice_id', e.target.value)} error={form.errors.invoice_id}>
                                <option value="">No source invoice</option>
                                {invoices.map((invoice) => (
                                    <option key={invoice.id} value={invoice.id}>{invoice.number} · {currency(invoice.total, invoice.currency)}</option>
                                ))}
                            </Select>
                        ) : (
                            <Select label="Bill (optional)" id="bill_id" value={form.data.bill_id} onChange={(e) => form.setData('bill_id', e.target.value)} error={form.errors.bill_id}>
                                <option value="">No source bill</option>
                                {bills.map((bill) => (
                                    <option key={bill.id} value={bill.id}>{bill.number} · {currency(bill.total, bill.currency)}</option>
                                ))}
                            </Select>
                        )}
                        <TextInput label="Issue date" id="issue_date" type="date" value={form.data.issue_date} onChange={(e) => form.setData('issue_date', e.target.value)} error={form.errors.issue_date} />
                        <TextInput label="Reason" id="reason" value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)} error={form.errors.reason} />
                        <Select label="Status" id="status" value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} error={form.errors.status}>
                            <option value="draft">Draft</option>
                            <option value="posted">Post immediately</option>
                        </Select>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Line items</p>
                            <button type="button" onClick={() => form.setData('items', [...form.data.items, blankLine()])} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                + Add line
                            </button>
                        </div>
                        <div className="hidden px-7 pt-3 sm:block" aria-hidden="true">
                            <div className="grid w-full gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid-cols-12">
                                <span className="sm:col-span-5">Description</span>
                                <span className="sm:col-span-3">Account</span>
                                <span className="sm:col-span-1 text-left">Qty</span>
                                <span className="sm:col-span-2 text-left">Unit price</span>
                                <span className="sm:col-span-1 text-left">Tax</span>
                            </div>
                        </div>
                        <div className="space-y-3 p-4">
                            {form.data.items.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <input className={`${inputClasses} sm:col-span-5`} placeholder="Description" value={line.description} onChange={(e) => setLine(index, 'description', e.target.value)} aria-label={`Line ${index + 1} description`} />
                                    <select className={`${inputClasses} sm:col-span-3`} value={line.account_id} onChange={(e) => setLine(index, 'account_id', e.target.value)} aria-label={`Line ${index + 1} account`}>
                                        <option value="">Account</option>
                                        {accounts.map((account) => (
                                            <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                                        ))}
                                    </select>
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-1`} placeholder="Qty" value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} aria-label={`Line ${index + 1} quantity`} />
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-2`} placeholder="Unit price" value={line.unit_price} onChange={(e) => setLine(index, 'unit_price', e.target.value)} aria-label={`Line ${index + 1} unit price`} />
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-1`} placeholder="Tax" value={line.tax_rate} onChange={(e) => setLine(index, 'tax_rate', e.target.value)} aria-label={`Line ${index + 1} tax rate`} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Credit total</p>
                            <p className="font-display text-base font-semibold text-slate-900">
                                {currency(total, form.data.currency, { convert: false })}
                            </p>
                        </div>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
