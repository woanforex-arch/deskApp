import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    ArrowsUpDownIcon,
    BookOpenIcon,
    CheckCircleIcon,
    DocumentDuplicateIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    PrinterIcon,
    ScaleIcon,
    TrashIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
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

function blankLine() {
    return { account_id: '', description: '', debit: '', credit: '' };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

export default function JournalIndex({ entries, filters, statuses, trialBalance, stats = {}, accounts = [], nextReference = '' }) {
    const company = usePage().props.company;
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [sort, setSort] = useState(filters.sort ?? 'entry_date');
    const [direction, setDirection] = useState(filters.direction ?? 'desc');
    const [open, setOpen] = useState(false);
    const [viewing, setViewing] = useState(null);
    const [editing, setEditing] = useState(false);

    const form = useForm({
        reference: nextReference,
        entry_date: today(),
        memo: '',
        status: 'draft',
        lines: [blankLine(), blankLine()],
    });

    const editForm = useForm({
        reference: '',
        entry_date: today(),
        memo: '',
        lines: [blankLine(), blankLine()],
    });

    const buildQuery = (overrides = {}) => {
        const params = {
            search,
            status,
            from,
            to,
            sort,
            direction,
            ...overrides,
        };

        return Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
        );
    };

    const applyFilters = (event) => {
        event?.preventDefault();

        router.get('/journal', buildQuery(), { preserveState: true, preserveScroll: true, replace: true });
    };

    const resetFilters = () => {
        setSearch('');
        setStatus('');
        setFrom('');
        setTo('');
        setSort('entry_date');
        setDirection('desc');
        router.get('/journal', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const applySort = (nextSort, nextDirection) => {
        setSort(nextSort);
        setDirection(nextDirection);

        router.get(
            '/journal',
            buildQuery({ sort: nextSort, direction: nextDirection }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const toggleDateSort = () => {
        const nextDirection = sort === 'entry_date' && direction === 'desc' ? 'asc' : 'desc';
        applySort('entry_date', nextDirection);
    };

    const filterByStatus = (nextStatus) => {
        const value = nextStatus === status ? '' : nextStatus;

        if (value === status) {
            return;
        }

        setStatus(value);

        router.get(
            '/journal',
            buildQuery({ status: value }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const setLine = (index, key, value) => {
        const lines = form.data.lines.map((line, i) => {
            if (i !== index) {
                return line;
            }

            const next = { ...line, [key]: value };

            if (key === 'debit' && value !== '') {
                next.credit = '';
            }

            if (key === 'credit' && value !== '') {
                next.debit = '';
            }

            return next;
        });

        form.setData('lines', lines);
    };

    const addLine = () => form.setData('lines', [...form.data.lines, blankLine()]);
    const removeLine = (index) => form.setData('lines', form.data.lines.filter((_, i) => i !== index));

    const totalDebit = form.data.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredit = form.data.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

    const openCreate = () => {
        form.clearErrors();
        form.setData({
            reference: nextReference,
            entry_date: today(),
            memo: '',
            status: 'draft',
            lines: [blankLine(), blankLine()],
        });
        setOpen(true);
    };

    const submit = (event) => {
        event.preventDefault();
        form.post('/journal', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const postEntry = (entry) => {
        if (confirm(`Post journal entry ${entry.reference} to the ledger?`)) {
            router.post(
                `/journal/${entry.id}/post`,
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => closeViewer(),
                },
            );
        }
    };

    const closeViewer = () => {
        setViewing(null);
        setEditing(false);
        editForm.clearErrors();
    };

    const deleteEntry = (entry) => {
        if (confirm(`Delete draft journal entry ${entry.reference}? This cannot be undone.`)) {
            router.delete(`/journal/${entry.id}`, {
                preserveScroll: true,
                onSuccess: () => closeViewer(),
            });
        }
    };

    const viewingEntry = viewing ? entries.data.find((entry) => entry.id === viewing.id) ?? viewing : null;

    const startEditing = (entry) => {
        editForm.clearErrors();
        editForm.setData({
            reference: entry.reference ?? '',
            entry_date: entry.entry_date ?? today(),
            memo: entry.memo ?? '',
            lines:
                (entry.lines ?? []).length > 0
                    ? entry.lines.map((line) => ({
                          account_id: line.account_id ? String(line.account_id) : '',
                          description: line.description ?? '',
                          debit: line.debit ? String(line.debit) : '',
                          credit: line.credit ? String(line.credit) : '',
                      }))
                    : [blankLine(), blankLine()],
        });
        setEditing(true);
    };

    const setEditLine = (index, key, value) => {
        const lines = editForm.data.lines.map((line, i) => {
            if (i !== index) {
                return line;
            }

            const next = { ...line, [key]: value };

            if (key === 'debit' && value !== '') {
                next.credit = '';
            }

            if (key === 'credit' && value !== '') {
                next.debit = '';
            }

            return next;
        });

        editForm.setData('lines', lines);
    };

    const addEditLine = () => editForm.setData('lines', [...editForm.data.lines, blankLine()]);
    const removeEditLine = (index) => editForm.setData('lines', editForm.data.lines.filter((_, i) => i !== index));

    const editTotalDebit = editForm.data.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const editTotalCredit = editForm.data.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    const editDifference = Math.round((editTotalDebit - editTotalCredit) * 100) / 100;

    const saveEdit = (event) => {
        event.preventDefault();

        if (!viewingEntry) {
            return;
        }

        editForm.put(`/journal/${viewingEntry.id}`, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    const cancelEdit = () => {
        setEditing(false);
        editForm.clearErrors();
    };

    const duplicateEntry = (entry) => {
        if (confirm(`Create a new draft copy of journal entry ${entry.reference}?`)) {
            router.post(`/journal/${entry.id}/duplicate`, {}, { preserveScroll: true, onSuccess: () => closeViewer() });
        }
    };

    const voidEntry = (entry) => {
        if (confirm(`Void journal entry ${entry.reference}? A reversing entry will be posted automatically.`)) {
            router.post(`/journal/${entry.id}/void`, {}, { preserveScroll: true, onSuccess: () => closeViewer() });
        }
    };

    const deleteVoidEntry = (entry) => {
        if (
            confirm(
                `Delete void journal entry ${entry.reference} and its posted reversal?\n\nBoth entries will be removed from the ledger. This cannot be undone.`,
            )
        ) {
            router.delete(`/journal/${entry.id}/void`, { preserveScroll: true, onSuccess: () => closeViewer() });
        }
    };

    const printEntry = (entry) => {
        const lines = (entry.lines ?? [])
            .map(
                (line) => `<tr>
                    <td>${escapeHtml(line.account ?? '—')}</td>
                    <td>${escapeHtml(line.description || '—')}</td>
                    <td class="num">${line.debit ? escapeHtml(currency(line.debit)) : ''}</td>
                    <td class="num">${line.credit ? escapeHtml(currency(line.credit)) : ''}</td>
                </tr>`,
            )
            .join('');

        const win = window.open('', '_blank', 'width=860,height=900');

        if (!win) {
            return;
        }

        const companyMeta = [
            company?.registration_number ? `Reg. ${company.registration_number}` : null,
            company?.tax_number ? `Tax ${company.tax_number}` : null,
            company?.code ? company.code : null,
        ].filter(Boolean).join(' · ');

        const companyBlock = company?.name
            ? `<div class="company">
                <p class="name">${escapeHtml(company.name)}</p>
                ${company.address ? `<p class="address">${escapeHtml(company.address)}</p>` : ''}
                ${companyMeta ? `<p class="meta-line">${escapeHtml(companyMeta)}</p>` : ''}
            </div>`
            : '';

        win.document.write(`<!doctype html>
<html>
<head>
    <title>Journal entry ${escapeHtml(entry.reference)}</title>
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; padding: 32px; }
        .company { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #0f172a; }
        .company .name { font-size: 18px; font-weight: 700; margin: 0; }
        .company .address { color: #475569; font-size: 12px; margin: 4px 0 0; white-space: pre-line; }
        .company .meta-line { color: #94a3b8; font-size: 11px; margin: 4px 0 0; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #475569; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #64748b; }
        .num { text-align: right; white-space: nowrap; }
        tfoot td { font-weight: 600; background: #f8fafc; }
        .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; }
    </style>
</head>
<body>
    ${companyBlock}
    <h1>Journal entry ${escapeHtml(entry.reference)}</h1>
    <div class="meta">${escapeHtml(formatDate(entry.entry_date))} · ${escapeHtml(entry.status_label)}${entry.memo ? ` · ${escapeHtml(entry.memo)}` : ''}</div>
    <table>
        <thead>
            <tr><th>Account</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th></tr>
        </thead>
        <tbody>${lines}</tbody>
        <tfoot>
            <tr>
                <td colspan="2">Totals</td>
                <td class="num">${escapeHtml(currency(entry.total_debit))}</td>
                <td class="num">${escapeHtml(currency(entry.total_credit))}</td>
            </tr>
        </tfoot>
    </table>
    <p class="footer">Generated ${escapeHtml(new Date().toLocaleString())}</p>
</body>
</html>`);

        win.document.close();
        win.focus();
        win.print();
    };

    const hasFilters = Boolean(filters.search || filters.status || filters.from || filters.to);

    return (
        <AppLayout>
            <Head title="General journal" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Double-entry"
                    title="General journal"
                    description="Every posted debit and credit, with the trial balance kept in view."
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                            <BookOpenIcon className="h-4 w-4 text-slate-400" />
                            {entries.total} journal entries
                        </span>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New entry
                        </button>
                    </div>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="All entries"
                        value={stats.total ?? 0}
                        hint="Every journal entry"
                        icon={BookOpenIcon}
                        accent="brand"
                        onClick={() => filterByStatus('')}
                        active={!status}
                        activeLabel="Show all journal entries"
                    />
                    <StatCard
                        label="Drafts"
                        value={stats.draft ?? 0}
                        hint="Awaiting posting"
                        icon={PencilSquareIcon}
                        accent="amber"
                        onClick={() => filterByStatus('draft')}
                        active={status === 'draft'}
                        activeLabel="Show draft journal entries"
                    />
                    <StatCard
                        label="Posted"
                        value={stats.posted ?? 0}
                        hint="In the ledger"
                        icon={CheckCircleIcon}
                        accent="emerald"
                        onClick={() => filterByStatus('posted')}
                        active={status === 'posted'}
                        activeLabel="Show posted journal entries"
                    />
                    <StatCard
                        label="Void"
                        value={stats.void ?? 0}
                        hint="Cancelled entries"
                        icon={XCircleIcon}
                        accent="slate"
                        onClick={() => filterByStatus('void')}
                        active={status === 'void'}
                        activeLabel="Show void journal entries"
                    />
                </div>

                <div
                    className={`rounded-2xl border p-5 shadow-sm ${
                        trialBalance.balanced
                            ? 'border-emerald-200 bg-emerald-50/60'
                            : 'border-rose-200 bg-rose-50/60'
                    }`}
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <span
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${
                                    trialBalance.balanced
                                        ? 'bg-emerald-100 text-emerald-600 ring-emerald-200'
                                        : 'bg-rose-100 text-rose-600 ring-rose-200'
                                }`}
                            >
                                {trialBalance.balanced ? (
                                    <CheckCircleIcon className="h-5 w-5" />
                                ) : (
                                    <ScaleIcon className="h-5 w-5" />
                                )}
                            </span>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Trial balance
                                </p>
                                <p className={`mt-0.5 text-sm font-medium ${trialBalance.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {trialBalance.balanced ? 'Debits equal credits' : 'Difference needs investigation'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">Posted lines only</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-right sm:gap-10">
                            <div>
                                <p className="text-xs text-slate-500">Debits</p>
                                <p className="font-display text-lg font-semibold text-slate-900">{currency(trialBalance.debit)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Credits</p>
                                <p className="font-display text-lg font-semibold text-slate-900">{currency(trialBalance.credit)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Difference</p>
                                <p className={`font-display text-lg font-semibold ${trialBalance.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {currency(trialBalance.difference)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Journal entries</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Entries must balance before they can be posted.
                            </p>
                        </div>

                        <form onSubmit={applyFilters} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="relative">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search reference or memo…"
                                    className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-56"
                                />
                            </div>

                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            >
                                <option value="">All statuses</option>
                                {statuses.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={from}
                                    max={to || undefined}
                                    onChange={(event) => setFrom(event.target.value)}
                                    aria-label="From date"
                                    title="From date"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                                <span className="text-xs font-medium text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={to}
                                    min={from || undefined}
                                    onChange={(event) => setTo(event.target.value)}
                                    aria-label="To date"
                                    title="To date"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                            </div>

                            <select
                                value={`${sort}:${direction}`}
                                onChange={(event) => {
                                    const [nextSort, nextDirection] = event.target.value.split(':');
                                    applySort(nextSort, nextDirection);
                                }}
                                aria-label="Sort journal entries"
                                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            >
                                <option value="entry_date:desc">Newest first</option>
                                <option value="entry_date:asc">Oldest first</option>
                                <option value="reference:asc">Reference A–Z</option>
                                <option value="reference:desc">Reference Z–A</option>
                            </select>

                            <button
                                type="submit"
                                className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                            >
                                Filter
                            </button>

                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                    Reset
                                </button>
                            )}
                        </form>
                    </div>

                    {entries.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No journal entries match your filters' : 'No journal entries yet'}
                            description="Post a balanced entry to populate the ledger."
                            icon={BookOpenIcon}
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
                                        onClick={openCreate}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        New entry
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
                                            <th className="px-5 py-3">Reference</th>
                                            <th className="px-5 py-3">
                                                <button
                                                    type="button"
                                                    onClick={toggleDateSort}
                                                    title={`Sort by date ${sort === 'entry_date' && direction === 'asc' ? 'descending' : 'ascending'}`}
                                                    className="inline-flex items-center gap-1 transition hover:text-slate-900"
                                                >
                                                    Date
                                                    {sort === 'entry_date' ? (
                                                        direction === 'asc' ? (
                                                            <ArrowUpIcon className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <ArrowDownIcon className="h-3.5 w-3.5" />
                                                        )
                                                    ) : (
                                                        <ArrowsUpDownIcon className="h-3.5 w-3.5 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-5 py-3">Memo</th>
                                            <th className="px-5 py-3 text-right">Lines</th>
                                            <th className="px-5 py-3 text-right">Debit</th>
                                            <th className="px-5 py-3 text-right">Credit</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {entries.data.map((entry) => (
                                            <tr key={entry.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">
                                                    {entry.reference}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                                                    {formatDate(entry.entry_date)}
                                                </td>
                                                <td className="max-w-[18rem] truncate px-5 py-3.5 text-slate-600">
                                                    {entry.memo}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-500">
                                                    {entry.lines_count}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {currency(entry.total_debit)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {currency(entry.total_credit)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Badge tone={statusTone(entry.status)} dot>
                                                        {entry.status_label}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewing(entry)}
                                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 hover:text-brand-700"
                                                        >
                                                            <EyeIcon className="h-3.5 w-3.5" />
                                                            View
                                                        </button>
                                                        {entry.status === 'draft' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => postEntry(entry)}
                                                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                                >
                                                                    Post
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => deleteEntry(entry)}
                                                                    title={`Delete draft ${entry.reference}`}
                                                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination paginator={entries} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="New journal entry"
                description="Enter at least two lines with equal debits and credits."
                size="xl"
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="journal-form"
                            disabled={form.processing || difference !== 0 || totalDebit <= 0}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : form.data.status === 'posted' ? 'Create & post' : 'Save draft'}
                        </button>
                    </>
                }
            >
                <form id="journal-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Reference"
                            id="reference"
                            value={form.data.reference}
                            onChange={(event) => form.setData('reference', event.target.value)}
                            placeholder="Auto-generated"
                            error={form.errors.reference}
                        />
                        <TextInput
                            label="Entry date"
                            id="entry_date"
                            type="date"
                            value={form.data.entry_date}
                            onChange={(event) => form.setData('entry_date', event.target.value)}
                            error={form.errors.entry_date}
                        />
                        <TextInput
                            label="Memo"
                            id="memo"
                            value={form.data.memo}
                            onChange={(event) => form.setData('memo', event.target.value)}
                            placeholder="What is this entry for?"
                            error={form.errors.memo}
                            className="sm:col-span-2"
                        />
                        <Select
                            label="Status"
                            id="status"
                            value={form.data.status}
                            onChange={(event) => form.setData('status', event.target.value)}
                            error={form.errors.status}
                        >
                            <option value="draft">Draft</option>
                            <option value="posted">Posted</option>
                        </Select>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Journal lines</p>
                            <button type="button" onClick={addLine} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                + Add line
                            </button>
                        </div>
                        <div className="space-y-3 p-4">
                            {form.data.lines.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <select
                                        className={`${inputClasses} sm:col-span-3`}
                                        value={line.account_id}
                                        onChange={(event) => setLine(index, 'account_id', event.target.value)}
                                    >
                                        <option value="">Select account</option>
                                        {accounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                                {account.code} · {account.name}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        className={`${inputClasses} sm:col-span-3`}
                                        placeholder="Description"
                                        value={line.description}
                                        onChange={(event) => setLine(index, 'description', event.target.value)}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                        placeholder="Debit"
                                        value={line.debit}
                                        onChange={(event) => setLine(index, 'debit', event.target.value)}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                        placeholder="Credit"
                                        value={line.credit}
                                        onChange={(event) => setLine(index, 'credit', event.target.value)}
                                    />
                                    <div className="flex items-center justify-end sm:col-span-2">
                                        {form.data.lines.length > 2 && (
                                            <button type="button" onClick={() => removeLine(index)} className="text-slate-400 hover:text-rose-600">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {form.errors.lines && (
                        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{form.errors.lines}</p>
                    )}

                    <div className="flex justify-end gap-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Debits</p>
                            <p className="font-semibold text-slate-900">{currency(totalDebit, undefined, { convert: false })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Credits</p>
                            <p className="font-semibold text-slate-900">{currency(totalCredit, undefined, { convert: false })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Difference</p>
                            <p className={`font-display text-base font-semibold ${difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {currency(difference, undefined, { convert: false })}
                            </p>
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal
                open={viewingEntry !== null}
                onClose={closeViewer}
                title={viewingEntry ? `Journal entry ${viewingEntry.reference}` : 'Journal entry'}
                description={
                    viewingEntry
                        ? editing
                            ? 'Editing draft — update the details and lines, then save your changes.'
                            : `${formatDate(viewingEntry.entry_date)}${viewingEntry.memo ? ` · ${viewingEntry.memo}` : ''}`
                        : ''
                }
                size="xl"
                footer={
                    editing ? (
                        <div className="flex w-full items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="journal-edit-form"
                                disabled={editForm.processing || editDifference !== 0 || editTotalDebit <= 0}
                                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                            >
                                {editForm.processing ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex w-full flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                {viewingEntry?.status === 'draft' && (
                                    <button
                                        type="button"
                                        onClick={() => deleteEntry(viewingEntry)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        Delete draft
                                    </button>
                                )}
                                {viewingEntry?.status === 'posted' && (
                                    <button
                                        type="button"
                                        onClick={() => voidEntry(viewingEntry)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                    >
                                        <XCircleIcon className="h-4 w-4" />
                                        Void entry
                                    </button>
                                )}
                                {viewingEntry?.status === 'void' && (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => deleteVoidEntry(viewingEntry)}
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            Delete void entry
                                        </button>
                                        <span className="text-xs font-medium text-slate-500">
                                            Removes this entry and its reversal from the ledger.
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeViewer}
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => printEntry(viewingEntry)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                                >
                                    <PrinterIcon className="h-4 w-4" />
                                    Print
                                </button>
                                <button
                                    type="button"
                                    onClick={() => duplicateEntry(viewingEntry)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                                >
                                    <DocumentDuplicateIcon className="h-4 w-4" />
                                    Duplicate
                                </button>
                                {viewingEntry?.status === 'draft' && (
                                    <button
                                        type="button"
                                        onClick={() => startEditing(viewingEntry)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        Edit
                                    </button>
                                )}
                                {viewingEntry?.status === 'draft' && (
                                    <button
                                        type="button"
                                        onClick={() => postEntry(viewingEntry)}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                                    >
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Post entry
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                }
            >
                {viewingEntry && !editing && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <Badge tone={statusTone(viewingEntry.status)} dot>
                                {viewingEntry.status_label}
                            </Badge>
                            <span>{viewingEntry.lines_count} lines</span>
                            {viewingEntry.posted_at && <span>Posted {formatDate(viewingEntry.posted_at)}</span>}
                        </div>

                        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm sm:grid-cols-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Reference</p>
                                <p className="mt-1 font-medium text-slate-900">{viewingEntry.reference}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entry date</p>
                                <p className="mt-1 font-medium text-slate-900">{formatDate(viewingEntry.entry_date)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Memo</p>
                                <p className="mt-1 font-medium text-slate-900">{viewingEntry.memo || '—'}</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-4 py-3">Account</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3 text-right">Debit</th>
                                            <th className="px-4 py-3 text-right">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(viewingEntry.lines ?? []).map((line) => (
                                            <tr key={line.id}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{line.account ?? '—'}</td>
                                                <td className="px-4 py-3 text-slate-600">{line.description || '—'}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                                                    {line.debit ? currency(line.debit) : '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                                                    {line.credit ? currency(line.credit) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50/60 font-semibold text-slate-900">
                                            <td className="px-4 py-3" colSpan={2}>
                                                Totals
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                {currency(viewingEntry.total_debit)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                {currency(viewingEntry.total_credit)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {viewingEntry && editing && (
                    <form id="journal-edit-form" onSubmit={saveEdit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextInput
                                label="Reference"
                                id="edit-reference"
                                value={editForm.data.reference}
                                onChange={(event) => editForm.setData('reference', event.target.value)}
                                error={editForm.errors.reference}
                            />
                            <TextInput
                                label="Entry date"
                                id="edit-entry-date"
                                type="date"
                                value={editForm.data.entry_date}
                                onChange={(event) => editForm.setData('entry_date', event.target.value)}
                                error={editForm.errors.entry_date}
                            />
                            <TextInput
                                label="Memo"
                                id="edit-memo"
                                value={editForm.data.memo}
                                onChange={(event) => editForm.setData('memo', event.target.value)}
                                placeholder="What is this entry for?"
                                error={editForm.errors.memo}
                                className="sm:col-span-2"
                            />
                        </div>

                        <div className="rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                <p className="text-sm font-semibold text-slate-900">Journal lines</p>
                                <button
                                    type="button"
                                    onClick={addEditLine}
                                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                                >
                                    + Add line
                                </button>
                            </div>
                            <div className="space-y-3 p-4">
                                {editForm.data.lines.map((line, index) => (
                                    <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                        <select
                                            className={`${inputClasses} sm:col-span-3`}
                                            value={line.account_id}
                                            onChange={(event) => setEditLine(index, 'account_id', event.target.value)}
                                        >
                                            <option value="">Select account</option>
                                            {accounts.map((account) => (
                                                <option key={account.id} value={account.id}>
                                                    {account.code} · {account.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            className={`${inputClasses} sm:col-span-3`}
                                            placeholder="Description"
                                            value={line.description}
                                            onChange={(event) => setEditLine(index, 'description', event.target.value)}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                            placeholder="Debit"
                                            value={line.debit}
                                            onChange={(event) => setEditLine(index, 'debit', event.target.value)}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className={`${inputClasses} no-spinner text-right tabular-nums sm:col-span-2`}
                                            placeholder="Credit"
                                            value={line.credit}
                                            onChange={(event) => setEditLine(index, 'credit', event.target.value)}
                                        />
                                        <div className="flex items-center justify-end sm:col-span-2">
                                            {editForm.data.lines.length > 2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeEditLine(index)}
                                                    className="text-slate-400 hover:text-rose-600"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {editForm.errors.lines && (
                            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{editForm.errors.lines}</p>
                        )}

                        {Object.keys(editForm.errors).some((key) => key.startsWith('lines.')) && (
                            <ul className="space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                                {Object.entries(editForm.errors)
                                    .filter(([key]) => key.startsWith('lines.'))
                                    .map(([key, message]) => (
                                        <li key={key}>{message}</li>
                                    ))}
                            </ul>
                        )}

                        <div className="flex justify-end gap-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Debits</p>
                                <p className="font-semibold text-slate-900">
                                    {currency(editTotalDebit, undefined, { convert: false })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Credits</p>
                                <p className="font-semibold text-slate-900">
                                    {currency(editTotalCredit, undefined, { convert: false })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Difference</p>
                                <p
                                    className={`font-display text-base font-semibold ${
                                        editDifference === 0 ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                >
                                    {currency(editDifference, undefined, { convert: false })}
                                </p>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>
        </AppLayout>
    );
}
