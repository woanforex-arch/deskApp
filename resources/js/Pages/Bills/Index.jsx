import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    BanknotesIcon,
    CheckCircleIcon,
    ClockIcon,
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

const billTone = (status) =>
    ({
        approved: 'sky',
        partial: 'amber',
        pending_approval: 'violet',
    })[status] ?? statusTone(status);

const today = () => new Date().toISOString().slice(0, 10);

function blankLine() {
    return { description: '', quantity: 1, unit_price: 0, tax_rate: 0, account_id: '' };
}

export default function BillsIndex({ bills, filters, stats, vendors, accounts, projects, statuses }) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [open, setOpen] = useState(false);

    const form = useForm({
        contact_id: '',
        number: '',
        bill_date: today(),
        due_date: today(),
        status: 'draft',
        currency: 'USD',
        project_id: '',
        notes: '',
        items: [blankLine()],
    });

    const applyFilters = (event) => {
        event?.preventDefault();
        router.get(
            '/bills',
            { ...(search ? { search } : {}), ...(status ? { status } : {}) },
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
        form.post('/bills', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const approve = (bill) => {
        if (confirm(`Approve bill ${bill.number} and post it to the ledger?`)) {
            router.post(`/bills/${bill.id}/approve`, {}, { preserveScroll: true });
        }
    };

    const remove = (bill) => {
        if (confirm(`Delete bill ${bill.number}?`)) {
            router.delete(`/bills/${bill.id}`, { preserveScroll: true });
        }
    };

    const hasFilters = Boolean(filters.search || filters.status);
    const canApprove = usePage().props.auth?.user?.can_approve;

    return (
        <AppLayout>
            <Head title="Bills" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Payables"
                    title="Bills"
                    description="Capture vendor bills, route them for approval, and settle them through the ledger."
                >
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New bill
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Bills captured" value={currency(stats.total)} hint="All bills in the register" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="Outstanding" value={currency(stats.outstanding)} hint="Approved and partial balances" icon={ReceiptPercentIcon} accent="sky" />
                    <StatCard label="Overdue" value={currency(stats.overdue)} hint="Past due and still open" icon={ClockIcon} accent="rose" />
                    <StatCard label="Paid" value={currency(stats.paid)} hint="Fully settled bills" icon={CheckCircleIcon} accent="emerald" />
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
                                    placeholder="Search bill number or vendor…"
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
                                    {statuses.map((option) => (
                                        <option key={option} value={option}>
                                            {option.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                                    Filter
                                </button>
                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            setStatus('');
                                            router.get('/bills', {}, { preserveState: true, preserveScroll: true, replace: true });
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {bills.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No bills match your filters' : 'No bills yet'}
                            description="Capture a vendor bill to start tracking payables."
                            icon={ReceiptPercentIcon}
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Bill</th>
                                            <th className="px-5 py-3">Vendor</th>
                                            <th className="px-5 py-3">Bill date</th>
                                            <th className="px-5 py-3">Due</th>
                                            <th className="px-5 py-3 text-right">Total</th>
                                            <th className="px-5 py-3 text-right">Balance</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {bills.data.map((bill) => (
                                            <tr key={bill.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Link href={`/bills/${bill.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                                                        {bill.number}
                                                    </Link>
                                                </td>
                                                <td className="max-w-[14rem] truncate px-5 py-3.5 text-slate-600">{bill.contact ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(bill.bill_date)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                                                    <span className={bill.is_overdue ? 'font-semibold text-rose-600' : ''}>{formatDate(bill.due_date)}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(bill.total, bill.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(bill.balance_due, bill.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Badge tone={billTone(bill.status)} dot>
                                                        {bill.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {canApprove && bill.status === 'draft' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => approve(bill)}
                                                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}
                                                        <Link href={`/bills/${bill.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                            View
                                                        </Link>
                                                        {bill.status === 'draft' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(bill)}
                                                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                title="Delete bill"
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
                            <Pagination paginator={bills} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="New vendor bill"
                description="Capture the bill and its line items. Save as draft or approve immediately."
                size="xl"
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="bill-form"
                            disabled={form.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : 'Save bill'}
                        </button>
                    </>
                }
            >
                <form id="bill-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Vendor" id="contact_id" value={form.data.contact_id} onChange={(e) => form.setData('contact_id', e.target.value)} error={form.errors.contact_id}>
                            <option value="">Select a vendor</option>
                            {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                    {vendor.name}
                                </option>
                            ))}
                        </Select>
                        <TextInput label="Bill number" id="number" value={form.data.number} onChange={(e) => form.setData('number', e.target.value)} placeholder="Auto-generated" error={form.errors.number} />
                        <TextInput label="Bill date" id="bill_date" type="date" value={form.data.bill_date} onChange={(e) => form.setData('bill_date', e.target.value)} error={form.errors.bill_date} />
                        <TextInput label="Due date" id="due_date" type="date" value={form.data.due_date} onChange={(e) => form.setData('due_date', e.target.value)} error={form.errors.due_date} />
                        <Select label="Currency" id="currency" value={form.data.currency} onChange={(e) => form.setData('currency', e.target.value)} error={form.errors.currency}>
                            {['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR'].map((code) => (
                                <option key={code} value={code}>
                                    {code}
                                </option>
                            ))}
                        </Select>
                        <Select label="Project" id="project_id" value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)} error={form.errors.project_id}>
                            <option value="">No project</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </Select>
                        <Select label="Status" id="status" value={form.data.status} onChange={(e) => form.setData('status', e.target.value)} error={form.errors.status}>
                            <option value="draft">Draft</option>
                            <option value="approved">Approved</option>
                        </Select>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Line items</p>
                            <button type="button" onClick={addLine} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                + Add line
                            </button>
                        </div>
                        <div className="space-y-3 p-4">
                            {form.data.items.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <input
                                        className={`${inputClasses} sm:col-span-4`}
                                        placeholder="Description"
                                        value={line.description}
                                        onChange={(e) => setLine(index, 'description', e.target.value)}
                                    />
                                    <select className={`${inputClasses} sm:col-span-3`} value={line.account_id} onChange={(e) => setLine(index, 'account_id', e.target.value)}>
                                        <option value="">Expense account</option>
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
                                        onChange={(e) => setLine(index, 'quantity', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} sm:col-span-2`}
                                        placeholder="Unit price"
                                        value={line.unit_price}
                                        onChange={(e) => setLine(index, 'unit_price', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} sm:col-span-1`}
                                        placeholder="Tax %"
                                        value={line.tax_rate}
                                        onChange={(e) => setLine(index, 'tax_rate', e.target.value)}
                                    />
                                    <div className="flex items-center justify-between gap-2 sm:col-span-1">
                                        <span className="text-xs font-medium text-slate-500">
                                            {currency(lineTotal(line), form.data.currency, { convert: false })}
                                        </span>
                                        {form.data.items.length > 1 && (
                                            <button type="button" onClick={() => removeLine(index)} className="text-slate-400 hover:text-rose-600">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Textarea label="Notes" id="notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} error={form.errors.notes} rows={3} />

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
                </form>
            </Modal>
        </AppLayout>
    );
}
