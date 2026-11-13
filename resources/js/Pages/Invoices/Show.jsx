import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowLeftIcon,
    BellAlertIcon,
    CheckCircleIcon,
    ClockIcon,
    CreditCardIcon,
    EnvelopeIcon,
    PencilSquareIcon,
    PlusIcon,
    PrinterIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import Badge from '../../Components/Badge';
import CompanyIdentity from '../../Components/CompanyIdentity';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

function ActionButton({ children, onClick, processing, variant = 'primary', icon: Icon }) {
    const variants = {
        primary: 'bg-slate-900 text-white hover:bg-slate-800',
        secondary: 'border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700',
        danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={processing}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`}
        >
            {Icon && <Icon className="h-4 w-4" />}
            {processing ? 'Working…' : children}
        </button>
    );
}

export default function InvoiceShow({ invoice, paymentMethods = [] }) {
    const canApprove = usePage().props.auth?.user?.can_approve;
    const [processing, setProcessing] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);

    const paymentForm = useForm({
        paid_on: today(),
        amount: invoice.balance_due,
        method: paymentMethods[0]?.value ?? 'bank_transfer',
        reference: '',
        notes: '',
    });

    const submitPayment = (event) => {
        event.preventDefault();
        paymentForm.post(`/invoices/${invoice.id}/payments`, {
            preserveScroll: true,
            onSuccess: () => {
                setPaymentOpen(false);
                paymentForm.reset('reference', 'notes');
            },
        });
    };

    const runAction = (url) => {
        router.post(
            url,
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const remove = () => {
        const message = ['sent', 'overdue', 'paid'].includes(invoice.status)
            ? `Delete invoice ${invoice.number}? Its ledger posting and any recorded payments will be reversed. This cannot be undone.`
            : `Delete invoice ${invoice.number}? This cannot be undone.`;

        if (confirm(message)) {
            router.delete(`/invoices/${invoice.id}`, { preserveScroll: true });
        }
    };

    const isPosted = ['sent', 'overdue', 'paid'].includes(invoice.status);
    const canEdit = invoice.status === 'draft'
        || (Boolean(canApprove) && ['sent', 'overdue', 'void'].includes(invoice.status) && Number(invoice.amount_paid) <= 0);
    const canDelete = ['draft', 'void'].includes(invoice.status) || (Boolean(canApprove) && isPosted);

    const contact = invoice.contact;

    return (
        <AppLayout>
            <Head title={`Invoice ${invoice.number}`} />

            <div className="space-y-6">
                <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/invoices"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
                        >
                            <ArrowLeftIcon className="h-3.5 w-3.5" />
                            Back to invoices
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                                {invoice.number}
                            </h1>
                            <Badge tone={statusTone(invoice.status)} dot>
                                {invoice.status_label}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Issued {formatDate(invoice.issue_date)} · Due {formatDate(invoice.due_date)}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ActionButton variant="secondary" icon={PrinterIcon} onClick={() => window.print()}>
                            Print
                        </ActionButton>

                        {canEdit && (
                            <Link
                                href={`/invoices?edit=${invoice.id}`}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                                title={isPosted ? 'Editing reverses the original posting' : 'Edit invoice'}
                            >
                                <PencilSquareIcon className="h-4 w-4" />
                                Edit
                            </Link>
                        )}

                        {canDelete && (
                            <button
                                type="button"
                                onClick={remove}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                title={isPosted ? 'Deleting reverses the posting and payments' : 'Delete invoice'}
                            >
                                Delete
                            </button>
                        )}

                        {invoice.status === 'draft' && (
                            <ActionButton
                                icon={EnvelopeIcon}
                                processing={processing}
                                onClick={() => runAction(`/invoices/${invoice.id}/send`)}
                            >
                                Mark as sent
                            </ActionButton>
                        )}

                        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <ActionButton
                                variant="danger"
                                icon={BellAlertIcon}
                                processing={processing}
                                onClick={() => runAction(`/invoices/${invoice.id}/reminder`)}
                            >
                                Queue reminder
                            </ActionButton>
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
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-600">
                                    Tax invoice
                                </p>
                                <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
                                    {invoice.number}
                                </h2>

                                <div className="mt-5 border-t border-slate-100 pt-3 sm:border-slate-200">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        Amount due
                                    </p>
                                    <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                                        {currency(invoice.balance_due, invoice.currency)}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        of {currency(invoice.total, invoice.currency)} total
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 border-b border-slate-100 p-6 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Billed to
                                </p>
                                {contact ? (
                                    <div className="mt-2 space-y-0.5 text-sm">
                                        <p className="font-semibold text-slate-900">{contact.name}</p>
                                        {contact.email && <p className="text-slate-500">{contact.email}</p>}
                                        {contact.phone && <p className="text-slate-500">{contact.phone}</p>}
                                        {contact.address && <p className="text-slate-500">{contact.address}</p>}
                                        <p className="text-slate-500">
                                            {[contact.city, contact.country].filter(Boolean).join(', ')}
                                        </p>
                                        {contact.tax_number && (
                                            <p className="pt-1 text-xs text-slate-400">Tax ID: {contact.tax_number}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-400">No customer attached</p>
                                )}
                            </div>

                            <div className="sm:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Details
                                </p>
                                <dl className="mt-2 space-y-1.5 text-sm">
                                    <div className="flex justify-between gap-4 sm:justify-end">
                                        <dt className="text-slate-500">Issue date</dt>
                                        <dd className="font-medium text-slate-900">{formatDate(invoice.issue_date)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4 sm:justify-end">
                                        <dt className="text-slate-500">Due date</dt>
                                        <dd className="font-medium text-slate-900">{formatDate(invoice.due_date)}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4 sm:justify-end">
                                        <dt className="text-slate-500">Currency</dt>
                                        <dd className="font-medium text-slate-900">{invoice.currency}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4 sm:justify-end">
                                        <dt className="text-slate-500">Sent</dt>
                                        <dd className="font-medium text-slate-900">
                                            {invoice.sent_at ? formatDate(invoice.sent_at) : 'Not sent'}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-6 py-3">Description</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Unit price</th>
                                        <th className="px-4 py-3 text-right">Tax</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoice.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900">{item.description}</p>
                                                {item.account && (
                                                    <p className="mt-0.5 text-xs text-slate-400">
                                                        {item.account.code} · {item.account.name}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">
                                                {Number(item.quantity)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">
                                                {currency(item.unit_price, invoice.currency)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">
                                                {Number(item.tax_rate)}%
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-slate-900">
                                                {currency(item.total, invoice.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end border-t border-slate-100 p-6">
                            <dl className="w-full max-w-xs space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Subtotal</dt>
                                    <dd className="font-medium text-slate-900">
                                        {currency(invoice.subtotal, invoice.currency)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Tax</dt>
                                    <dd className="font-medium text-slate-900">
                                        {currency(invoice.tax_total, invoice.currency)}
                                    </dd>
                                </div>
                                {Number(invoice.discount) > 0 && (
                                    <div className="flex items-center justify-between">
                                        <dt className="text-slate-500">Discount</dt>
                                        <dd className="font-medium text-emerald-600">
                                            −{currency(invoice.discount, invoice.currency)}
                                        </dd>
                                    </div>
                                )}
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                    <dt className="font-semibold text-slate-700">Total</dt>
                                    <dd className="font-display text-base font-semibold text-slate-900">
                                        {currency(invoice.total, invoice.currency)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Amount paid</dt>
                                    <dd className="font-medium text-emerald-600">
                                        −{currency(invoice.amount_paid, invoice.currency)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                    <dt className="font-semibold text-slate-700">Balance due</dt>
                                    <dd className="font-display text-base font-semibold text-slate-900">
                                        {currency(invoice.balance_due, invoice.currency)}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {(invoice.notes || invoice.terms) && (
                            <div className="grid gap-6 border-t border-slate-100 p-6 sm:grid-cols-2">
                                {invoice.notes && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Notes
                                        </p>
                                        <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{invoice.notes}</p>
                                    </div>
                                )}
                                {invoice.terms && (
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Terms
                                        </p>
                                        <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{invoice.terms}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="no-print space-y-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">Payment status</h2>
                            <dl className="mt-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="flex items-center gap-1.5 text-slate-500">
                                        <CreditCardIcon className="h-4 w-4" />
                                        Paid to date
                                    </dt>
                                    <dd className="font-semibold text-slate-900">
                                        {currency(invoice.amount_paid, invoice.currency)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="flex items-center gap-1.5 text-slate-500">
                                        <ClockIcon className="h-4 w-4" />
                                        Last reminder
                                    </dt>
                                    <dd className="font-medium text-slate-700">
                                        {invoice.last_reminded_at ? formatDateTime(invoice.last_reminded_at) : 'Never'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="flex items-center gap-1.5 text-slate-500">
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Paid on
                                    </dt>
                                    <dd className="font-medium text-slate-700">
                                        {invoice.paid_at ? formatDate(invoice.paid_at) : '—'}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{
                                        width: `${
                                            Number(invoice.total) > 0
                                                ? Math.min((Number(invoice.amount_paid) / Number(invoice.total)) * 100, 100)
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-slate-500">
                                {Number(invoice.total) > 0
                                    ? Math.round((Number(invoice.amount_paid) / Number(invoice.total)) * 100)
                                    : 0}
                                % settled
                            </p>
                        </div>

                        {(invoice.sales_type || invoice.salesperson || invoice.ship_via || invoice.promised_date || invoice.delivery_status || invoice.ship_to) && (
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                <h2 className="font-display text-base font-semibold text-slate-900">Sale details</h2>
                                <dl className="mt-3 space-y-2 text-sm">
                                    {[
                                        ['Sales type', invoice.sales_type],
                                        ['Salesperson', invoice.salesperson],
                                        ['Ship via', invoice.ship_via],
                                        ['Promised', invoice.promised_date ? formatDate(invoice.promised_date) : null],
                                        ['Delivery', invoice.delivery_status],
                                    ]
                                        .filter(([, value]) => value)
                                        .map(([label, value]) => (
                                            <div key={label} className="flex items-baseline justify-between gap-3">
                                                <dt className="text-slate-500">{label}</dt>
                                                <dd className="text-right font-medium text-slate-900">{value}</dd>
                                            </div>
                                        ))}
                                </dl>
                                {invoice.ship_to && (
                                    <div className="mt-3 border-t border-slate-100 pt-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Ship to
                                        </p>
                                        <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{invoice.ship_to}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">Payments</h2>
                            {invoice.payments.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>
                            ) : (
                                <ul className="mt-3 divide-y divide-slate-100">
                                    {invoice.payments.map((payment) => (
                                        <li key={payment.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {currency(payment.amount, invoice.currency)}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {payment.method_label} · {formatDate(payment.paid_on)}
                                                </p>
                                                {payment.reference && (
                                                    <p className="text-xs text-slate-400">Ref {payment.reference}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <Badge tone="emerald">Received</Badge>
                                                <Link
                                                    href={`/transactions/receipts/${payment.id}/print`}
                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-brand-700"
                                                    title={`Print receipt ${payment.receipt_number ?? payment.id}`}
                                                >
                                                    <PrinterIcon className="h-3.5 w-3.5" />
                                                    Print receipt
                                                </Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Record a payment
                            </p>
                            {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                                <>
                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                                        Capture a receipt and post it to cash and receivables in one step.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentOpen(true)}
                                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Record payment
                                    </button>
                                </>
                            ) : (
                                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                                    {invoice.status === 'paid'
                                        ? 'This invoice is fully settled.'
                                        : 'Mark the invoice as sent before recording a payment.'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={paymentOpen}
                onClose={() => setPaymentOpen(false)}
                title="Record a payment"
                description={`Apply a receipt to invoice ${invoice.number}.`}
                footer={
                    <>
                        <button type="button" onClick={() => setPaymentOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="payment-form"
                            disabled={paymentForm.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {paymentForm.processing ? 'Saving…' : 'Record payment'}
                        </button>
                    </>
                }
            >
                <form id="payment-form" onSubmit={submitPayment} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Paid on"
                            id="paid_on"
                            type="date"
                            value={paymentForm.data.paid_on}
                            onChange={(event) => paymentForm.setData('paid_on', event.target.value)}
                            error={paymentForm.errors.paid_on}
                        />
                        <TextInput
                            label="Amount"
                            id="amount"
                            type="number"
                            step="0.01"
                            value={paymentForm.data.amount}
                            onChange={(event) => paymentForm.setData('amount', event.target.value)}
                            error={paymentForm.errors.amount}
                            hint={`Balance due ${currency(invoice.balance_due, invoice.currency)}`}
                        />
                        <RichSelect
                            label="Method"
                            id="method"
                            value={paymentForm.data.method}
                            onChange={(value) => paymentForm.setData('method', value)}
                            error={paymentForm.errors.method}
                            options={(paymentMethods.length > 0
                                ? paymentMethods
                                : [
                                      { value: 'bank_transfer', label: 'Bank transfer' },
                                      { value: 'cash', label: 'Cash' },
                                      { value: 'card', label: 'Card' },
                                      { value: 'cheque', label: 'Cheque' },
                                      { value: 'other', label: 'Other' },
                                  ]
                            ).map((method) => ({
                                value: method.value,
                                primary: method.label,
                            }))}
                        />
                        <TextInput
                            label="Reference"
                            id="reference"
                            value={paymentForm.data.reference}
                            onChange={(event) => paymentForm.setData('reference', event.target.value)}
                            error={paymentForm.errors.reference}
                            placeholder="Bank reference or receipt no."
                        />
                    </div>

                    <Textarea
                        label="Notes"
                        id="notes"
                        value={paymentForm.data.notes}
                        onChange={(event) => paymentForm.setData('notes', event.target.value)}
                        error={paymentForm.errors.notes}
                        rows={3}
                    />
                </form>
            </Modal>
        </AppLayout>
    );
}
