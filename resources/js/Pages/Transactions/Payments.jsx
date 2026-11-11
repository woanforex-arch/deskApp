import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    BanknotesIcon,
    BuildingOffice2Icon,
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    CreditCardIcon,
    DocumentTextIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    ReceiptPercentIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import { Select, TextInput, Textarea, DateInput, inputClasses } from '../../Components/FormControls';
import { currency, formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const NEW_VENDOR = '__new';

const toIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const currentMonthRange = () => {
    const now = new Date();

    return {
        from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
};

const TERMS = [
    { label: 'Due on receipt', days: 0 },
    { label: 'COD', days: 0 },
    { label: 'Net 7', days: 7 },
    { label: 'Net 15', days: 15 },
    { label: 'Net 30', days: 30 },
    { label: 'Net 60', days: 60 },
];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const toNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
};

function addDays(date, days) {
    if (!date) {
        return date;
    }

    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);

    return next.toISOString().slice(0, 10);
}

function blankLine() {
    return { description: '', quantity: 1, unit_price: '', tax_rate: 0, account_id: '' };
}

export default function PaymentsIndex({
    payments,
    filters,
    stats,
    vendors = [],
    bills = [],
    bankAccounts = [],
    methods = [],
    currencies = [],
    accounts = [],
    nextBillNumber = '',
    canApprove = true,
}) {
    const page = usePage();
    const money = page.props.money ?? {};
    const baseCurrency = money.base ?? 'USD';
    const currencyOptions = currencies.length > 0 ? currencies : [baseCurrency];

    const [composerOpen, setComposerOpen] = useState(false);
    const [composerMode, setComposerMode] = useState('new');
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const defaultCurrency = currencyOptions.includes(baseCurrency) ? baseCurrency : currencyOptions[0];
    const defaultMethod = methods.find((method) => method.value === 'bank_transfer')?.value ?? methods[0]?.value ?? 'bank_transfer';

    const freshExpense = () => ({
        contact_id: '',
        vendor_name: '',
        vendor_email: '',
        vendor_phone: '',
        number: nextBillNumber ?? '',
        bill_date: today(),
        due_date: addDays(today(), 30),
        status: 'approved',
        currency: defaultCurrency,
        terms: 'Net 30',
        notes: '',
        items: [blankLine()],
        payment: {
            amount: '',
            paid_on: today(),
            method: defaultMethod,
            reference: '',
            notes: '',
            bank_account_id: '',
        },
    });

    const form = useForm(freshExpense());
    const isNewVendor = form.data.contact_id === NEW_VENDOR;

    const paymentForm = useForm({
        bill_id: '',
        contact_id: '',
        paid_on: today(),
        amount: '',
        method: methods[0]?.value ?? 'bank_transfer',
        reference: '',
        notes: '',
        bank_account_id: '',
        currency: defaultCurrency,
    });

    useEffect(() => {
        if (!composerOpen) {
            return undefined;
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setComposerOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = '';
        };
    }, [composerOpen]);

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

    const applyMonth = () => {
        const range = currentMonthRange();
        const isActive = from === range.from && to === range.to;
        const next = isActive ? { from: '', to: '' } : range;

        setFrom(next.from);
        setTo(next.to);
        router.get(
            '/transactions/payments',
            {
                ...(search ? { search } : {}),
                ...(next.from ? { from: next.from } : {}),
                ...(next.to ? { to: next.to } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const monthRange = currentMonthRange();
    const monthActive = from === monthRange.from && to === monthRange.to;
    const hasFilters = Boolean(filters.search || filters.from || filters.to);

    const openComposer = () => {
        form.clearErrors();
        form.setData(freshExpense());
        paymentForm.clearErrors();
        setComposerMode('new');
        setComposerOpen(true);
    };

    const openSettlement = () => {
        form.clearErrors();
        paymentForm.clearErrors();
        setComposerMode('settle');
        setComposerOpen(true);
    };

    const switchComposerMode = (mode) => {
        form.clearErrors();
        paymentForm.clearErrors();
        setComposerMode(mode);
    };

    const applyTerms = (label) => {
        const term = TERMS.find((item) => item.label === label);

        form.setData('terms', label);

        if (term) {
            form.setData('due_date', addDays(form.data.bill_date, term.days));
        }
    };

    const changeBillDate = (value) => {
        form.setData('bill_date', value);

        const term = TERMS.find((item) => item.label === form.data.terms);

        if (term) {
            form.setData('due_date', addDays(value, term.days));
        }
    };

    const setLine = (index, key, value) => {
        const items = form.data.items.map((line, i) => (i === index ? { ...line, [key]: value } : line));
        form.setData('items', items);
    };

    const addLine = () => form.setData('items', [...form.data.items, blankLine()]);
    const removeLine = (index) => {
        if (form.data.items.length === 1) {
            form.setData('items', [blankLine()]);
            return;
        }

        form.setData('items', form.data.items.filter((_, i) => i !== index));
    };

    const lineAmount = (line) => round2(toNumber(line.quantity) * toNumber(line.unit_price));
    const lineTax = (line) => round2(lineAmount(line) * (toNumber(line.tax_rate) / 100));

    const subtotal = round2(form.data.items.reduce((sum, line) => sum + lineAmount(line), 0));
    const taxTotal = round2(form.data.items.reduce((sum, line) => sum + lineTax(line), 0));
    const total = round2(subtotal + taxTotal);
    const paidToday = canApprove ? round2(toNumber(form.data.payment.amount)) : 0;
    const balanceDue = round2(total - paidToday);

    const payInFull = () => {
        form.setData('payment.amount', String(Math.max(total, 0)));
    };

    const submitExpense = (status) => (event) => {
        event?.preventDefault();

        form.transform((data) => ({
            ...data,
            status,
            contact_id: data.contact_id === NEW_VENDOR ? null : data.contact_id || null,
            number: data.number || null,
            payment: {
                ...data.payment,
                amount: status === 'draft' || !canApprove ? 0 : toNumber(data.payment.amount),
                bank_account_id: data.payment.bank_account_id || null,
            },
            items: data.items.filter((line) => String(line.description).trim() !== ''),
        }));

        form.post('/transactions/payments', {
            preserveScroll: true,
            onSuccess: () => {
                setComposerOpen(false);
                form.reset();
            },
        });
    };

    const selectedBill = bills.find((bill) => String(bill.id) === String(paymentForm.data.bill_id));

    const selectBill = (value) => {
        paymentForm.setData('bill_id', value);
        const bill = bills.find((item) => String(item.id) === String(value));

        if (bill) {
            paymentForm.setData('contact_id', bill.contact_id);
            paymentForm.setData('amount', String(Math.max(bill.balance_due, 0)));
            paymentForm.setData('currency', bill.currency);
        }
    };

    const payBillInFull = () => {
        if (!selectedBill) {
            return;
        }

        paymentForm.setData('amount', String(Math.max(selectedBill.balance_due, 0)));
    };

    const submitPayment = (event) => {
        event.preventDefault();

        if (!paymentForm.data.bill_id) {
            return;
        }

        paymentForm.post('/vendor-payments', {
            preserveScroll: true,
            onSuccess: () => {
                setComposerOpen(false);
                setComposerMode('new');
                paymentForm.reset();
            },
        });
    };

    const paymentError = form.errors['payment.amount'] || form.errors.payment;

    return (
        <AppLayout>
            <Head title="Payments & expenses" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Transactions"
                    title="Payments & expenses"
                    description="Create a vendor expense with line items and post the payment in one clean flow."
                >
                    <button
                        type="button"
                        onClick={openSettlement}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
                    >
                        <BanknotesIcon className="h-4 w-4" />
                        Apply to bill
                    </button>
                    <button
                        type="button"
                        onClick={openComposer}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New expense
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total paid"
                        value={currency(stats.total)}
                        hint="All recorded outgoing payments"
                        icon={BanknotesIcon}
                        accent="brand"
                        onClick={resetFilters}
                        active={!hasFilters}
                        activeLabel="Show all payments"
                    />
                    <StatCard
                        label="This month"
                        value={currency(stats.month)}
                        hint="Payments in the current month"
                        icon={CalendarDaysIcon}
                        accent="sky"
                        onClick={applyMonth}
                        active={monthActive}
                        activeLabel="Show payments from this month"
                    />
                    <StatCard label="Payments" value={stats.count} hint="Payment records" icon={ReceiptPercentIcon} accent="violet" />
                    <StatCard
                        label="Open bills"
                        value={currency(stats.outstanding_bills)}
                        hint="Still to be settled"
                        icon={ReceiptPercentIcon}
                        accent="rose"
                        onClick={() => router.visit('/bills')}
                        activeLabel="View bills"
                    />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-brand-50/60 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="shrink-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-display text-base font-semibold text-slate-900">Payments</h2>
                                    <span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-900/5">
                                        {payments.total}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">Supplier payments and expense disbursements.</p>
                            </div>

                            <form onSubmit={applyFilters} className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search reference, bill, or vendor…"
                                        className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-60"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                        >
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1 shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                                    <CalendarDaysIcon className="h-4 w-4 shrink-0 text-slate-400" />
                                    <input
                                        type="date"
                                        value={from}
                                        max={to || undefined}
                                        onChange={(event) => setFrom(event.target.value)}
                                        aria-label="From date"
                                        title="From date"
                                        className="w-[7.5rem] border-0 bg-transparent py-1 text-xs font-medium text-slate-700 outline-none"
                                    />
                                    <span className="text-[11px] font-medium text-slate-400">→</span>
                                    <input
                                        type="date"
                                        value={to}
                                        min={from || undefined}
                                        onChange={(event) => setTo(event.target.value)}
                                        aria-label="To date"
                                        title="To date"
                                        className="w-[7.5rem] border-0 bg-transparent py-1 text-xs font-medium text-slate-700 outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
                                >
                                    <FunnelIcon className="h-4 w-4" />
                                    Apply
                                </button>

                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                        Clear
                                    </button>
                                )}
                            </form>
                        </div>
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
                                        onClick={openComposer}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        New expense
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
                                            <th className="px-5 py-3">Payment</th>
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
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">
                                                    {payment.payment_number ?? `#${payment.id}`}
                                                </td>
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

            {composerOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
                    <div className="flex min-h-full items-start justify-center p-3 sm:p-6">
                        <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
                            <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-brand-800 px-5 py-5 text-white sm:px-7 sm:py-6">
                                <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                                <div className="relative flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
                                            {composerMode === 'settle' ? 'Purchases · apply payment' : 'Purchases · new expense'}
                                        </p>
                                        <h2 className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">
                                            {composerMode === 'settle' ? 'Settle an open bill' : 'Record an expense and settle the vendor'}
                                        </h2>
                                        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                                            {composerMode === 'settle'
                                                ? 'Settle an existing open bill. The payment is posted to cash and payables automatically.'
                                                : 'Capture the vendor bill, its line items, and any payment made today without leaving this page.'}
                                        </p>
                                        <div className="mt-4 inline-flex rounded-xl bg-white/10 p-1 ring-1 ring-inset ring-white/15">
                                            <button
                                                type="button"
                                                onClick={() => switchComposerMode('new')}
                                                aria-pressed={composerMode === 'new'}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                                    composerMode === 'new'
                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                New expense
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => switchComposerMode('settle')}
                                                aria-pressed={composerMode === 'settle'}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                                    composerMode === 'settle'
                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                Settle open bill
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setComposerOpen(false)}
                                        className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                        aria-label="Close expense form"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form
                                onSubmit={composerMode === 'settle' ? submitPayment : submitExpense('approved')}
                                className="flex min-h-0 flex-1 flex-col"
                            >
                                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                                    {composerMode === 'settle' ? (
                                        <div className="grid gap-5 lg:grid-cols-2">
                                            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <span className="rounded-xl bg-amber-50 p-2 text-amber-600">
                                                        <DocumentTextIcon className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <h3 className="font-display text-base font-semibold text-slate-900">Open bill</h3>
                                                        <p className="text-xs text-slate-500">Choose the bill this payment settles.</p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-4">
                                                    <Select
                                                        label="Open bill"
                                                        id="bill_id"
                                                        value={paymentForm.data.bill_id}
                                                        onChange={(event) => selectBill(event.target.value)}
                                                        error={paymentForm.errors.bill_id}
                                                    >
                                                        <option value="">Select an open bill</option>
                                                        {bills.map((bill) => (
                                                            <option key={bill.id} value={bill.id}>
                                                                {bill.number} · {bill.contact ?? 'Vendor'} · {currency(bill.balance_due, bill.currency)}
                                                            </option>
                                                        ))}
                                                    </Select>

                                                    {bills.length === 0 && (
                                                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                                            There are no open bills to pay. Create an expense or approve a bill first.
                                                        </p>
                                                    )}

                                                    {selectedBill && (
                                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                                        Bill {selectedBill.number}
                                                                    </p>
                                                                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                                                        {selectedBill.contact ?? 'Vendor'}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500">
                                                                        Issued {formatDate(selectedBill.bill_date)} · Due {formatDate(selectedBill.due_date)}
                                                                    </p>
                                                                </div>
                                                                <span
                                                                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                                                                        selectedBill.is_overdue
                                                                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                                                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                                                                    }`}
                                                                >
                                                                    {selectedBill.is_overdue ? 'Overdue' : selectedBill.status === 'partial' ? 'Part paid' : 'Open'}
                                                                </span>
                                                            </div>
                                                            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-xs">
                                                                <div>
                                                                    <dt className="text-slate-500">Bill total</dt>
                                                                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                                                                        {currency(selectedBill.total, selectedBill.currency)}
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-slate-500">Paid</dt>
                                                                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                                                                        {currency(selectedBill.amount_paid, selectedBill.currency)}
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-slate-500">Balance due</dt>
                                                                    <dd className="mt-0.5 font-semibold tabular-nums text-amber-700">
                                                                        {currency(selectedBill.balance_due, selectedBill.currency)}
                                                                    </dd>
                                                                </div>
                                                            </dl>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>

                                            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                                                        <CreditCardIcon className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <h3 className="font-display text-base font-semibold text-slate-900">Payment details</h3>
                                                        <p className="text-xs text-slate-500">How much was paid, and how it was sent.</p>
                                                    </div>
                                                </div>

                                                {!canApprove && (
                                                    <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                                        Your role can save expenses for approval. An approver must post the payment against this bill.
                                                    </p>
                                                )}

                                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                    <DateInput
                                                        label="Payment date"
                                                        id="paid_on"
                                                        value={paymentForm.data.paid_on}
                                                        onChange={(event) => paymentForm.setData('paid_on', event.target.value)}
                                                        error={paymentForm.errors.paid_on}
                                                        disabled={!canApprove}
                                                    />
                                                    <div>
                                                        <TextInput
                                                            label={selectedBill ? `Amount (${selectedBill.currency})` : 'Amount'}
                                                            id="amount"
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={paymentForm.data.amount}
                                                            onChange={(event) => paymentForm.setData('amount', event.target.value)}
                                                            error={paymentForm.errors.amount}
                                                            hint={selectedBill ? `Balance due ${currency(selectedBill.balance_due, selectedBill.currency)}` : undefined}
                                                            disabled={!canApprove}
                                                        />
                                                        {selectedBill && canApprove && (
                                                            <button
                                                                type="button"
                                                                onClick={payBillInFull}
                                                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                                            >
                                                                Settle full balance · {currency(selectedBill.balance_due, selectedBill.currency)}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <Select
                                                        label="Method"
                                                        id="method"
                                                        value={paymentForm.data.method}
                                                        onChange={(event) => paymentForm.setData('method', event.target.value)}
                                                        error={paymentForm.errors.method}
                                                        disabled={!canApprove}
                                                    >
                                                        {methods.map((method) => (
                                                            <option key={method.value} value={method.value}>
                                                                {method.label}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                    <Select
                                                        label="Bank account"
                                                        id="bank_account_id"
                                                        value={paymentForm.data.bank_account_id}
                                                        onChange={(event) => paymentForm.setData('bank_account_id', event.target.value)}
                                                        error={paymentForm.errors.bank_account_id}
                                                        disabled={!canApprove}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {bankAccounts.map((account) => (
                                                            <option key={account.id} value={account.id}>
                                                                {account.name} · {account.currency}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                    <TextInput
                                                        label="Reference"
                                                        id="reference"
                                                        value={paymentForm.data.reference}
                                                        onChange={(event) => paymentForm.setData('reference', event.target.value)}
                                                        error={paymentForm.errors.reference}
                                                        placeholder="Bank reference, cheque no., receipt no."
                                                        className="sm:col-span-2"
                                                        disabled={!canApprove}
                                                    />
                                                    <Textarea
                                                        label="Notes"
                                                        id="notes"
                                                        rows={3}
                                                        value={paymentForm.data.notes}
                                                        onChange={(event) => paymentForm.setData('notes', event.target.value)}
                                                        error={paymentForm.errors.notes}
                                                        placeholder="Anything the vendor should know about this payment."
                                                        className="sm:col-span-2"
                                                        disabled={!canApprove}
                                                    />
                                                </div>

                                                <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500 ring-1 ring-inset ring-slate-200">
                                                    Posting this payment debits accounts payable and credits cash. The bill balance updates automatically, and a VPAY number is generated automatically.
                                                </p>
                                            </section>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-5 lg:grid-cols-2">
                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-brand-50 p-2 text-brand-600">
                                                    <BuildingOffice2Icon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Vendor</h3>
                                                    <p className="text-xs text-slate-500">Who is being paid, and what was purchased?</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                <Select
                                                    label="Vendor"
                                                    id="contact_id"
                                                    value={form.data.contact_id}
                                                    onChange={(event) => form.setData('contact_id', event.target.value)}
                                                    error={form.errors.contact_id}
                                                >
                                                    <option value="">Select a vendor…</option>
                                                    {vendors.map((vendor) => (
                                                        <option key={vendor.id} value={vendor.id}>
                                                            {vendor.name}
                                                        </option>
                                                    ))}
                                                    <option value={NEW_VENDOR}>+ Add new vendor…</option>
                                                </Select>

                                                {isNewVendor && (
                                                    <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                                                        <p className="text-xs font-medium text-brand-800">
                                                            Create a vendor right here. It will be saved with this expense.
                                                        </p>
                                                        <TextInput
                                                            label="Vendor name"
                                                            id="vendor_name"
                                                            value={form.data.vendor_name}
                                                            onChange={(event) => form.setData('vendor_name', event.target.value)}
                                                            error={form.errors.vendor_name}
                                                            placeholder="e.g. Accra Office Supplies"
                                                            autoFocus
                                                        />
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <TextInput
                                                                label="Email"
                                                                id="vendor_email"
                                                                type="email"
                                                                value={form.data.vendor_email}
                                                                onChange={(event) => form.setData('vendor_email', event.target.value)}
                                                                error={form.errors.vendor_email}
                                                                placeholder="billing@vendor.com"
                                                            />
                                                            <TextInput
                                                                label="Phone"
                                                                id="vendor_phone"
                                                                value={form.data.vendor_phone}
                                                                onChange={(event) => form.setData('vendor_phone', event.target.value)}
                                                                error={form.errors.vendor_phone}
                                                                placeholder="+233…"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {vendors.length === 0 && !isNewVendor && (
                                                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                                        No vendors yet. Choose “Add new vendor…” to create one now.
                                                    </p>
                                                )}

                                                <Textarea
                                                    label="Journal memo"
                                                    id="notes"
                                                    rows={4}
                                                    value={form.data.notes}
                                                    onChange={(event) => form.setData('notes', event.target.value)}
                                                    error={form.errors.notes}
                                                    placeholder="Internal note or memo for this purchase."
                                                />
                                            </div>
                                        </section>

                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-sky-50 p-2 text-sky-600">
                                                    <DocumentTextIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Expense details</h3>
                                                    <p className="text-xs text-slate-500">Purchase number, dates, terms, and currency.</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <TextInput
                                                    label="Purchase #"
                                                    id="number"
                                                    value={form.data.number}
                                                    onChange={(event) => form.setData('number', event.target.value)}
                                                    error={form.errors.number}
                                                    hint="Auto-generated if left blank"
                                                />
                                                <Select
                                                    label="Currency"
                                                    id="currency"
                                                    value={form.data.currency}
                                                    onChange={(event) => form.setData('currency', event.target.value)}
                                                    error={form.errors.currency}
                                                >
                                                    {currencyOptions.map((code) => (
                                                        <option key={code} value={code}>
                                                            {code}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <DateInput
                                                    label="Purchase date"
                                                    id="bill_date"
                                                    value={form.data.bill_date}
                                                    onChange={(event) => changeBillDate(event.target.value)}
                                                    error={form.errors.bill_date}
                                                />
                                                <Select
                                                    label="Payment terms"
                                                    id="terms"
                                                    value={form.data.terms}
                                                    onChange={(event) => applyTerms(event.target.value)}
                                                    error={form.errors.terms}
                                                >
                                                    {TERMS.map((term) => (
                                                        <option key={term.label} value={term.label}>
                                                            {term.label}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <DateInput
                                                    label="Due date"
                                                    id="due_date"
                                                    value={form.data.due_date}
                                                    onChange={(event) => form.setData('due_date', event.target.value)}
                                                    error={form.errors.due_date}
                                                    className="sm:col-span-2"
                                                />
                                            </div>
                                        </section>
                                    </div>

                                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-violet-50 p-2 text-violet-600">
                                                    <ClipboardDocumentListIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Line items</h3>
                                                    <p className="text-xs text-slate-500">Describe each service or product purchased.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addLine}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                                Add line
                                            </button>
                                        </div>

                                        {form.errors.items && (
                                            <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-xs font-medium text-rose-700">
                                                {form.errors.items}
                                            </div>
                                        )}

                                        <div className="hidden px-7 pt-3 sm:block" aria-hidden="true">
                                            <div className="grid w-full gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid-cols-12">
                                                <span className="sm:col-span-3">Description</span>
                                                <span className="sm:col-span-3">Account</span>
                                                <span className="sm:col-span-1 text-left">Qty</span>
                                                <span className="sm:col-span-2 text-left">Rate</span>
                                                <span className="sm:col-span-1 text-left">Tax</span>
                                                <span className="text-right sm:col-span-2 sm:pr-8">Amount</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 p-4">
                                            {form.data.items.map((line, index) => (
                                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                                    <div className="sm:col-span-3">
                                                        <input
                                                            value={line.description}
                                                            onChange={(event) => setLine(index, 'description', event.target.value)}
                                                            placeholder="e.g. Office supplies"
                                                            className={inputClasses}
                                                            aria-label={`Line ${index + 1} description`}
                                                        />
                                                        {form.errors[`items.${index}.description`] && (
                                                            <p className="mt-1 text-xs font-medium text-rose-600">{form.errors[`items.${index}.description`]}</p>
                                                        )}
                                                    </div>
                                                    <select
                                                        value={line.account_id}
                                                        onChange={(event) => setLine(index, 'account_id', event.target.value)}
                                                        className={`${inputClasses} sm:col-span-3`}
                                                        aria-label={`Line ${index + 1} expense account`}
                                                    >
                                                        <option value="">Default expense account</option>
                                                        {accounts.map((account) => (
                                                            <option key={account.id} value={account.id}>
                                                                {account.code} · {account.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        onChange={(event) => setLine(index, 'quantity', event.target.value)}
                                                        placeholder="Qty"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-1`}
                                                        aria-label={`Line ${index + 1} quantity`}
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.unit_price}
                                                        onChange={(event) => setLine(index, 'unit_price', event.target.value)}
                                                        placeholder="Rate"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                                        aria-label={`Line ${index + 1} rate`}
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        value={line.tax_rate}
                                                        onChange={(event) => setLine(index, 'tax_rate', event.target.value)}
                                                        placeholder="Tax"
                                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-1`}
                                                        aria-label={`Line ${index + 1} tax rate`}
                                                    />
                                                    <div className="flex items-center justify-end gap-2 sm:col-span-2">
                                                        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-500">
                                                            {currency(lineAmount(line), form.data.currency)}
                                                        </span>
                                                        <span className="inline-flex w-6 flex-none justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLine(index)}
                                                                className="text-slate-400 hover:text-rose-600"
                                                                aria-label={`Remove line ${index + 1}`}
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                                            <button
                                                type="button"
                                                onClick={addLine}
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition hover:text-brand-700"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                                Add another line
                                            </button>
                                            <p className="text-xs text-slate-500">
                                                {form.data.items.length} {form.data.items.length === 1 ? 'line' : 'lines'} · {form.data.currency}
                                            </p>
                                        </div>
                                    </section>

                                    <div className="grid gap-5 lg:grid-cols-3">
                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                                                    <CreditCardIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Payment today</h3>
                                                    <p className="text-xs text-slate-500">
                                                        Leave the amount at zero to keep this expense open and pay it later.
                                                    </p>
                                                </div>
                                            </div>

                                            {!canApprove && (
                                                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                                    Your role can save expenses for approval. An approver must post the expense before a payment can be recorded.
                                                </p>
                                            )}

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <div>
                                                    <TextInput
                                                        label={`Amount paid today (${form.data.currency})`}
                                                        id="payment_amount"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={form.data.payment.amount}
                                                        onChange={(event) => form.setData('payment.amount', event.target.value)}
                                                        error={paymentError}
                                                        placeholder="0.00"
                                                        hint={canApprove ? 'The balance due updates automatically.' : 'Payments are recorded after approval.'}
                                                        disabled={!canApprove}
                                                    />
                                                    {canApprove && (
                                                        <button
                                                            type="button"
                                                            onClick={payInFull}
                                                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                                        >
                                                            Pay full balance · {currency(total, form.data.currency)}
                                                        </button>
                                                    )}
                                                </div>
                                                <DateInput
                                                    label="Payment date"
                                                    id="payment_paid_on"
                                                    value={form.data.payment.paid_on}
                                                    onChange={(event) => form.setData('payment.paid_on', event.target.value)}
                                                    error={form.errors['payment.paid_on']}
                                                    disabled={!canApprove}
                                                />
                                                <Select
                                                    label="Payment method"
                                                    id="payment_method"
                                                    value={form.data.payment.method}
                                                    onChange={(event) => form.setData('payment.method', event.target.value)}
                                                    error={form.errors['payment.method']}
                                                    disabled={!canApprove}
                                                >
                                                    {methods.map((method) => (
                                                        <option key={method.value} value={method.value}>
                                                            {method.label}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <Select
                                                    label="Bank account"
                                                    id="payment_bank_account_id"
                                                    value={form.data.payment.bank_account_id}
                                                    onChange={(event) => form.setData('payment.bank_account_id', event.target.value)}
                                                    error={form.errors['payment.bank_account_id']}
                                                    disabled={!canApprove}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {bankAccounts.map((account) => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.name} · {account.currency}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <TextInput
                                                    label="Payment reference"
                                                    id="payment_reference"
                                                    value={form.data.payment.reference}
                                                    onChange={(event) => form.setData('payment.reference', event.target.value)}
                                                    error={form.errors['payment.reference']}
                                                    placeholder="Bank reference, cheque no., receipt no."
                                                    className="sm:col-span-2"
                                                    disabled={!canApprove}
                                                />
                                            </div>

                                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                                <Textarea
                                                    label="Payment notes"
                                                    id="payment_notes"
                                                    rows={3}
                                                    value={form.data.payment.notes}
                                                    onChange={(event) => form.setData('payment.notes', event.target.value)}
                                                    error={form.errors['payment.notes']}
                                                    placeholder="Anything the vendor should know about this payment."
                                                    disabled={!canApprove}
                                                    className="sm:col-span-2"
                                                />
                                            </div>
                                        </section>

                                        <section className="flex flex-col overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/10">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-white/10 p-2 text-brand-200">
                                                    <ReceiptPercentIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold">Summary</h3>
                                                    <p className="text-xs text-slate-400">Live totals for this expense.</p>
                                                </div>
                                            </div>

                                            <dl className="mt-5 space-y-2.5 text-sm">
                                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                                    <dt>Subtotal</dt>
                                                    <dd className="tabular-nums">{currency(subtotal, form.data.currency)}</dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-slate-300">
                                                    <dt>Tax</dt>
                                                    <dd className="tabular-nums">{currency(taxTotal, form.data.currency)}</dd>
                                                </div>
                                                <div className="my-3 border-t border-white/10" />
                                                <div className="flex items-end justify-between gap-4">
                                                    <dt className="text-sm font-semibold text-slate-200">Total amount</dt>
                                                    <dd className="font-display text-2xl font-semibold tabular-nums">{currency(total, form.data.currency)}</dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-slate-400">
                                                    <dt>Paid today</dt>
                                                    <dd className="tabular-nums">{currency(paidToday, form.data.currency)}</dd>
                                                </div>
                                            </dl>

                                            <div className={`mt-4 rounded-xl px-4 py-3 ring-1 ring-inset ${balanceDue <= 0 ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/30' : 'bg-amber-400/10 text-amber-200 ring-amber-400/30'}`}>
                                                <p className="text-[11px] font-semibold uppercase tracking-wider">Balance due</p>
                                                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
                                                    {currency(Math.max(balanceDue, 0), form.data.currency)}
                                                </p>
                                            </div>

                                            <p className="mt-4 text-xs leading-relaxed text-slate-400">
                                                Recording this expense posts the bill to payables and, when an amount is entered, posts the payment to cash.
                                            </p>
                                        </section>
                                    </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        {composerMode === 'settle' ? (
                                            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                                                <DocumentTextIcon className="h-4 w-4" />
                                                {selectedBill ? `Settling ${selectedBill.number}` : 'Select an open bill'}
                                            </span>
                                        ) : (
                                            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                                                <BuildingOffice2Icon className="h-4 w-4" />
                                                {form.data.terms}
                                                <span className="text-slate-300">•</span>
                                                {form.data.currency}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setComposerOpen(false)}
                                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                                        >
                                            Cancel
                                        </button>
                                        {composerMode === 'settle' ? (
                                            <button
                                                type="submit"
                                                disabled={!canApprove || paymentForm.processing || !paymentForm.data.bill_id}
                                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                            >
                                                <BanknotesIcon className="h-4 w-4" />
                                                {paymentForm.processing ? 'Posting…' : canApprove ? 'Post payment' : 'Approver required'}
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={form.processing}
                                                    onClick={submitExpense('draft')}
                                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                                                >
                                                    Save draft
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={form.processing}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                                                >
                                                    <BanknotesIcon className="h-4 w-4" />
                                                    {form.processing ? 'Recording…' : canApprove ? 'Record expense' : 'Submit for approval'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

        </AppLayout>
    );
}
