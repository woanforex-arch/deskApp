import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowUturnLeftIcon, CheckCircleIcon, DocumentDuplicateIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, inputClasses } from '../../Components/FormControls';
import { currency, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, account_id: '' });

export default function CreditNotesIndex({ notes, filters, stats, contacts, accounts, invoices, bills, statuses }) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState(filters.type ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [search, setSearch] = useState(filters.search ?? '');

    const form = useForm({
        type: 'sales',
        invoice_id: '',
        bill_id: '',
        contact_id: '',
        issue_date: today(),
        reason: '',
        status: 'posted',
        currency: 'USD',
        items: [blankLine()],
    });

    const applyFilters = (event) => {
        event?.preventDefault();
        router.get(
            '/credit-notes',
            {
                ...(type ? { type } : {}),
                ...(status ? { status } : {}),
                ...(search ? { search } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
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

    return (
        <AppLayout>
            <Head title="Credit notes" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Receivables & payables"
                    title="Credit notes"
                    description="Issue sales credits and capture purchase credits, then post them to the ledger."
                >
                    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        New credit note
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Sales credits" value={currency(stats.sales)} hint="Customer credit notes" icon={ArrowUturnLeftIcon} accent="brand" />
                    <StatCard label="Purchase credits" value={currency(stats.purchase)} hint="Vendor credit notes" icon={DocumentDuplicateIcon} accent="amber" />
                    <StatCard label="Posted" value={stats.posted} hint="Reflected in the ledger" icon={CheckCircleIcon} accent="emerald" />
                    <StatCard label="Draft" value={stats.draft} hint="Awaiting posting" icon={DocumentDuplicateIcon} accent="slate" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <form onSubmit={applyFilters} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search number or contact…"
                                className={`${inputClasses} sm:max-w-xs`}
                            />
                            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                <option value="">All types</option>
                                <option value="sales">Sales</option>
                                <option value="purchase">Purchase</option>
                            </select>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                <option value="">All statuses</option>
                                {statuses.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                                Filter
                            </button>
                            {(filters.type || filters.status || filters.search) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setType('');
                                        setStatus('');
                                        setSearch('');
                                        router.get('/credit-notes', {}, { preserveState: true, preserveScroll: true, replace: true });
                                    }}
                                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                >
                                    Reset
                                </button>
                            )}
                        </form>
                    </div>

                    {notes.data.length === 0 ? (
                        <EmptyState title="No credit notes yet" description="Create a credit note to adjust an invoice or bill." icon={ArrowUturnLeftIcon} />
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
                                                        {note.status !== 'posted' && (
                                                            <button type="button" onClick={() => post(note)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                                Post
                                                            </button>
                                                        )}
                                                        {note.status !== 'posted' && (
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
                        <div className="space-y-3 p-4">
                            {form.data.items.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <input className={`${inputClasses} sm:col-span-5`} placeholder="Description" value={line.description} onChange={(e) => setLine(index, 'description', e.target.value)} />
                                    <select className={`${inputClasses} sm:col-span-3`} value={line.account_id} onChange={(e) => setLine(index, 'account_id', e.target.value)}>
                                        <option value="">Account</option>
                                        {accounts.map((account) => (
                                            <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                                        ))}
                                    </select>
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-1`} placeholder="Qty" value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} />
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-2`} placeholder="Unit price" value={line.unit_price} onChange={(e) => setLine(index, 'unit_price', e.target.value)} />
                                    <input type="number" step="0.01" className={`${inputClasses} sm:col-span-1`} placeholder="Tax" value={line.tax_rate} onChange={(e) => setLine(index, 'tax_rate', e.target.value)} />
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
