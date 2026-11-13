import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import CompanyIdentity from '../../Components/CompanyIdentity';
import { currency, formatDate } from '../../lib/format';

function Detail({ label, value }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="text-right text-sm font-medium text-slate-900">{value ?? '—'}</dd>
        </div>
    );
}

export default function PrintPayment({ payment }) {
    const bill = payment.bill;
    const contact = payment.contact;

    return (
        <AppLayout>
            <Head title={`Payment ${payment.payment_number}`} />

            <div className="mx-auto max-w-4xl space-y-5">
                <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                        href="/transactions/payments"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to payments
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                        {bill && (
                            <Link
                                href={`/bills/${bill.id}`}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400"
                            >
                                View bill
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            Print payment voucher
                        </button>
                    </div>
                </div>

                <article className="print-plain overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <CompanyIdentity size="lg" />
                            </div>

                            <div className="flex-none text-left sm:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-600">
                                    Vendor payment
                                </p>
                                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
                                    {payment.payment_number}
                                </h1>
                                <p className="mt-1 text-xs text-slate-500">Paid {formatDate(payment.paid_on)}</p>

                                <div className="mt-5 border-t border-slate-100 pt-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        Amount paid
                                    </p>
                                    <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                                        {currency(payment.amount, payment.currency)}
                                    </p>
                                    {bill && (
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            Bill balance due {currency(bill.balance_due, bill.currency)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 border-b border-slate-200 px-6 py-6 sm:grid-cols-2 sm:px-8">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Paid to the order of
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
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-slate-400">No vendor attached</p>
                            )}
                        </div>

                        <dl className="text-sm">
                            <Detail label="Payment method" value={payment.method} />
                            <Detail label="Reference" value={payment.reference} />
                            {payment.bank_account && <Detail label="Paid from" value={payment.bank_account} />}
                            {bill && <Detail label="Bill" value={bill.number} />}
                            {bill?.bill_date && <Detail label="Bill date" value={formatDate(bill.bill_date)} />}
                            {bill?.due_date && <Detail label="Due date" value={formatDate(bill.due_date)} />}
                            {bill?.status && <Detail label="Bill status" value={bill.status} />}
                        </dl>
                    </div>

                    <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
                        <div className="text-xs leading-relaxed text-slate-500">
                            {payment.notes && (
                                <>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment notes</p>
                                    <p className="mt-1.5 whitespace-pre-line">{payment.notes}</p>
                                </>
                            )}
                            {!payment.notes && (
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Payment voucher
                                </p>
                            )}
                        </div>

                        <dl className="space-y-2 text-sm">
                            {bill && (
                                <>
                                    <div className="flex items-center justify-between gap-4 text-slate-600">
                                        <dt>Bill total</dt>
                                        <dd className="tabular-nums">{currency(bill.total, bill.currency)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-slate-600">
                                        <dt>Paid to date</dt>
                                        <dd className="tabular-nums">{currency(bill.amount_paid, bill.currency)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                                        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                            {bill.balance_due > 0 ? 'Balance due' : 'Settled in full'}
                                        </dt>
                                        <dd className="font-display text-lg font-semibold tabular-nums">
                                            {currency(bill.balance_due, bill.currency)}
                                        </dd>
                                    </div>
                                </>
                            )}
                            {!bill && (
                                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                        Amount paid
                                    </dt>
                                    <dd className="font-display text-lg font-semibold tabular-nums">
                                        {currency(payment.amount, payment.currency)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-5 sm:px-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                            <p className="max-w-md text-xs leading-relaxed text-slate-500">
                                {bill
                                    ? 'This voucher confirms the payment recorded against the vendor bill above and is generated from the accounting ledger.'
                                    : 'This voucher confirms the vendor payment recorded in the accounting ledger.'}
                            </p>
                            <div className="w-full max-w-[15rem] text-center">
                                <div className="border-t border-slate-400 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Authorised signature
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </AppLayout>
    );
}
