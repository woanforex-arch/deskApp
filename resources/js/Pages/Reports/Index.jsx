import { Head, Link } from '@inertiajs/react';
import {
    ArrowTrendingUpIcon,
    BanknotesIcon,
    ChartBarSquareIcon,
    ChartPieIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    DocumentChartBarIcon,
    ScaleIcon,
    ShieldCheckIcon,
    Squares2X2Icon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';

const icons = {
    'trial-balance': ScaleIcon,
    'balance-sheet': ChartBarSquareIcon,
    'profit-loss': ArrowTrendingUpIcon,
    'cash-flow': BanknotesIcon,
    'general-ledger': ClipboardDocumentListIcon,
    sales: BanknotesIcon,
    expenses: DocumentChartBarIcon,
    'customer-statement': ClipboardDocumentListIcon,
    'aging-receivable': ClockIcon,
    'aging-payable': ClockIcon,
    'bank-reconciliation': BanknotesIcon,
    'fixed-asset-register': ChartBarSquareIcon,
    vat: DocumentChartBarIcon,
    'budget-vs-actual': ChartPieIcon,
    department: Squares2X2Icon,
    project: Squares2X2Icon,
    branch: Squares2X2Icon,
    'cost-center': Squares2X2Icon,
    audit: ShieldCheckIcon,
};

export default function ReportsIndex({ reports }) {
    const groups = reports.reduce((acc, report) => {
        acc[report.group] = acc[report.group] ?? [];
        acc[report.group].push(report);
        return acc;
    }, {});

    return (
        <AppLayout>
            <Head title="Reports" />

            <div className="space-y-8">
                <PageHeader eyebrow="Reports" title="Financial reporting" description="Run financial statements, ledger drill-downs, ageing, tax, budget and dimensional reports." />

                {Object.entries(groups).map(([group, items]) => (
                    <section key={group} className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</h2>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((report) => {
                                const Icon = icons[report.key] ?? DocumentChartBarIcon;
                                return (
                                    <Link
                                        key={report.key}
                                        href={`/reports/${report.key}`}
                                        className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                                    >
                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-display text-base font-semibold text-slate-900 group-hover:text-brand-700">{report.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">{report.description}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </AppLayout>
    );
}
