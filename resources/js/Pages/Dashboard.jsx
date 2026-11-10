import { Head, Link } from '@inertiajs/react';
import {
    ArrowTrendingUpIcon,
    BanknotesIcon,
    BookOpenIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    ReceiptPercentIcon,
    ScaleIcon,
    UsersIcon,
    WalletIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../Layouts/AppLayout';
import PageHeader from '../Components/PageHeader';
import StatCard from '../Components/StatCard';
import Badge from '../Components/Badge';
import EmptyState from '../Components/EmptyState';
import { compactCurrency, currency, formatDate, statusTone } from '../lib/format';

function MonthlyRevenueChart({ data }) {
    const max = Math.max(...data.map((item) => Number(item.total)), 1);
    const total = data.reduce((sum, item) => sum + Number(item.total), 0);

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="font-display text-base font-semibold text-slate-900">Revenue trend</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Billed across the last six months</p>
                </div>
                <div className="text-right">
                    <p className="font-display text-lg font-semibold text-slate-900">{currency(total)}</p>
                    <p className="text-xs text-slate-500">6-month total</p>
                </div>
            </div>

            <div className="mt-6 flex h-48 items-end gap-2 sm:gap-4">
                {data.map((item) => {
                    const height = Math.max((Number(item.total) / max) * 100, 4);

                    return (
                        <div key={item.label} className="group flex flex-1 flex-col items-center justify-end gap-2">
                            <div className="relative flex w-full flex-1 items-end">
                                <div
                                    className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400 opacity-90 transition group-hover:from-brand-600 group-hover:to-brand-500"
                                    style={{ height: `${height}%` }}
                                    title={`${item.label}: ${currency(item.total)}`}
                                />
                                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition group-hover:opacity-100">
                                    {compactCurrency(item.total)}
                                </span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">{item.month}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function Dashboard({ metrics }) {
    const {
        cash,
        revenue_ytd,
        expenses_ytd,
        receivables,
        overdue_count,
        overdue_amount,
        invoice_count,
        open_invoice_count,
        posted_entries,
        draft_entries,
        account_count,
        monthly_revenue,
        recent_invoices,
        expense_breakdown,
        trial_balance,
    } = metrics;

    const expenseMax = Math.max(...expense_breakdown.map((item) => Number(item.total)), 1);

    return (
        <AppLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Overview"
                    title="Good to see you."
                    description="A live snapshot of cash, receivables, and the health of your ledger."
                >
                    <Link
                        href="/invoices"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                        Review invoices
                    </Link>
                    <Link
                        href="/journal"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                    >
                        <BookOpenIcon className="h-4 w-4" />
                        Open journal
                    </Link>
                </PageHeader>

                {overdue_count > 0 && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600 ring-1 ring-inset ring-rose-200">
                                <ExclamationTriangleIcon className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-rose-800">
                                    {overdue_count} overdue {overdue_count === 1 ? 'invoice needs' : 'invoices need'} attention
                                </p>
                                <p className="text-xs text-rose-600">
                                    {currency(overdue_amount)} outstanding past the due date.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/invoices?status=overdue"
                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                        >
                            Review overdue
                        </Link>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Cash balance"
                        value={currency(cash)}
                        hint="Account 1100 · posted entries"
                        icon={WalletIcon}
                        accent="emerald"
                    />
                    <StatCard
                        label="Revenue YTD"
                        value={currency(revenue_ytd)}
                        hint={`${invoice_count} non-void invoices`}
                        icon={ArrowTrendingUpIcon}
                        accent="brand"
                    />
                    <StatCard
                        label="Receivables"
                        value={currency(receivables)}
                        hint={`${open_invoice_count} open invoices`}
                        icon={ReceiptPercentIcon}
                        accent="sky"
                    />
                    <StatCard
                        label="Expenses YTD"
                        value={currency(expenses_ytd)}
                        hint={`${expense_breakdown.length} active expense accounts`}
                        icon={BanknotesIcon}
                        accent="amber"
                    />
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                        <MonthlyRevenueChart data={monthly_revenue} />
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-display text-base font-semibold text-slate-900">Trial balance</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">All posted journal lines</p>
                                </div>
                                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                                    <ScaleIcon className="h-5 w-5" />
                                </span>
                            </div>

                            <dl className="mt-4 space-y-2.5 text-sm">
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Total debits</dt>
                                    <dd className="font-semibold text-slate-900">{currency(trial_balance.debit)}</dd>
                                </div>
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500">Total credits</dt>
                                    <dd className="font-semibold text-slate-900">{currency(trial_balance.credit)}</dd>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                                    <dt className="text-slate-500">Difference</dt>
                                    <dd className="font-semibold text-slate-900">{currency(trial_balance.difference)}</dd>
                                </div>
                            </dl>

                            <div className="mt-4">
                                <Badge tone={trial_balance.balanced ? 'emerald' : 'rose'} dot>
                                    {trial_balance.balanced ? 'Balanced ledger' : 'Out of balance'}
                                </Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Accounts', value: account_count, icon: UsersIcon },
                                { label: 'Posted', value: posted_entries, icon: BookOpenIcon },
                                { label: 'Drafts', value: draft_entries, icon: DocumentTextIcon },
                            ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-sm">
                                    <item.icon className="mx-auto h-4 w-4 text-slate-400" />
                                    <p className="mt-1.5 font-display text-lg font-semibold text-slate-900">{item.value}</p>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-2">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Recent invoices</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Latest activity across your customer base</p>
                            </div>
                            <Link href="/invoices" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                View all
                            </Link>
                        </div>

                        {recent_invoices.length === 0 ? (
                            <EmptyState
                                title="No invoices yet"
                                description="Create your first invoice to see billing activity here."
                                icon={DocumentTextIcon}
                                action={
                                    <Link
                                        href="/invoices"
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        New invoice
                                    </Link>
                                }
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-2.5">Invoice</th>
                                            <th className="px-5 py-2.5">Customer</th>
                                            <th className="px-5 py-2.5">Issued</th>
                                            <th className="px-5 py-2.5 text-right">Balance</th>
                                            <th className="px-5 py-2.5 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recent_invoices.map((invoice) => (
                                            <tr key={invoice.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3">
                                                    <Link
                                                        href={`/invoices/${invoice.id}`}
                                                        className="font-semibold text-slate-900 hover:text-brand-700"
                                                    >
                                                        {invoice.number}
                                                    </Link>
                                                </td>
                                                <td className="max-w-[12rem] truncate px-5 py-3 text-slate-600">
                                                    {invoice.contact ?? '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                                                    {formatDate(invoice.issue_date)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900">
                                                    {currency(invoice.balance_due, invoice.currency)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3 text-right">
                                                    <Badge tone={statusTone(invoice.status)} dot>
                                                        {invoice.status_label}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Expense mix</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Top expense accounts by posted balance</p>
                        </div>

                        {expense_breakdown.length === 0 ? (
                            <p className="mt-6 text-sm text-slate-500">No posted expenses yet.</p>
                        ) : (
                            <ul className="mt-5 space-y-4">
                                {expense_breakdown.map((item) => (
                                    <li key={item.code}>
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="min-w-0 truncate font-medium text-slate-700">
                                                <span className="mr-1.5 text-xs font-semibold text-slate-400">{item.code}</span>
                                                {item.name}
                                            </span>
                                            <span className="shrink-0 font-semibold text-slate-900">
                                                {compactCurrency(item.total)}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                                                style={{ width: `${Math.max((Number(item.total) / expenseMax) * 100, 4)}%` }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
