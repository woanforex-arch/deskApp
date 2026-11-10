import { Head, router, useForm } from '@inertiajs/react';
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

export default function PaymentsIndex({
    payments,
    filters,
    stats,
    vendors = [],
    bills = [],
    bankAccounts = [],
    methods = [],
    currencies = [],
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const currencyOptions = currencies.length > 0 ? currencies : ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR'];

    const form = useForm({
        bill_id: '',
        contact_id: '',
        paid_on: today(),
        amount: '',
        method: methods[0]?.value ?? 'bank_transfer',
        reference: '',
        notes: '',
        bank_account_id: '',
        currency: currencyOptions[0] ?? 'USD',
    });

    const applyFilters = (event) => {
        event?.preventDefault();
        router.get(
            '/transactions/payments',
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
        router.get('/transactions/payments', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const selectBill = (value) => {
        form.setData('bill_id', value);
        const bill = bills.find((item) => String(item.id) === String(value));

        if (bill) {
            form.setData('contact_id', bill.contact_id);
            form.setData('amount', String(Math.max(bill.balance_due, 0)));
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

    const hasFilters = Boolean(filters.search || filters.from || filters.to);

    return (
        <AppLayout>
            <Head title="Payments & expenses" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Transactions"
                    title="Payments & expenses"
                    description="Supplier payments and expense disbursements, with optional bill matching and ledger posting."
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
                    <StatCard label="Total paid" value={currency(stats.total)} hint="All recorded outgoing payments" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="This month" value={currency(stats.month)} hint="Payments in the current month" icon={CalendarDaysIcon} accent="sky" />
                    <StatCard label="Payments" value={stats.count} hint="Payment records" icon={ReceiptPercentIcon} accent="violet" />
                    <StatCard label="Open bills" value={currency(stats.outstanding_bills)} hint="Still to be settled" icon={ReceiptPercentIcon} accent="rose" />
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
                                    placeholder="Search reference, bill, or vendor…"
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

                    {payments.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No payments match your filters' : 'No payments yet'}
                            description={
                                hasFilters
                                    ? 'Try a different date range or search term.'
                                    : 'Record a supplier payment or expense to see it here.'
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
                                        Record payment
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
                title="Record payment"
                description="Attach the payment to an open bill, or record a standalone expense disbursement."
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="transaction-payment-form"
                            disabled={form.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Posting…' : 'Post payment'}
                        </button>
                    </>
                }
            >
                <form id="transaction-payment-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Open bill (optional)" id="bill_id" value={form.data.bill_id} onChange={(e) => selectBill(e.target.value)} error={form.errors.bill_id} className="sm:col-span-2">
                            <option value="">Standalone payment</option>
                            {bills.map((bill) => (
                                <option key={bill.id} value={bill.id}>
                                    {bill.number} · {bill.contact ?? 'Vendor'} · {currency(bill.balance_due, bill.currency)}
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
                        <TextInput label="Amount" id="amount" type="number" step="0.01" min="0" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} error={form.errors.amount} />
                        <Select label="Currency" id="currency" value={form.data.currency} onChange={(e) => form.setData('currency', e.target.value)} error={form.errors.currency}>
                            {currencyOptions.map((code) => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </Select>
                        <Select label="Method" id="method" value={form.data.method} onChange={(e) => form.setData('method', e.target.value)} error={form.errors.method}>
                            {methods.map((method) => (
                                <option key={method.value} value={method.value}>{method.label}</option>
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
