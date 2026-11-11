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

export default function PrintReceipt({ receipt }) {
    const invoice = receipt.invoice;
    const contact = receipt.contact;

    return (
        <AppLayout>
            <Head title={`Receipt ${receipt.receipt_number}`} />

            <div className="mx-auto max-w-4xl space-y-5">
                <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                        href="/transactions/receipts"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to receipts
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                        {invoice && (
                            <Link
                                href={`/invoices/${invoice.id}`}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400"
                            >
                                View invoice
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            Print receipt
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
                                    Payment receipt
                                </p>
                                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
                                    {receipt.receipt_number}
                                </h1>
                                <p className="mt-1 text-xs text-slate-500">Issued {formatDate(receipt.paid_on)}</p>

                                <div className="mt-5 border-t border-slate-100 pt-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        Amount received
                                    </p>
                                    <p className="mt-1 font-display text-2xl font-semibold text-slate-900">
                                        {currency(receipt.amount, receipt.currency)}
                                    </p>
                                    {invoice && (
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            Balance due {currency(invoice.balance_due, receipt.currency)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 border-b border-slate-200 px-6 py-6 sm:grid-cols-2 sm:px-8">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Received from
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
                                <p className="mt-2 text-sm text-slate-400">No customer attached</p>
                            )}
                        </div>

                        <dl className="text-sm">
                            <Detail label="Payment method" value={receipt.method} />
                            <Detail label="Reference" value={receipt.reference} />
                            {invoice && <Detail label="Invoice" value={invoice.number} />}
                            {invoice?.sales_type && <Detail label="Sales type" value={invoice.sales_type} />}
                            {invoice?.terms && <Detail label="Terms" value={invoice.terms} />}
                            {invoice?.salesperson && <Detail label="Salesperson" value={invoice.salesperson} />}
                        </dl>
                    </div>

                    {invoice?.items?.length > 0 && (
                        <div className="border-b border-slate-200">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/70 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-6 py-3 sm:px-8">Description</th>
                                        <th className="px-4 py-3 text-right">Qty</th>
                                        <th className="px-4 py-3 text-right">Rate</th>
                                        <th className="px-4 py-3 text-right">Tax</th>
                                        <th className="px-6 py-3 text-right sm:px-8">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoice.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4 sm:px-8">
                                                <p className="font-medium text-slate-900">{item.description}</p>
                                                {item.account && <p className="mt-0.5 text-xs text-slate-400">{item.account}</p>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">{item.quantity}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">
                                                {currency(item.unit_price, receipt.currency)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-600">{item.tax_rate}%</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-slate-900 sm:px-8">
                                                {currency(item.total, receipt.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
                        <div className="text-xs leading-relaxed text-slate-500">
                            {receipt.notes && (
                                <>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment notes</p>
                                    <p className="mt-1.5 whitespace-pre-line">{receipt.notes}</p>
                                </>
                            )}
                            {invoice?.notes && (
                                <>
                                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Invoice notes</p>
                                    <p className="mt-1.5 whitespace-pre-line">{invoice.notes}</p>
                                </>
                            )}
                            {invoice?.delivery_status && (
                                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Delivery status <span className="ml-1 text-slate-600">{invoice.delivery_status}</span>
                                </p>
                            )}
                        </div>

                        <dl className="space-y-2 text-sm">
                            {invoice && (
                                <>
                                    <div className="flex items-center justify-between gap-4 text-slate-600">
                                        <dt>Subtotal</dt>
                                        <dd className="tabular-nums">{currency(invoice.subtotal, receipt.currency)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-slate-600">
                                        <dt>Tax</dt>
                                        <dd className="tabular-nums">{currency(invoice.tax_total, receipt.currency)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2 font-semibold text-slate-900">
                                        <dt>Invoice total</dt>
                                        <dd className="tabular-nums">{currency(invoice.total, receipt.currency)}</dd>
                                    </div>
                                </>
                            )}
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                                <dt>Total paid</dt>
                                <dd className="tabular-nums">{currency(invoice?.amount_paid ?? receipt.amount, receipt.currency)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                    {invoice && invoice.balance_due > 0 ? 'Balance due' : 'Amount received'}
                                </dt>
                                <dd className="font-display text-lg font-semibold tabular-nums">
                                    {currency(invoice ? invoice.balance_due : receipt.amount, receipt.currency)}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-5 sm:px-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                            <p className="max-w-md text-xs leading-relaxed text-slate-500">
                                Received with thanks. This receipt confirms the payment recorded against the invoice above and is
                                generated from the accounting ledger.
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
