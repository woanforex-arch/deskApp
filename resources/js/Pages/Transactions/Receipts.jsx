import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ReceiptPercentIcon,
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

export default function ReceiptsIndex({ receipts, filters, stats, invoices = [], methods = [] }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const form = useForm({
        invoice_id: '',
        paid_on: today(),
        amount: '',
        method: methods[0]?.value ?? 'bank_transfer',
        reference: '',
        notes: '',
    });

    const applyFilters = (event) => {
        event?.preventDefault();
        router.get(
            '/transactions/receipts',
            {
                ...(search ? { search } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setFrom('');
        setTo('');
        router.get('/transactions/receipts', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const selectInvoice = (value) => {
        form.setData('invoice_id', value);
        const invoice = invoices.find((item) => String(item.id) === String(value));

        if (invoice) {
            form.setData('amount', String(Math.max(invoice.balance_due, 0)));
        }
    };

    const submit = (event) => {
        event.preventDefault();

        if (!form.data.invoice_id) {
            return;
        }

        form.post(`/invoices/${form.data.invoice_id}/payments`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset('invoice_id', 'amount', 'reference', 'notes');
            },
        });
    };

    const hasFilters = Boolean(filters.search || filters.from || filters.to);
    const selectedInvoice = invoices.find((item) => String(item.id) === String(form.data.invoice_id));

    return (
        <AppLayout>
            <Head title="Receipts & sales" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Transactions"
                    title="Receipts & sales"
                    description="Customer receipts applied against open invoices, posted straight to the ledger."
                >
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Record receipt
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total received" value={currency(stats.total)} hint="All recorded customer receipts" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="This month" value={currency(stats.month)} hint="Receipts in the current month" icon={CalendarDaysIcon} accent="sky" />
                    <StatCard label="Receipts" value={stats.count} hint="Receipt records" icon={ReceiptPercentIcon} accent="violet" />
                    <StatCard label="Outstanding invoices" value={currency(stats.outstanding_invoices)} hint="Still to be collected" icon={ReceiptPercentIcon} accent="rose" />
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
                                    placeholder="Search receipt, invoice, or customer…"
                                    className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500" aria-label="From date" />
                                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500" aria-label="To date" />
                                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
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

                    {receipts.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No receipts match your filters' : 'No receipts yet'}
                            description={
                                hasFilters
                                    ? 'Try a different date range or search term.'
                                    : 'Record a customer receipt against an open invoice to see it here.'
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
                                        onClick={() => setOpen(true)}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        Record receipt
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
                                            <th className="px-5 py-3">Receipt</th>
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Customer</th>
                                            <th className="px-5 py-3">Invoice</th>
                                            <th className="px-5 py-3">Reference</th>
                                            <th className="px-5 py-3">Method</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {receipts.data.map((receipt) => (
                                            <tr key={receipt.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">
                                                    {receipt.receipt_number ?? `#${receipt.id}`}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(receipt.paid_on)}</td>
                                                <td className="max-w-[14rem] truncate px-5 py-3.5 font-medium text-slate-900">{receipt.contact ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    {receipt.invoice_id ? (
                                                        <Link
                                                            href={`/invoices/${receipt.invoice_id}`}
                                                            className="font-medium text-brand-600 hover:text-brand-700"
                                                        >
                                                            {receipt.invoice_number ?? `#${receipt.invoice_id}`}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{receipt.reference ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 capitalize text-slate-500">{receipt.method_label}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(receipt.amount, receipt.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination paginator={receipts} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Record customer receipt"
                description="Apply a receipt to an open invoice. The payment is posted to cash and receivables automatically."
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="receipt-form"
                            disabled={form.processing || !form.data.invoice_id}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Posting…' : 'Post receipt'}
                        </button>
                    </>
                }
            >
                <form id="receipt-form" onSubmit={submit} className="space-y-4">
                    <Select
                        label="Open invoice"
                        id="invoice_id"
                        value={form.data.invoice_id}
                        onChange={(event) => selectInvoice(event.target.value)}
                        error={form.errors.invoice_id}
                    >
                        <option value="">Select an open invoice</option>
                        {invoices.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                                {invoice.number} · {invoice.contact ?? 'Customer'} · {currency(invoice.balance_due, invoice.currency)}
                            </option>
                        ))}
                    </Select>

                    {invoices.length === 0 && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            There are no open invoices to receive against. Send an invoice first, then record the receipt here.
                        </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Receipt date"
                            id="paid_on"
                            type="date"
                            value={form.data.paid_on}
                            onChange={(event) => form.setData('paid_on', event.target.value)}
                            error={form.errors.paid_on}
                        />
                        <TextInput
                            label={selectedInvoice ? `Amount (${selectedInvoice.currency})` : 'Amount'}
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.data.amount}
                            onChange={(event) => form.setData('amount', event.target.value)}
                            error={form.errors.amount}
                            hint={selectedInvoice ? `Balance due ${currency(selectedInvoice.balance_due, selectedInvoice.currency)}` : undefined}
                        />
                        <Select
                            label="Method"
                            id="method"
                            value={form.data.method}
                            onChange={(event) => form.setData('method', event.target.value)}
                            error={form.errors.method}
                        >
                            {methods.map((method) => (
                                <option key={method.value} value={method.value}>
                                    {method.label}
                                </option>
                            ))}
                        </Select>
                        <TextInput
                            label="Reference"
                            id="reference"
                            value={form.data.reference}
                            onChange={(event) => form.setData('reference', event.target.value)}
                            error={form.errors.reference}
                            placeholder="Bank reference or receipt no."
                        />
                    </div>

                    <Textarea
                        label="Notes"
                        id="notes"
                        value={form.data.notes}
                        onChange={(event) => form.setData('notes', event.target.value)}
                        error={form.errors.notes}
                        rows={3}
                    />
                </form>
            </Modal>
        </AppLayout>
    );
}
