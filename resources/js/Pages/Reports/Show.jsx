import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import CompanyIdentity from '../../Components/CompanyIdentity';
import Badge from '../../Components/Badge';
import StatCard from '../../Components/StatCard';
import { Select, TextInput } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime, percent } from '../../lib/format';

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

export default function ReportsShow({ report, data, filters, options }) {
    const [form, setForm] = useState({
        from: dateOnly(filters.from),
        to: dateOnly(filters.to),
        account_id: filters.account_id ?? '',
        budget_id: filters.budget_id ?? '',
        dimension_id: filters.dimension_id ?? '',
        contact_id: filters.contact_id ?? '',
    });

    const isDimension = ['department', 'project', 'branch', 'cost-center'].includes(report.key);
    const dimensionOptions = report.key === 'department'
        ? options.departments
        : report.key === 'project'
            ? options.projects
            : report.key === 'cost-center'
                ? options.costCenters
                : options.branches;
    const isAsOf = ['balance-sheet', 'bank-reconciliation'].includes(report.key);
    const hideDates = report.key === 'fixed-asset-register';

    const apply = (event) => {
        event.preventDefault();
        const query = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '' && value != null));
        router.get(`/reports/${report.key}`, query, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout>
            <Head title={report.name} />

            <div className="space-y-6">
                <PageHeader eyebrow={report.group} title={report.name} description={report.description}>
                    <Link href="/reports" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                        <ArrowLeftIcon className="h-4 w-4" />
                        All reports
                    </Link>
                    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PrinterIcon className="h-4 w-4" />
                        Print
                    </button>
                </PageHeader>

                <form onSubmit={apply} className="no-print grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
                    {isAsOf ? (
                        <TextInput label="As of" id="report_to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                    ) : hideDates ? null : (
                        <>
                            <TextInput label="From" id="report_from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                            <TextInput label="To" id="report_to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                        </>
                    )}
                    {report.key === 'general-ledger' && (
                        <Select label="Account" id="report_account" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                            {options.accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                        </Select>
                    )}
                    {report.key === 'customer-statement' && (
                        <Select label="Customer" id="report_contact" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                            <option value="">Select a customer</option>
                            {options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                        </Select>
                    )}
                    {report.key === 'budget-vs-actual' && (
                        <Select label="Budget" id="report_budget" value={form.budget_id} onChange={(e) => setForm({ ...form, budget_id: e.target.value })}>
                            {options.budgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name} · FY {budget.fiscal_year}</option>)}
                        </Select>
                    )}
                    {isDimension && (
                        <Select label="Filter by" id="report_dimension" value={form.dimension_id} onChange={(e) => setForm({ ...form, dimension_id: e.target.value })}>
                            {dimensionOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </Select>
                    )}
                    <div className="flex items-end">
                        <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Run report</button>
                    </div>
                </form>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
                    <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                        <CompanyIdentity size="lg" />
                        <div className="sm:text-right">
                            <h2 className="font-display text-xl font-semibold text-slate-900">{report.name}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {isAsOf || report.key === 'fixed-asset-register'
                                    ? `As of ${formatDate(data.as_of)}`
                                    : `${formatDate(data.from ?? filters.from)} – ${formatDate(data.to ?? filters.to)}`}
                            </p>
                        </div>
                    </div>

                    {report.key === 'trial-balance' && <TrialBalance data={data} />}
                    {report.key === 'balance-sheet' && <BalanceSheet data={data} />}
                    {report.key === 'profit-loss' && <ProfitAndLoss data={data} />}
                    {report.key === 'cash-flow' && <CashFlow data={data} />}
                    {report.key === 'general-ledger' && <GeneralLedger data={data} />}
                    {report.key === 'sales' && <SalesReport data={data} />}
                    {report.key === 'expenses' && <ExpenseReport data={data} />}
                    {report.key === 'customer-statement' && <CustomerStatement data={data} />}
                    {(report.key === 'aging-receivable' || report.key === 'aging-payable') && <Aging data={data} />}
                    {report.key === 'bank-reconciliation' && <BankReconciliation data={data} />}
                    {report.key === 'fixed-asset-register' && <FixedAssetRegister data={data} />}
                    {report.key === 'vat' && <VatReturn data={data} />}
                    {report.key === 'budget-vs-actual' && <BudgetVsActual data={data} />}
                    {isDimension && <DimensionPnl data={data} />}
                    {report.key === 'audit' && <AuditHistory data={data} />}
                </div>
            </div>
        </AppLayout>
    );
}

function TrialBalance({ data }) {
    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge tone={data.totals.balanced ? 'emerald' : 'rose'} dot>{data.totals.balanced ? 'Balanced' : 'Out of balance'}</Badge>
                <span className="text-sm text-slate-500">Difference {currency(data.totals.difference)}</span>
            </div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Code</th>
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4 text-right">Debit</th>
                        <th className="py-2 pr-4 text-right">Credit</th>
                        <th className="py-2 text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.accounts.map((account) => (
                        <tr key={account.id}>
                            <td className="py-2 pr-4 font-mono text-xs text-slate-500">{account.code}</td>
                            <td className="py-2 pr-4 text-slate-800">{account.name}</td>
                            <td className="py-2 pr-4 capitalize text-slate-500">{account.type_label}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{account.debit ? currency(account.debit) : '—'}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{account.credit ? currency(account.credit) : '—'}</td>
                            <td className="py-2 text-right font-medium text-slate-900">{currency(account.balance)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                        <td className="py-3 pr-4" colSpan={3}>Totals</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.debit)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.credit)}</td>
                        <td className="py-3 text-right">{currency(data.totals.difference)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function BalanceSheet({ data }) {
    return (
        <div className="grid gap-8 lg:grid-cols-2">
            <StatementSection title="Assets" lines={data.assets} total={data.totals.assets} />
            <div className="space-y-8">
                <StatementSection title="Liabilities" lines={data.liabilities} total={data.totals.liabilities} />
                <StatementSection title="Equity" lines={data.equity} total={data.totals.equity} />
                <div className="border-t-2 border-slate-200 pt-3">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>Liabilities & equity</span>
                        <span>{currency(data.totals.liabilities_and_equity)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                        <Badge tone={data.totals.balanced ? 'emerald' : 'rose'} dot>{data.totals.balanced ? 'Balanced' : 'Out of balance'}</Badge>
                        <span className="text-slate-500">Difference {currency(data.totals.difference)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfitAndLoss({ data }) {
    return (
        <div className="grid gap-8 lg:grid-cols-2">
            <StatementSection title="Revenue" lines={data.revenue} total={data.totals.revenue} />
            <StatementSection title="Expenses" lines={data.expenses} total={data.totals.expenses} />
            <div className="lg:col-span-2 border-t-2 border-slate-200 pt-4">
                <div className="flex items-center justify-between font-display text-lg font-semibold text-slate-900">
                    <span>Net income</span>
                    <span className={data.totals.net_income >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{currency(data.totals.net_income)}</span>
                </div>
            </div>
        </div>
    );
}

function CashFlow({ data }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Opening cash</span>
                <span className="font-semibold text-slate-900">{currency(data.opening_cash)}</span>
            </div>
            {data.sections.map((section) => (
                <div key={section.key}>
                    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-sm font-semibold text-slate-800">{section.label}</h3>
                        <span className="text-sm font-semibold text-slate-900">{currency(section.total)}</span>
                    </div>
                    {section.items.length === 0 ? (
                        <p className="py-2 text-sm text-slate-400">No {section.key} cash movements.</p>
                    ) : (
                        <table className="min-w-full text-sm">
                            <tbody className="divide-y divide-slate-50">
                                {section.items.map((item, index) => (
                                    <tr key={`${section.key}-${index}`}>
                                        <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDate(item.date)}</td>
                                        <td className="py-2 pr-4 font-mono text-xs text-slate-500">{item.reference ?? '—'}</td>
                                        <td className="py-2 pr-4 text-slate-700">{item.memo ?? '—'}</td>
                                        <td className={`py-2 text-right font-medium ${item.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ))}
            <div className="space-y-2 border-t-2 border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm font-medium text-slate-600"><span>Net change in cash</span><span className={data.net_change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{currency(data.net_change)}</span></div>
                <div className="flex items-center justify-between font-display text-lg font-semibold text-slate-900"><span>Closing cash</span><span>{currency(data.closing_cash)}</span></div>
            </div>
        </div>
    );
}

function GeneralLedger({ data }) {
    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">{data.account.code} · {data.account.name}</p>
                    <p className="text-xs capitalize text-slate-500">{data.account.type}</p>
                </div>
                <div className="text-right text-sm">
                    <p className="text-xs text-slate-500">Opening balance</p>
                    <p className="font-semibold text-slate-900">{currency(data.opening_balance)}</p>
                </div>
            </div>
            {data.lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No posted lines in this period.</p>
            ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4">Reference</th>
                            <th className="py-2 pr-4">Description</th>
                            <th className="py-2 pr-4 text-right">Debit</th>
                            <th className="py-2 pr-4 text-right">Credit</th>
                            <th className="py-2 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data.lines.map((line) => (
                            <tr key={line.id}>
                                <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDate(line.date)}</td>
                                <td className="py-2 pr-4 font-mono text-xs text-slate-500">{line.reference ?? '—'}</td>
                                <td className="py-2 pr-4 text-slate-700">{line.description ?? line.memo ?? '—'}</td>
                                <td className="py-2 pr-4 text-right text-slate-600">{line.debit ? currency(line.debit) : '—'}</td>
                                <td className="py-2 pr-4 text-right text-slate-600">{line.credit ? currency(line.credit) : '—'}</td>
                                <td className="py-2 text-right font-medium text-slate-900">{currency(line.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                            <td className="py-3 pr-4" colSpan={3}>Totals</td>
                            <td className="py-3 pr-4 text-right">{currency(data.totals.debit)}</td>
                            <td className="py-3 pr-4 text-right">{currency(data.totals.credit)}</td>
                            <td className="py-3 text-right">{currency(data.totals.closing)}</td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </div>
    );
}

function SalesReport({ data }) {
    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Invoiced" value={currency(data.totals.total)} hint={`${data.totals.count} invoices`} accent="brand" />
                <StatCard label="Tax charged" value={currency(data.totals.tax)} hint="Output tax" accent="sky" />
                <StatCard label="Collected" value={currency(data.totals.paid)} hint="Receipts allocated" accent="emerald" />
                <StatCard label="Outstanding" value={currency(data.totals.balance)} hint="Still receivable" accent="amber" />
            </div>

            <ReportTable title="Monthly sales" columns={['Month', 'Invoices', 'Subtotal', 'Tax', 'Total', 'Paid']}>
                {data.monthly.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-500">No invoices issued in this period.</td></tr>
                ) : data.monthly.map((row) => (
                    <tr key={row.month}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{row.month}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{row.invoices}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.subtotal)}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.tax)}</td>
                        <td className="py-2 pr-4 text-right font-medium text-slate-900">{currency(row.total)}</td>
                        <td className="py-2 text-right text-slate-600">{currency(row.paid)}</td>
                    </tr>
                ))}
            </ReportTable>

            <ReportTable title="Sales by customer" columns={['Customer', 'Invoices', 'Subtotal', 'Tax', 'Total', 'Balance']}>
                {data.by_customer.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-500">No customer sales to summarise.</td></tr>
                ) : data.by_customer.map((row) => (
                    <tr key={row.customer}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{row.customer}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{row.invoices}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.subtotal)}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.tax)}</td>
                        <td className="py-2 pr-4 text-right font-medium text-slate-900">{currency(row.total)}</td>
                        <td className="py-2 text-right text-slate-600">{currency(row.balance)}</td>
                    </tr>
                ))}
            </ReportTable>

            <ReportTable title="Invoice detail" columns={['Date', 'Invoice', 'Customer', 'Status', 'Total', 'Paid', 'Balance']}>
                {data.rows.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-500">No invoice detail.</td></tr>
                ) : data.rows.map((row) => (
                    <tr key={row.id}>
                        <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDate(row.date)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-500">{row.number}</td>
                        <td className="py-2 pr-4 text-slate-700">{row.customer}</td>
                        <td className="py-2 pr-4 capitalize text-slate-500">{row.status}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.total)}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.paid)}</td>
                        <td className="py-2 text-right font-medium text-slate-900">{currency(row.balance)}</td>
                    </tr>
                ))}
            </ReportTable>
        </div>
    );
}

function ExpenseReport({ data }) {
    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Posted expenses" value={currency(data.totals.expenses)} hint="Ledger movement" accent="rose" />
                <StatCard label="Vendor bills" value={currency(data.totals.bill_total)} hint={`${data.totals.bills} bills`} accent="brand" />
                <StatCard label="Paid to vendors" value={currency(data.totals.bill_paid)} hint="Against those bills" accent="emerald" />
                <StatCard label="Bills outstanding" value={currency(data.totals.bill_total - data.totals.bill_paid)} hint="Unpaid balance" accent="amber" />
            </div>

            <ReportTable title="Expenses by account" columns={['Code', 'Account', 'Amount']}>
                {data.by_account.length === 0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-500">No posted expenses in this period.</td></tr>
                ) : data.by_account.map((row) => (
                    <tr key={row.code}>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-500">{row.code}</td>
                        <td className="py-2 pr-4 text-slate-700">{row.name}</td>
                        <td className="py-2 text-right font-medium text-slate-900">{currency(row.amount)}</td>
                    </tr>
                ))}
            </ReportTable>

            <ReportTable title="Purchases by vendor" columns={['Vendor', 'Bills', 'Subtotal', 'Tax', 'Total', 'Paid']}>
                {data.by_vendor.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-500">No approved vendor bills in this period.</td></tr>
                ) : data.by_vendor.map((row) => (
                    <tr key={row.vendor}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{row.vendor}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{row.bills}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.subtotal)}</td>
                        <td className="py-2 pr-4 text-right text-slate-600">{currency(row.tax)}</td>
                        <td className="py-2 pr-4 text-right font-medium text-slate-900">{currency(row.total)}</td>
                        <td className="py-2 text-right text-slate-600">{currency(row.paid)}</td>
                    </tr>
                ))}
            </ReportTable>
        </div>
    );
}

function CustomerStatement({ data }) {
    if (!data.contact) {
        return <p className="py-8 text-center text-sm text-slate-500">No customers are available to generate a statement.</p>;
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{data.contact.name}</p>
                <p className="text-slate-500">{[data.contact.address, data.contact.city, data.contact.country].filter(Boolean).join(', ') || '—'}</p>
                <p className="text-slate-500">{data.contact.email ?? 'No email'} · {data.contact.phone ?? 'No phone'} · Tax {data.contact.tax_number ?? '—'}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Opening balance" value={currency(data.opening_balance)} accent="slate" />
                <StatCard label="Invoiced" value={currency(data.totals.debit)} accent="brand" />
                <StatCard label="Receipts & credits" value={currency(data.totals.credit)} accent="emerald" />
                <StatCard label="Closing balance" value={currency(data.totals.closing)} accent={data.totals.closing > 0 ? 'amber' : 'emerald'} />
            </div>

            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Reference</th>
                        <th className="py-2 pr-4">Description</th>
                        <th className="py-2 pr-4 text-right">Debit</th>
                        <th className="py-2 pr-4 text-right">Credit</th>
                        <th className="py-2 text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    <tr>
                        <td className="py-2 pr-4 text-slate-500" colSpan={4}>Opening balance</td>
                        <td className="py-2 pr-4 text-right text-slate-400">—</td>
                        <td className="py-2 pr-4 text-right text-slate-400">—</td>
                        <td className="py-2 text-right font-semibold text-slate-900">{currency(data.opening_balance)}</td>
                    </tr>
                    {data.rows.length === 0 ? (
                        <tr><td colSpan={7} className="py-6 text-center text-slate-500">No activity in this period.</td></tr>
                    ) : data.rows.map((row, index) => (
                        <tr key={`${row.reference}-${index}`}>
                            <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDate(row.date)}</td>
                            <td className="py-2 pr-4"><Badge tone={row.type === 'Invoice' ? 'sky' : 'emerald'}>{row.type}</Badge></td>
                            <td className="py-2 pr-4 font-mono text-xs text-slate-500">{row.reference ?? '—'}</td>
                            <td className="py-2 pr-4 text-slate-700">{row.description ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{row.debit ? currency(row.debit) : '—'}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{row.credit ? currency(row.credit) : '—'}</td>
                            <td className="py-2 text-right font-medium text-slate-900">{currency(row.balance)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                        <td className="py-3 pr-4" colSpan={4}>Totals</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.debit)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.credit)}</td>
                        <td className="py-3 text-right">{currency(data.totals.closing)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function BankReconciliation({ data }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Bank accounts" value={data.totals.accounts} hint="Active register" accent="brand" />
                <StatCard label="Book balance" value={currency(data.totals.book_balance)} hint="Per bank ledger" accent="sky" />
                <StatCard label="Statement balance" value={currency(data.totals.statement_balance)} hint="Latest statements" accent="emerald" />
                <StatCard label="Unmatched items" value={data.totals.unmatched} hint={`Difference ${currency(data.totals.difference)}`} accent={data.totals.unmatched ? 'amber' : 'slate'} />
            </div>

            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4">GL account</th>
                        <th className="py-2 pr-4 text-right">Book</th>
                        <th className="py-2 pr-4 text-right">GL</th>
                        <th className="py-2 pr-4 text-right">Statement</th>
                        <th className="py-2 pr-4 text-right">Unmatched</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 text-right">Last reconciled</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.rows.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">No bank accounts configured.</td></tr>
                    ) : data.rows.map((row) => (
                        <tr key={row.id}>
                            <td className="py-2 pr-4 text-slate-800">
                                <span className="font-medium">{row.name}</span>
                                <span className="block text-xs text-slate-500">{row.bank_name ?? '—'} · {row.account_number ?? '—'}</span>
                            </td>
                            <td className="py-2 pr-4 text-slate-600">{row.gl_account ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.book_balance)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.gl_balance)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.statement_balance)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{row.unmatched_count} · {currency(row.unmatched_amount)}</td>
                            <td className="py-2 pr-4"><Badge tone={row.reconciliation_status === 'completed' ? 'emerald' : row.reconciliation_status === 'in_progress' ? 'amber' : 'slate'}>{row.reconciliation_status}</Badge></td>
                            <td className="py-2 text-right text-slate-500">{row.last_reconciled_at ? formatDate(row.last_reconciled_at) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FixedAssetRegister({ data }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Assets" value={data.totals.assets} accent="brand" />
                <StatCard label="Cost" value={currency(data.totals.cost)} accent="sky" />
                <StatCard label="Accumulated depreciation" value={currency(data.totals.accumulated_depreciation)} accent="rose" />
                <StatCard label="Carrying value" value={currency(data.totals.book_value)} accent="emerald" />
                <StatCard label="Monthly depreciation" value={currency(data.totals.monthly_depreciation)} accent="amber" />
            </div>

            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Code</th>
                        <th className="py-2 pr-4">Asset</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Purchased</th>
                        <th className="py-2 pr-4 text-right">Cost</th>
                        <th className="py-2 pr-4 text-right">Accumulated</th>
                        <th className="py-2 pr-4 text-right">Book value</th>
                        <th className="py-2 pr-4">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.rows.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">No fixed assets registered.</td></tr>
                    ) : data.rows.map((row) => (
                        <tr key={row.id}>
                            <td className="py-2 pr-4 font-mono text-xs text-slate-500">{row.code}</td>
                            <td className="py-2 pr-4 text-slate-800">
                                <span className="font-medium">{row.name}</span>
                                <span className="block text-xs text-slate-500">{row.location ?? '—'} · {row.depreciation_method}</span>
                            </td>
                            <td className="py-2 pr-4 text-slate-600">{row.category ?? '—'}</td>
                            <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{row.purchase_date ? formatDate(row.purchase_date) : '—'}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.cost)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.accumulated_depreciation)}</td>
                            <td className="py-2 pr-4 text-right font-medium text-slate-900">{currency(row.book_value)}</td>
                            <td className="py-2 pr-4"><Badge tone={row.status === 'active' ? 'emerald' : 'slate'}>{row.status}</Badge></td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                        <td className="py-3 pr-4" colSpan={4}>Totals</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.cost)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.accumulated_depreciation)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.book_value)}</td>
                        <td className="py-3" />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function ReportTable({ title, columns, children }) {
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {columns.map((column, index) => (
                                <th key={column} className={`py-2 pr-4 ${index > 0 ? 'text-right' : ''}`}>{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">{children}</tbody>
                </table>
            </div>
        </section>
    );
}

function Aging({ data }) {
    const buckets = data.buckets;
    return (
        <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {buckets.map((bucket) => (
                    <div key={bucket.label} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-medium text-slate-500">{bucket.label}</p>
                        <p className="mt-1 font-semibold text-slate-900">{currency(bucket.total)}</p>
                    </div>
                ))}
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                    <p className="text-xs font-medium text-brand-700">Total outstanding</p>
                    <p className="mt-1 font-semibold text-brand-900">{currency(data.totals.total)}</p>
                </div>
            </div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Contact</th>
                        <th className="py-2 pr-4 text-right">Current</th>
                        <th className="py-2 pr-4 text-right">1–30</th>
                        <th className="py-2 pr-4 text-right">31–60</th>
                        <th className="py-2 pr-4 text-right">61–90</th>
                        <th className="py-2 pr-4 text-right">90+</th>
                        <th className="py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.rows.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-500">Nothing outstanding.</td></tr>
                    ) : data.rows.map((row) => (
                        <tr key={row.contact}>
                            <td className="py-2 pr-4 font-medium text-slate-800">{row.contact}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.current)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.days_1_30)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.days_31_60)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.days_61_90)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.days_over_90)}</td>
                            <td className="py-2 text-right font-semibold text-slate-900">{currency(row.total)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                        <td className="py-3 pr-4">Totals</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.current)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.days_1_30)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.days_31_60)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.days_61_90)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.days_over_90)}</td>
                        <td className="py-3 text-right">{currency(data.totals.total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function VatReturn({ data }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Output VAT" value={currency(data.output_tax)} hint="Charged on sales" accent="brand" />
                <StatCard label="Input VAT" value={currency(data.input_tax)} hint="Recoverable on purchases" accent="sky" />
                <StatCard label={data.status === 'refundable' ? 'Refundable' : 'Net payable'} value={currency(Math.abs(data.net_payable))} hint={`Return is ${data.status}`} accent={data.status === 'refundable' ? 'emerald' : 'amber'} />
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Period {formatDate(data.from)} – {formatDate(data.to)} · <Badge tone={data.status === 'refundable' ? 'emerald' : 'amber'}>{data.status}</Badge>
            </div>
        </div>
    );
}

function BudgetVsActual({ data }) {
    return (
        <div className="space-y-4">
            {data.budget && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-slate-900">{data.budget.name}</span>
                    <Badge tone="slate">FY {data.budget.fiscal_year}</Badge>
                    <Badge tone="emerald">{data.budget.status}</Badge>
                </div>
            )}
            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4 text-right">Budget</th>
                        <th className="py-2 pr-4 text-right">Actual</th>
                        <th className="py-2 pr-4 text-right">Variance</th>
                        <th className="py-2 text-right">Variance %</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.rows.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No budget lines to compare.</td></tr>
                    ) : data.rows.map((row) => (
                        <tr key={row.account_id}>
                            <td className="py-2 pr-4 text-slate-800">{row.code} · {row.name}</td>
                            <td className="py-2 pr-4 capitalize text-slate-500">{row.type}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.budget)}</td>
                            <td className="py-2 pr-4 text-right text-slate-600">{currency(row.actual)}</td>
                            <td className={`py-2 pr-4 text-right font-medium ${row.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(row.variance)}</td>
                            <td className={`py-2 text-right ${row.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{percent(row.variance_percent)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                        <td className="py-3 pr-4" colSpan={2}>Totals</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.budget)}</td>
                        <td className="py-3 pr-4 text-right">{currency(data.totals.actual)}</td>
                        <td className={`py-3 pr-4 text-right ${data.totals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(data.totals.variance)}</td>
                        <td className="py-3 text-right">—</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function DimensionPnl({ data }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Revenue" value={currency(data.totals.revenue)} accent="emerald" />
                <StatCard label="Expenses" value={currency(data.totals.expenses)} accent="rose" />
                <StatCard label="Net income" value={currency(data.totals.net_income)} accent={data.totals.net_income >= 0 ? 'brand' : 'rose'} />
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
                <StatementSection title="Revenue" lines={data.revenue} total={data.totals.revenue} />
                <StatementSection title="Expenses" lines={data.expenses} total={data.totals.expenses} />
            </div>
        </div>
    );
}

function AuditHistory({ data }) {
    return (
        <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Summary</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2">User</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {data.logs.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">No audit events recorded.</td></tr>
                ) : data.logs.map((log) => (
                    <tr key={log.id}>
                        <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDateTime(log.created_at)}</td>
                        <td className="py-2 pr-4"><Badge tone="sky">{log.action}</Badge></td>
                        <td className="py-2 pr-4 text-slate-700">{log.description ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-500">{log.subject ?? '—'}</td>
                        <td className="py-2 text-slate-600">{log.user ?? 'System'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StatementSection({ title, lines, total }) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
                <span className="text-sm font-semibold text-slate-900">{currency(total)}</span>
            </div>
            {lines.length === 0 ? (
                <p className="py-3 text-sm text-slate-400">No balances.</p>
            ) : (
                <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                        {lines.map((line) => (
                            <tr key={`${title}-${line.code}`}>
                                <td className="py-2 pr-4 font-mono text-xs text-slate-400">{line.code}</td>
                                <td className="py-2 pr-4 text-slate-700">{line.name}</td>
                                <td className="py-2 text-right font-medium text-slate-900">{currency(line.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
