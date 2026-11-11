import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    BanknotesIcon,
    CalendarDaysIcon,
    ChevronDownIcon,
    ClipboardDocumentListIcon,
    CreditCardIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    PrinterIcon,
    ReceiptPercentIcon,
    TrashIcon,
    TruckIcon,
    UserCircleIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea, DateInput, inputClasses } from '../../Components/FormControls';
import { currency, formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const NEW_CUSTOMER = '__new';

const TERMS = [
    { label: 'Due on receipt', days: 0 },
    { label: 'COD', days: 0 },
    { label: 'Net 7', days: 7 },
    { label: 'Net 15', days: 15 },
    { label: 'Net 30', days: 30 },
    { label: 'Net 60', days: 60 },
];

const DELIVERY_STATUSES = ['Pending', 'Ready', 'In transit', 'Delivered', 'Not applicable'];

const SALES_TYPES = ['Service', 'Product', 'Retail', 'Wholesale', 'Online', 'Contract', 'Other'];

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

export default function ReceiptsIndex({
    receipts,
    filters,
    stats,
    invoices = [],
    methods = [],
    customers = [],
    accounts = [],
    currencies = [],
    nextNumber = '',
}) {
    const page = usePage();
    const money = page.props.money ?? {};
    const baseCurrency = money.base ?? 'USD';
    const currencyOptions = currencies.length > 0 ? currencies : [baseCurrency];

    const [open, setOpen] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [search, setSearch] = useState(filters.search ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const defaultCurrency = currencyOptions.includes(baseCurrency) ? baseCurrency : currencyOptions[0];
    const defaultMethod = methods.find((method) => method.value === 'cash')?.value ?? methods[0]?.value ?? 'cash';

    const freshReceipt = () => ({
        contact_id: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        number: nextNumber ?? '',
        issue_date: today(),
        due_date: today(),
        status: 'sent',
        currency: defaultCurrency,
        terms: 'Due on receipt',
        ship_to: '',
        salesperson: '',
        ship_via: '',
        promised_date: '',
        delivery_status: 'Pending',
        sales_type: 'Service',
        notes: '',
        items: [blankLine()],
        payment: {
            amount: '',
            paid_on: today(),
            method: defaultMethod,
            reference: '',
            notes: '',
        },
    });

    const form = useForm(freshReceipt());

    const paymentForm = useForm({
        invoice_id: '',
        paid_on: today(),
        amount: '',
        method: methods[0]?.value ?? 'bank_transfer',
        reference: '',
        notes: '',
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
            '/transactions/receipts',
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
        router.get('/transactions/receipts', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const openComposer = () => {
        form.clearErrors();
        form.setData(freshReceipt());
        setComposerOpen(true);
    };

    const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.data.contact_id));
    const customerAddress = selectedCustomer
        ? [selectedCustomer.address, selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ')
        : '';

    const selectCustomer = (value) => {
        form.setData('contact_id', value);

        const customer = customers.find((item) => String(item.id) === String(value));

        if (customer) {
            const address = [customer.address, customer.city, customer.country].filter(Boolean).join(', ');

            if (address && !form.data.ship_to) {
                form.setData('ship_to', address);
            }
        }
    };

    const applyTerms = (label) => {
        const term = TERMS.find((item) => item.label === label);

        form.setData('terms', label);

        if (term) {
            form.setData('due_date', addDays(form.data.issue_date, term.days));
        }
    };

    const changeIssueDate = (value) => {
        form.setData('issue_date', value);

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
    const paidToday = round2(toNumber(form.data.payment.amount));
    const balanceDue = round2(total - paidToday);

    const payInFull = () => {
        form.setData('payment.amount', String(Math.max(total, 0)));
    };

    const submitReceipt = (status) => (event) => {
        event?.preventDefault();

        form.transform((data) => ({
            ...data,
            status,
            contact_id: data.contact_id === NEW_CUSTOMER ? null : data.contact_id,
            number: data.number || null,
            payment: {
                ...data.payment,
                amount: toNumber(data.payment.amount),
            },
            items: data.items.filter((line) => String(line.description).trim() !== ''),
        }));

        form.post('/transactions/receipts', {
            preserveScroll: true,
            onSuccess: () => {
                setComposerOpen(false);
                form.reset();
            },
        });
    };

    const selectInvoice = (value) => {
        paymentForm.setData('invoice_id', value);
        const invoice = invoices.find((item) => String(item.id) === String(value));

        if (invoice) {
            paymentForm.setData('amount', String(Math.max(invoice.balance_due, 0)));
        }
    };

    const submitPayment = (event) => {
        event.preventDefault();

        if (!paymentForm.data.invoice_id) {
            return;
        }

        paymentForm.post(`/invoices/${paymentForm.data.invoice_id}/payments`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                paymentForm.reset('invoice_id', 'amount', 'reference', 'notes');
            },
        });
    };

    const hasFilters = Boolean(filters.search || filters.from || filters.to);
    const selectedInvoice = invoices.find((item) => String(item.id) === String(paymentForm.data.invoice_id));
    const customerError = form.errors.contact_id || form.errors.customer_name;
    const paymentError = form.errors['payment.amount'] || form.errors.payment;

    return (
        <AppLayout>
            <Head title="Receipts & sales" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Transactions"
                    title="Receipts & sales"
                    description="Record a sale, create the invoice, and post the customer payment in one clean flow."
                >
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
                    >
                        <BanknotesIcon className="h-4 w-4" />
                        Apply to invoice
                    </button>
                    <button
                        type="button"
                        onClick={openComposer}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New sales receipt
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total received" value={currency(stats.total)} hint="All recorded customer receipts" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="This month" value={currency(stats.month)} hint="Receipts in the current month" icon={CalendarDaysIcon} accent="sky" />
                    <StatCard label="Receipts" value={stats.count} hint="Receipt records" icon={ReceiptPercentIcon} accent="violet" />
                    <StatCard label="Outstanding invoices" value={currency(stats.outstanding_invoices)} hint="Still to be collected" icon={ReceiptPercentIcon} accent="rose" />
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
                                    placeholder="Search receipt, invoice, or customer…"
                                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <DateInput value={from} onChange={(event) => setFrom(event.target.value)} className="w-full sm:w-44" aria-label="From date" />
                                <DateInput value={to} onChange={(event) => setTo(event.target.value)} className="w-full sm:w-44" aria-label="To date" />
                                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                                    Filter
                                </button>
                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {receipts.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No receipts match your filters' : 'No receipts yet'}
                            description={
                                hasFilters
                                    ? 'Try a different date range or search term.'
                                    : 'Create your first sales receipt to start tracking money received.'
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
                                        New sales receipt
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
                                            <th className="px-5 py-3">Receipt</th>
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Customer</th>
                                            <th className="px-5 py-3">Invoice</th>
                                            <th className="px-5 py-3">Reference</th>
                                            <th className="px-5 py-3">Method</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                            <th className="px-5 py-3 text-right">
                                                <span aria-hidden="true">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {receipts.data.map((receipt) => (
                                            <tr key={receipt.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">
                                                    {receipt.receipt_number ?? `#${receipt.id}`}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(receipt.paid_on)}</td>
                                                <td className="max-w-[14rem] truncate px-5 py-3.5 font-medium text-slate-900">{receipt.contact ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    {receipt.invoice_id ? (
                                                        <Link href={`/invoices/${receipt.invoice_id}`} className="font-medium text-brand-600 hover:text-brand-700">
                                                            {receipt.invoice_number ?? `#${receipt.invoice_id}`}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{receipt.reference ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 capitalize text-slate-500">{receipt.method_label}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(receipt.amount, receipt.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <Link
                                                        href={`/transactions/receipts/${receipt.id}/print`}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-brand-700"
                                                        title={`Print receipt ${receipt.receipt_number ?? receipt.id}`}
                                                    >
                                                        <PrinterIcon className="h-4 w-4" />
                                                        <span>Print</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination paginator={receipts} />
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
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">Sales receipt</p>
                                        <h2 className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">Record a sale and get paid</h2>
                                        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                                            Create the invoice, post the revenue, and bank the customer payment without leaving this page.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setComposerOpen(false)}
                                        className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                        aria-label="Close sales receipt form"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={submitReceipt('sent')} className="flex min-h-0 flex-1 flex-col">
                                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-brand-50 p-2 text-brand-600">
                                                    <UserCircleIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Customer</h3>
                                                    <p className="text-xs text-slate-500">Who is buying, and where should this delivery go?</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                <Select
                                                    label="Customer"
                                                    id="contact_id"
                                                    value={form.data.contact_id}
                                                    onChange={(event) => selectCustomer(event.target.value)}
                                                    error={customerError}
                                                >
                                                    <option value="">Select a customer…</option>
                                                    {customers.map((customer) => (
                                                        <option key={customer.id} value={customer.id}>
                                                            {customer.name}
                                                        </option>
                                                    ))}
                                                    <option value={NEW_CUSTOMER}>＋ New customer</option>
                                                </Select>

                                                {form.data.contact_id === NEW_CUSTOMER && (
                                                    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 sm:grid-cols-2">
                                                        <TextInput
                                                            label="Customer name"
                                                            id="customer_name"
                                                            value={form.data.customer_name}
                                                            onChange={(event) => form.setData('customer_name', event.target.value)}
                                                            error={form.errors.customer_name}
                                                            placeholder="e.g. Paul Mensah"
                                                            className="sm:col-span-2"
                                                        />
                                                        <TextInput
                                                            label="Email"
                                                            id="customer_email"
                                                            type="email"
                                                            value={form.data.customer_email}
                                                            onChange={(event) => form.setData('customer_email', event.target.value)}
                                                            error={form.errors.customer_email}
                                                            placeholder="name@example.com"
                                                        />
                                                        <TextInput
                                                            label="Phone"
                                                            id="customer_phone"
                                                            value={form.data.customer_phone}
                                                            onChange={(event) => form.setData('customer_phone', event.target.value)}
                                                            error={form.errors.customer_phone}
                                                            placeholder="+233 20 000 0000"
                                                        />
                                                    </div>
                                                )}

                                                {selectedCustomer && (
                                                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                                                        <p className="font-semibold text-slate-800">{selectedCustomer.name}</p>
                                                        <p className="mt-0.5">{customerAddress || 'No address on file'}</p>
                                                        {(selectedCustomer.email || selectedCustomer.phone) && (
                                                            <p className="mt-1 text-slate-500">
                                                                {[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                <div>
                                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                                        <label htmlFor="ship_to" className="text-sm font-medium text-slate-700">
                                                            Ship to
                                                        </label>
                                                        {customerAddress && form.data.ship_to !== customerAddress && (
                                                            <button
                                                                type="button"
                                                                onClick={() => form.setData('ship_to', customerAddress)}
                                                                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                                                            >
                                                                Use customer address
                                                            </button>
                                                        )}
                                                    </div>
                                                    <textarea
                                                        id="ship_to"
                                                        rows={2}
                                                        value={form.data.ship_to}
                                                        onChange={(event) => form.setData('ship_to', event.target.value)}
                                                        placeholder="Delivery address for this sale"
                                                        className={`${inputClasses} min-h-0 resize-y`}
                                                    />
                                                    {form.errors.ship_to && <p className="mt-1.5 text-xs font-medium text-rose-600">{form.errors.ship_to}</p>}
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="rounded-xl bg-sky-50 p-2 text-sky-600">
                                                    <DocumentTextIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h3 className="font-display text-base font-semibold text-slate-900">Receipt details</h3>
                                                    <p className="text-xs text-slate-500">Number, dates, terms, and delivery tracking.</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <TextInput
                                                    label="Invoice #"
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
                                                    label="Sale date"
                                                    id="issue_date"
                                                    value={form.data.issue_date}
                                                    onChange={(event) => changeIssueDate(event.target.value)}
                                                    error={form.errors.issue_date}
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
                                                />
                                                <TextInput
                                                    label="Salesperson"
                                                    id="salesperson"
                                                    value={form.data.salesperson}
                                                    onChange={(event) => form.setData('salesperson', event.target.value)}
                                                    error={form.errors.salesperson}
                                                    placeholder="Who made the sale?"
                                                />
                                                <Select
                                                    label="Sales type"
                                                    id="sales_type"
                                                    value={form.data.sales_type}
                                                    onChange={(event) => form.setData('sales_type', event.target.value)}
                                                    error={form.errors.sales_type}
                                                >
                                                    {SALES_TYPES.map((type) => (
                                                        <option key={type} value={type}>
                                                            {type}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <TextInput
                                                    label="Ship via"
                                                    id="ship_via"
                                                    value={form.data.ship_via}
                                                    onChange={(event) => form.setData('ship_via', event.target.value)}
                                                    error={form.errors.ship_via}
                                                    placeholder="Courier, pickup, delivery…"
                                                />
                                                <DateInput
                                                    label="Promised date"
                                                    id="promised_date"
                                                    value={form.data.promised_date}
                                                    onChange={(event) => form.setData('promised_date', event.target.value)}
                                                    error={form.errors.promised_date}
                                                />
                                                <Select
                                                    label="Delivery status"
                                                    id="delivery_status"
                                                    value={form.data.delivery_status}
                                                    onChange={(event) => form.setData('delivery_status', event.target.value)}
                                                    error={form.errors.delivery_status}
                                                >
                                                    {DELIVERY_STATUSES.map((status) => (
                                                        <option key={status} value={status}>
                                                            {status}
                                                        </option>
                                                    ))}
                                                </Select>
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
                                                    <p className="text-xs text-slate-500">Describe each service or product sold.</p>
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

                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[880px] text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                        <th className="px-5 py-3">Description</th>
                                                        <th className="w-24 px-3 py-3 text-right">Qty</th>
                                                        <th className="w-32 px-3 py-3 text-right">Rate</th>
                                                        <th className="w-24 px-3 py-3 text-right">Tax %</th>
                                                        <th className="w-32 px-5 py-3 text-right">Amount</th>
                                                        <th className="w-12 px-3 py-3" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {form.data.items.map((line, index) => (
                                                        <tr key={index} className="align-top">
                                                            <td className="px-5 py-3">
                                                                <input
                                                                    value={line.description}
                                                                    onChange={(event) => setLine(index, 'description', event.target.value)}
                                                                    placeholder="e.g. Deluxe room — 2 nights"
                                                                    className={`${inputClasses} py-2`}
                                                                    aria-label={`Line ${index + 1} description`}
                                                                />
                                                                {form.errors[`items.${index}.description`] && (
                                                                    <p className="mt-1 text-xs font-medium text-rose-600">{form.errors[`items.${index}.description`]}</p>
                                                                )}
                                                                <div className="relative mt-1.5">
                                                                    <select
                                                                        value={line.account_id}
                                                                        onChange={(event) => setLine(index, 'account_id', event.target.value)}
                                                                        className="block w-full appearance-none rounded-md border border-slate-200 bg-slate-50/80 py-1.5 pl-2.5 pr-8 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15"
                                                                        aria-label={`Line ${index + 1} revenue account`}
                                                                    >
                                                                        <option value="">Default revenue account</option>
                                                                        {accounts.map((account) => (
                                                                            <option key={account.id} value={account.id}>
                                                                                {account.code} · {account.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={line.quantity}
                                                                    onChange={(event) => setLine(index, 'quantity', event.target.value)}
                                                                    className={`${inputClasses} py-2 text-right tabular-nums`}
                                                                    aria-label={`Line ${index + 1} quantity`}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={line.unit_price}
                                                                    onChange={(event) => setLine(index, 'unit_price', event.target.value)}
                                                                    placeholder="0.00"
                                                                    className={`${inputClasses} py-2 text-right tabular-nums`}
                                                                    aria-label={`Line ${index + 1} rate`}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    step="0.01"
                                                                    value={line.tax_rate}
                                                                    onChange={(event) => setLine(index, 'tax_rate', event.target.value)}
                                                                    className={`${inputClasses} py-2 text-right tabular-nums`}
                                                                    aria-label={`Line ${index + 1} tax rate`}
                                                                />
                                                            </td>
                                                            <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                                                                {currency(lineAmount(line), form.data.currency)}
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeLine(index)}
                                                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                    aria-label={`Remove line ${index + 1}`}
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
                                                    <p className="text-xs text-slate-500">Leave the amount at zero to keep this as an open invoice.</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                <div className="sm:col-span-2">
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
                                                        hint="The balance due updates automatically."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={payInFull}
                                                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                                    >
                                                        Pay full balance · {currency(total, form.data.currency)}
                                                    </button>
                                                </div>
                                                <DateInput
                                                    label="Payment date"
                                                    id="payment_paid_on"
                                                    value={form.data.payment.paid_on}
                                                    onChange={(event) => form.setData('payment.paid_on', event.target.value)}
                                                    error={form.errors['payment.paid_on']}
                                                />
                                                <Select
                                                    label="Payment method"
                                                    id="payment_method"
                                                    value={form.data.payment.method}
                                                    onChange={(event) => form.setData('payment.method', event.target.value)}
                                                    error={form.errors['payment.method']}
                                                >
                                                    {methods.map((method) => (
                                                        <option key={method.value} value={method.value}>
                                                            {method.label}
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
                                                    placeholder="Anything the customer should know about this payment."
                                                />
                                                <Textarea
                                                    label="Invoice notes"
                                                    id="notes"
                                                    rows={3}
                                                    value={form.data.notes}
                                                    onChange={(event) => form.setData('notes', event.target.value)}
                                                    error={form.errors.notes}
                                                    placeholder="Internal note or message printed on the invoice."
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
                                                    <p className="text-xs text-slate-400">Live totals for this receipt.</p>
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
                                                    <dt className="text-sm font-semibold text-slate-200">Total</dt>
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
                                                Recording this receipt posts the invoice to receivables and, when an amount is entered, posts the payment to cash.
                                            </p>
                                        </section>
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                                            <TruckIcon className="h-4 w-4" />
                                            {form.data.delivery_status}
                                            <span className="text-slate-300">•</span>
                                            {form.data.sales_type}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setComposerOpen(false)}
                                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={form.processing}
                                            onClick={submitReceipt('draft')}
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
                                            {form.processing ? 'Recording…' : 'Record receipt'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Apply a receipt to an invoice"
                description="Settle an existing open invoice. The payment is posted to cash and receivables automatically."
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="receipt-form"
                            disabled={paymentForm.processing || !paymentForm.data.invoice_id}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {paymentForm.processing ? 'Posting…' : 'Post receipt'}
                        </button>
                    </>
                }
            >
                <form id="receipt-form" onSubmit={submitPayment} className="space-y-4">
                    <Select
                        label="Open invoice"
                        id="invoice_id"
                        value={paymentForm.data.invoice_id}
                        onChange={(event) => selectInvoice(event.target.value)}
                        error={paymentForm.errors.invoice_id}
                    >
                        <option value="">Select an open invoice</option>
                        {invoices.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                                {invoice.number} · {invoice.contact ?? 'Customer'} · {currency(invoice.balance_due, invoice.currency)}
                            </option>
                        ))}
                    </Select>

                    {invoices.length === 0 && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            There are no open invoices to receive against. Create a sales receipt or send an invoice first.
                        </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <DateInput
                            label="Receipt date"
                            id="paid_on"
                            value={paymentForm.data.paid_on}
                            onChange={(event) => paymentForm.setData('paid_on', event.target.value)}
                            error={paymentForm.errors.paid_on}
                        />
                        <TextInput
                            label={selectedInvoice ? `Amount (${selectedInvoice.currency})` : 'Amount'}
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentForm.data.amount}
                            onChange={(event) => paymentForm.setData('amount', event.target.value)}
                            error={paymentForm.errors.amount}
                            hint={selectedInvoice ? `Balance due ${currency(selectedInvoice.balance_due, selectedInvoice.currency)}` : undefined}
                        />
                        <Select
                            label="Method"
                            id="method"
                            value={paymentForm.data.method}
                            onChange={(event) => paymentForm.setData('method', event.target.value)}
                            error={paymentForm.errors.method}
                        >
                            {methods.map((method) => (
                                <option key={method.value} value={method.value}>
                                    {method.label}
                                </option>
                            ))}
                        </Select>
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
