import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeftIcon, CheckCircleIcon, CreditCardIcon, PrinterIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import Badge from '../../Components/Badge';
import CompanyIdentity from '../../Components/CompanyIdentity';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, statusTone } from '../../lib/format';

const billTone = (status) =>
    ({
        approved: 'sky',
        partial: 'amber',
        pending_approval: 'violet',
    })[status] ?? statusTone(status);

const today = () => new Date().toISOString().slice(0, 10);

export default function BillShow({ bill }) {
    const canApprove = usePage().props.auth?.user?.can_approve;
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const form = useForm({
        paid_on: today(),
        amount: bill.balance_due,
        method: 'bank_transfer',
        reference: '',
        notes: '',
    });

    const approve = () => {
        if (confirm(`Approve bill ${bill.number} and post it to the ledger?`)) {
            router.post(`/bills/${bill.id}/approve`, {}, { preserveScroll: true });
        }
    };

    const remove = () => {
        if (confirm(`Delete bill ${bill.number}?`)) {
            router.delete(`/bills/${bill.id}`, { preserveScroll: true });
        }
    };

    const submitPayment = (event) => {
        event.preventDefault();
        form.post(`/bills/${bill.id}/payments`, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setPaymentOpen(false);
                form.reset();
            },
        });
    };

    const openPayment = () => {
        form.clearErrors();
        form.setData('paid_on', today());
        form.setData('amount', bill.balance_due);
        form.setData('method', 'bank_transfer');
        form.setData('reference', '');
        form.setData('notes', '');
        setPaymentOpen(true);
    };

    return (
        <AppLayout>
            <Head title={`Bill ${bill.number}`} />

            <div className="space-y-6">
                <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href="/bills" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-700">
                            <ArrowLeftIcon className="h-3.5 w-3.5" />
                            Back to bills
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{bill.number}</h1>
                            <Badge tone={billTone(bill.status)} dot>
                                {bill.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            {bill.contact ?? 'No vendor'} · Bill date {formatDate(bill.bill_date)} · Due {formatDate(bill.due_date)}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            Print
                        </button>
                        {canApprove && bill.status === 'draft' && (
                            <>
                                <button
                                    type="button"
                                    onClick={remove}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                >
                                    Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={approve}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Approve &amp; post
                                </button>
                            </>
                        )}
                        {['approved', 'partial'].includes(bill.status) && bill.balance_due > 0 && (
                            <button
                                type="button"
                                onClick={openPayment}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                            >
                                <CreditCardIcon className="h-4 w-4" />
                                Record payment
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-3 print:block">
                    <div className="print-plain overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-2 print:w-full">
                        <div className="flex flex-col gap-6 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <CompanyIdentity size="lg" />
                            </div>

                            <div className="flex-none text-left sm:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-600">Vendor bill</p>
                                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">{bill.number}</h2>

                                <div className="mt-5 border-t border-slate-100 pt-3 sm:border-slate-200">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Balance due</p>
                                    <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{currency(bill.balance_due, bill.currency)}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">of {currency(bill.total, bill.currency)} total</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-6 py-3">Description</th>
                                        <th className="px-4 py-3">Account</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Unit price</th>
                                        <th className="px-4 py-3 text-right">Tax</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bill.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4 font-medium text-slate-900">{item.description}</td>
                                            <td className="px-4 py-4 text-slate-500">{item.account ?? '—'}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">{Number(item.quantity)}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">{currency(item.unit_price, bill.currency)}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">{Number(item.tax_rate)}%</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-slate-900">{currency(item.amount, bill.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 p-6">
                            <dl className="w-full max-w-xs space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Subtotal</dt>
                                    <dd className="font-medium text-slate-900">{currency(bill.subtotal, bill.currency)}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Tax</dt>
                                    <dd className="font-medium text-slate-900">{currency(bill.tax_total, bill.currency)}</dd>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                    <dt className="font-semibold text-slate-700">Total</dt>
                                    <dd className="font-display text-base font-semibold text-slate-900">{currency(bill.total, bill.currency)}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Paid</dt>
                                    <dd className="font-medium text-emerald-600">−{currency(bill.amount_paid, bill.currency)}</dd>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                    <dt className="font-semibold text-slate-700">Balance due</dt>
                                    <dd className="font-display text-base font-semibold text-slate-900">{currency(bill.balance_due, bill.currency)}</dd>
                                </div>
                            </dl>
                        </div>

                        {bill.notes && (
                            <div className="border-t border-slate-100 p-6">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
                                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{bill.notes}</p>
                            </div>
                        )}
                    </div>

                    <div className="no-print space-y-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">Payments</h2>
                            {bill.payments.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>
                            ) : (
                                <ul className="mt-3 divide-y divide-slate-100">
                                    {bill.payments.map((payment) => (
                                        <li key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{currency(payment.amount, bill.currency)}</p>
                                                <p className="text-xs text-slate-500">{payment.method.replace(/_/g, ' ')} · {formatDate(payment.paid_on)}</p>
                                                {payment.reference && <p className="text-xs text-slate-400">Ref {payment.reference}</p>}
                                            </div>
                                            <Badge tone="emerald">Paid</Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">Settlement</h2>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${bill.total > 0 ? Math.min((bill.amount_paid / bill.total) * 100, 100) : 0}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-slate-500">
                                {bill.total > 0 ? Math.round((bill.amount_paid / bill.total) * 100) : 0}% settled
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={paymentOpen}
                onClose={() => setPaymentOpen(false)}
                title="Record vendor payment"
                description={`Settle ${bill.number} and post the payment to the ledger.`}
                footer={
                    <>
                        <button type="button" onClick={() => setPaymentOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button type="submit" form="payment-form" disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                            {processing ? 'Posting…' : 'Post payment'}
                        </button>
                    </>
                }
            >
                <form id="payment-form" onSubmit={submitPayment} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Payment date" id="paid_on" type="date" value={form.data.paid_on} onChange={(e) => form.setData('paid_on', e.target.value)} error={form.errors.paid_on} />
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} error={form.errors.amount} />
                        <Select label="Method" id="method" value={form.data.method} onChange={(e) => form.setData('method', e.target.value)} error={form.errors.method}>
                            {['bank_transfer', 'cash', 'card', 'cheque', 'other'].map((method) => (
                                <option key={method} value={method}>
                                    {method.replace(/_/g, ' ')}
                                </option>
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
