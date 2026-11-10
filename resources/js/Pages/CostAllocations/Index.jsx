import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowsRightLeftIcon, IdentificationIcon, PlusIcon, ScaleIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput } from '../../Components/FormControls';
import { percent } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function CostAllocationsIndex({ allocations, stats, costCenters, accounts, bases }) {
    const [open, setOpen] = useState(false);
    const [runFor, setRunFor] = useState(null);

    const form = useForm({
        name: '',
        source_cost_center_id: '',
        target_cost_center_id: '',
        account_id: '',
        percentage: 100,
        basis: 'percentage',
    });

    const runForm = useForm({ amount: '', allocation_date: today() });

    const submit = (event) => {
        event.preventDefault();
        form.post('/cost-allocations', { preserveScroll: true, onSuccess: () => { setOpen(false); form.reset(); } });
    };

    const openRun = (allocation) => {
        setRunFor(allocation);
        runForm.setData({ amount: '', allocation_date: today() });
    };

    const submitRun = (event) => {
        event.preventDefault();
        runForm.post(`/cost-allocations/${runFor.id}/run`, { preserveScroll: true, onSuccess: () => { setRunFor(null); runForm.reset(); } });
    };

    return (
        <AppLayout>
            <Head title="Cost allocations" />

            <div className="space-y-6">
                <PageHeader eyebrow="Planning" title="Cost allocations" description="Spread shared costs across cost centers and post the allocation to the ledger.">
                    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        New allocation rule
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Rules" value={stats.total} hint="Allocation rules defined" icon={ScaleIcon} accent="brand" />
                    <StatCard label="Active" value={stats.active} hint="Available to run" icon={ArrowsRightLeftIcon} accent="emerald" />
                    <StatCard label="Cost centers" value={stats.cost_centers} hint="Allocation targets" icon={IdentificationIcon} accent="sky" />
                    <StatCard label="Allocated" value={percent(stats.percentage)} hint="Sum of active percentages" icon={ScaleIcon} accent="amber" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <h2 className="font-display text-base font-semibold text-slate-900">Allocation rules</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Each run posts a transfer between the source and target cost centers.</p>
                    </div>
                    {allocations.length === 0 ? (
                        <EmptyState title="No allocation rules" description="Create a rule to allocate shared costs." icon={ArrowsRightLeftIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Rule</th>
                                        <th className="px-5 py-3">Source</th>
                                        <th className="px-5 py-3">Target</th>
                                        <th className="px-5 py-3">Account</th>
                                        <th className="px-5 py-3 text-right">Percentage</th>
                                        <th className="px-5 py-3">Basis</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allocations.map((allocation) => (
                                        <tr key={allocation.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5 font-semibold text-slate-900">{allocation.name}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{allocation.source ?? '—'}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{allocation.target ?? '—'}</td>
                                            <td className="px-5 py-3.5 text-slate-500">{allocation.account ?? '—'}</td>
                                            <td className="px-5 py-3.5 text-right font-medium text-slate-900">{percent(allocation.percentage)}</td>
                                            <td className="px-5 py-3.5 capitalize text-slate-500">{allocation.basis}</td>
                                            <td className="px-5 py-3.5"><Badge tone={allocation.is_active ? 'emerald' : 'slate'} dot>{allocation.is_active ? 'active' : 'inactive'}</Badge></td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button type="button" onClick={() => openRun(allocation)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Run</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={open} onClose={() => setOpen(false)} title="New allocation rule" footer={<ActionFooter label="Create rule" processing={form.processing} form="allocation-form" onCancel={() => setOpen(false)} />}>
                <form id="allocation-form" onSubmit={submit} className="space-y-4">
                    <TextInput label="Rule name" id="allocation_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Source cost center" id="source_center" value={form.data.source_cost_center_id} onChange={(e) => form.setData('source_cost_center_id', e.target.value)} error={form.errors.source_cost_center_id}>
                            <option value="">None</option>
                            {costCenters.map((center) => <option key={center.id} value={center.id}>{center.code} · {center.name}</option>)}
                        </Select>
                        <Select label="Target cost center" id="target_center" value={form.data.target_cost_center_id} onChange={(e) => form.setData('target_cost_center_id', e.target.value)} error={form.errors.target_cost_center_id}>
                            <option value="">None</option>
                            {costCenters.map((center) => <option key={center.id} value={center.id}>{center.code} · {center.name}</option>)}
                        </Select>
                        <Select label="Account" id="allocation_account" value={form.data.account_id} onChange={(e) => form.setData('account_id', e.target.value)} error={form.errors.account_id}>
                            <option value="">None</option>
                            {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                        </Select>
                        <Select label="Basis" id="allocation_basis" value={form.data.basis} onChange={(e) => form.setData('basis', e.target.value)} error={form.errors.basis}>
                            {bases.map((basis) => <option key={basis} value={basis}>{basis}</option>)}
                        </Select>
                        <TextInput label="Percentage" id="allocation_percentage" type="number" step="0.01" min="0" max="100" value={form.data.percentage} onChange={(e) => form.setData('percentage', e.target.value)} error={form.errors.percentage} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>

            <Modal open={runFor !== null} onClose={() => setRunFor(null)} title="Run allocation" description={runFor ? `${runFor.name} · ${percent(runFor.percentage)} of the amount will be allocated.` : ''} footer={<ActionFooter label="Post allocation" processing={runForm.processing} form="run-form" onCancel={() => setRunFor(null)} />}>
                <form id="run-form" onSubmit={submitRun} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Amount" id="run_amount" type="number" step="0.01" value={runForm.data.amount} onChange={(e) => runForm.setData('amount', e.target.value)} error={runForm.errors.amount} />
                        <TextInput label="Allocation date" id="run_date" type="date" value={runForm.data.allocation_date} onChange={(e) => runForm.setData('allocation_date', e.target.value)} error={runForm.errors.allocation_date} />
                    </div>
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
                {processing ? 'Posting…' : label}
            </button>
        </>
    );
}
