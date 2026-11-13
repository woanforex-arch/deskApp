import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ChartBarIcon, LockClosedIcon, PlusIcon, ScaleIcon, TrashIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea, inputClasses } from '../../Components/FormControls';
import { currency, percent, statusTone } from '../../lib/format';

const budgetTone = (status) => ({ approved: 'emerald', locked: 'slate', draft: 'amber' })[status] ?? statusTone(status);

function blankLine() {
    return { account_id: '', month: 1, amount: 0 };
}

export default function BudgetsIndex({ budgets, lines, variance, selectedBudget, filters, stats, accounts, branches, departments, projects, statuses, months }) {
    const [open, setOpen] = useState(false);

    const form = useForm({
        name: '',
        fiscal_year: new Date().getFullYear(),
        branch_id: '',
        department_id: '',
        project_id: '',
        status: 'draft',
        notes: '',
        lines: [blankLine()],
    });

    const selected = budgets.find((budget) => budget.id === selectedBudget);

    const applyFilters = (key, value) => {
        router.get('/budgets', { ...filters, [key]: value || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const setLine = (index, key, value) => {
        form.setData('lines', form.data.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
    };
    const addLine = () => form.setData('lines', [...form.data.lines, blankLine()]);
    const removeLine = (index) => form.setData('lines', form.data.lines.filter((_, i) => i !== index));

    const submit = (event) => {
        event.preventDefault();
        form.post('/budgets', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const updateStatus = (status) => {
        if (!selected) return;
        router.post(`/budgets/${selected.id}/status`, { status }, { preserveScroll: true });
    };

    const totalVariance = Number(variance?.totals?.variance ?? 0);

    return (
        <AppLayout>
            <Head title="Budgets" />

            <div className="space-y-6">
                <PageHeader eyebrow="Planning" title="Budgets" description="Build monthly budgets by account and dimension, then compare them against posted actuals.">
                    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        New budget
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Budgets" value={stats.budgets} hint="Across all fiscal years" icon={ChartBarIcon} accent="brand" />
                    <StatCard label="Approved" value={stats.active} hint="Approved and active" icon={LockClosedIcon} accent="emerald" />
                    <StatCard label="Budgeted amount" value={currency(stats.budgeted)} hint="Total planned spend" icon={ScaleIcon} accent="sky" />
                    <StatCard label="Variance" value={currency(stats.variance)} hint="Actual vs budget" icon={ScaleIcon} accent={totalVariance >= 0 ? 'emerald' : 'rose'} />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-1">
                        <div className="border-b border-slate-100 p-4">
                            <h2 className="font-display text-base font-semibold text-slate-900">Budgets</h2>
                        </div>
                        {budgets.length === 0 ? (
                            <EmptyState title="No budgets yet" description="Create a budget to start planning." icon={ChartBarIcon} />
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {budgets.map((budget) => (
                                    <li key={budget.id}>
                                        <button
                                            type="button"
                                            onClick={() => applyFilters('budget_id', budget.id)}
                                            className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/70 ${budget.id === selectedBudget ? 'bg-brand-50/60' : ''}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">{budget.name}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    FY {budget.fiscal_year} · {budget.lines_count} lines
                                                    {budget.department ? ` · ${budget.department}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-slate-900">{currency(budget.total)}</p>
                                                <Badge tone={budgetTone(budget.status)}>{budget.status}</Badge>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">{selected ? selected.name : 'Budget detail'}</h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {selected ? `FY ${selected.fiscal_year}${selected.branch ? ` · ${selected.branch}` : ''}${selected.project ? ` · ${selected.project}` : ''}` : 'Select a budget to review lines and variance.'}
                                </p>
                            </div>
                            {selected && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <RichSelect
                                        value={selected.status}
                                        onChange={(value) => updateStatus(value)}
                                        placeholder="Select status"
                                        options={statuses.map((status) => ({
                                            value: status,
                                            primary: status,
                                            badge: {
                                                label: status,
                                                classes: status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600',
                                            },
                                        }))}
                                        className="w-full sm:w-auto"
                                    />
                                </div>
                            )}
                        </div>

                        {!selected ? (
                            <EmptyState title="No budget selected" description="Choose a budget from the list." icon={ScaleIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-4 py-3">Account</th>
                                            <th className="px-4 py-3">Month</th>
                                            <th className="px-4 py-3 text-right">Budget</th>
                                            <th className="px-4 py-3 text-right">Actual</th>
                                            <th className="px-4 py-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {variance.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No variance data yet. Actuals appear once journals are posted.
                                                </td>
                                            </tr>
                                        ) : (
                                            variance.rows.map((row) => (
                                                <tr key={row.account_id} className="transition hover:bg-slate-50/70">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-900">{row.code} · {row.name}</p>
                                                        <p className="text-xs capitalize text-slate-400">{row.type}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">Annual</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{currency(row.budget)}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{currency(row.actual)}</td>
                                                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${row.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {currency(row.variance)}
                                                        <span className="ml-1 text-xs font-normal text-slate-400">{percent(row.variance_percent)}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {variance.rows.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-900">
                                                <td className="px-4 py-3" colSpan={2}>Total</td>
                                                <td className="px-4 py-3 text-right">{currency(variance.totals.budget)}</td>
                                                <td className="px-4 py-3 text-right">{currency(variance.totals.actual)}</td>
                                                <td className={`px-4 py-3 text-right ${variance.totals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(variance.totals.variance)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal open={open} onClose={() => setOpen(false)} title="New budget" description="Define the planning period and monthly lines." size="xl" footer={<ActionFooter label="Create budget" processing={form.processing} form="budget-form" onCancel={() => setOpen(false)} />}>
                <form id="budget-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Budget name" id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} />
                        <TextInput label="Fiscal year" id="fiscal_year" type="number" value={form.data.fiscal_year} onChange={(e) => form.setData('fiscal_year', e.target.value)} error={form.errors.fiscal_year} />
                        <RichSelect
                            label="Branch"
                            id="branch_id"
                            value={form.data.branch_id}
                            onChange={(value) => form.setData('branch_id', value)}
                            error={form.errors.branch_id}
                            placeholder="All branches"
                            options={branches.map((branch) => ({ value: branch.id, primary: branch.name }))}
                        />
                        <RichSelect
                            label="Department"
                            id="department_id"
                            value={form.data.department_id}
                            onChange={(value) => form.setData('department_id', value)}
                            error={form.errors.department_id}
                            placeholder="All departments"
                            options={departments.map((department) => ({ value: department.id, primary: department.name }))}
                        />
                        <RichSelect
                            label="Project"
                            id="project_id"
                            value={form.data.project_id}
                            onChange={(value) => form.setData('project_id', value)}
                            error={form.errors.project_id}
                            placeholder="No project"
                            options={projects.map((project) => ({ value: project.id, primary: project.name }))}
                        />
                        <RichSelect
                            label="Status"
                            id="status"
                            value={form.data.status}
                            onChange={(value) => form.setData('status', value)}
                            error={form.errors.status}
                            options={statuses.map((status) => ({
                                value: status,
                                primary: status.charAt(0).toUpperCase() + status.slice(1),
                                badge: {
                                    label: status.charAt(0).toUpperCase() + status.slice(1),
                                    classes: status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600',
                                },
                            }))}
                        />
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Monthly lines</p>
                            <button type="button" onClick={addLine} className="text-xs font-semibold text-brand-600 hover:text-brand-700">+ Add line</button>
                        </div>
                        <div className="space-y-3 p-4">
                            {form.data.lines.map((line, index) => (
                                <div key={index} className="grid gap-2 rounded-lg bg-slate-50/70 p-3 sm:grid-cols-12">
                                    <select className={`${inputClasses} sm:col-span-6`} value={line.account_id} onChange={(e) => setLine(index, 'account_id', e.target.value)}>
                                        <option value="">Account</option>
                                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                                    </select>
                                    <select className={`${inputClasses} sm:col-span-3`} value={line.month} onChange={(e) => setLine(index, 'month', e.target.value)}>
                                        {months.map((month) => <option key={month} value={month}>Month {month}</option>)}
                                    </select>
                                    <div className="flex items-center gap-2 sm:col-span-3">
                                        <input type="number" step="0.01" className={inputClasses} placeholder="Amount" value={line.amount} onChange={(e) => setLine(index, 'amount', e.target.value)} />
                                        {form.data.lines.length > 1 && (
                                            <button type="button" onClick={() => removeLine(index)} className="text-slate-400 hover:text-rose-600"><TrashIcon className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Textarea label="Notes" id="notes" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} error={form.errors.notes} rows={3} />
                </form>
            </Modal>

        </AppLayout>
    );
}

function ActionFooter({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">Cancel</button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Saving…' : label}
            </button>
        </>
    );
}
