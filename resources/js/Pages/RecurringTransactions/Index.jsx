import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowPathIcon, BoltIcon, ClockIcon, PauseCircleIcon, PlayCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function RecurringTransactionsIndex({ templates, stats, customers, vendors, types, frequencies }) {
    const page = usePage();
    const canApprove = page.props.auth?.user?.can_approve;
    const canWrite = page.props.auth?.user?.can_write;
    const [open, setOpen] = useState(false);

    const form = useForm({
        name: '',
        type: 'invoice',
        frequency: 'monthly',
        interval: 1,
        next_run_at: today(),
        contact_id: '',
        amount: '',
        memo: '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.post('/recurring-transactions', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const run = (template) => {
        if (confirm(`Execute ${template.name} now?`)) {
            router.post(`/recurring-transactions/${template.id}/run`, {}, { preserveScroll: true });
        }
    };
    const toggle = (template) => router.post(`/recurring-transactions/${template.id}/toggle`, {}, { preserveScroll: true });
    const runDue = () => router.post('/recurring-transactions/run-due', {}, { preserveScroll: true });

    const contacts = form.data.type === 'invoice' ? customers : vendors;

    return (
        <AppLayout>
            <Head title="Recurring transactions" />

            <div className="space-y-6">
                <PageHeader eyebrow="Planning" title="Recurring transactions" description="Automate repeating invoices, bills and journals on a schedule and run them when they fall due.">
                    {canApprove && (
                        <button type="button" onClick={runDue} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                            <BoltIcon className="h-4 w-4" />
                            Run due now
                        </button>
                    )}
                    {canWrite && (
                        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <PlusIcon className="h-4 w-4" />
                            New template
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Templates" value={stats.total} hint="All recurring transactions" icon={ArrowPathIcon} accent="brand" />
                    <StatCard label="Active" value={stats.active} hint="Scheduled and running" icon={PlayCircleIcon} accent="emerald" />
                    <StatCard label="Due now" value={stats.due} hint="Ready to execute" icon={ClockIcon} accent="amber" />
                    <StatCard label="Paused" value={stats.inactive} hint="Not currently running" icon={PauseCircleIcon} accent="slate" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <h2 className="font-display text-base font-semibold text-slate-900">Templates</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Each run creates a draft document from the stored template.</p>
                    </div>

                    {templates.length === 0 ? (
                        <EmptyState title="No recurring transactions" description="Create a template to automate repeating entries." icon={ArrowPathIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Template</th>
                                        <th className="px-5 py-3">Type</th>
                                        <th className="px-5 py-3">Schedule</th>
                                        <th className="px-5 py-3">Next run</th>
                                        <th className="px-5 py-3">Last run</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {templates.map((template) => (
                                        <tr key={template.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{template.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {template.creator ? `Created by ${template.creator}` : 'System template'}
                                                    {template.template?.items?.[0]?.unit_price ? ` · ${currency(template.template.items[0].unit_price)}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5 capitalize text-slate-600">{template.type}</td>
                                            <td className="px-5 py-3.5 text-slate-500">Every {template.interval} {template.frequency.replace(/ly$/, '')}{template.interval > 1 ? 's' : ''}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(template.next_run_at)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{template.last_run_at ? formatDateTime(template.last_run_at) : '—'}</td>
                                            <td className="px-5 py-3.5"><Badge tone={template.is_active ? 'emerald' : 'slate'} dot>{template.is_active ? 'active' : 'paused'}</Badge></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canApprove && (
                                                        <button type="button" onClick={() => run(template)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Run</button>
                                                    )}
                                                    {canWrite && (
                                                        <button type="button" onClick={() => toggle(template)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300">
                                                            {template.is_active ? 'Pause' : 'Resume'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={open} onClose={() => setOpen(false)} title="New recurring template" description="The template is cloned into a draft document each time it runs." footer={<ActionFooter label="Create template" processing={form.processing} form="recurring-form" onCancel={() => setOpen(false)} />}>
                <form id="recurring-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} className="sm:col-span-2" />
                        <RichSelect
                            label="Type"
                            id="type"
                            value={form.data.type}
                            onChange={(value) => form.setData('type', value)}
                            error={form.errors.type}
                            options={types.map((type) => ({
                                value: type,
                                primary: type.charAt(0).toUpperCase() + type.slice(1),
                            }))}
                        />
                        <RichSelect
                            label="Contact"
                            id="contact_id"
                            value={form.data.contact_id}
                            onChange={(value) => form.setData('contact_id', value)}
                            error={form.errors.contact_id}
                            placeholder="No contact"
                            options={contacts.map((contact) => ({ value: contact.id, primary: contact.name }))}
                        />
                        <RichSelect
                            label="Frequency"
                            id="frequency"
                            value={form.data.frequency}
                            onChange={(value) => form.setData('frequency', value)}
                            error={form.errors.frequency}
                            options={frequencies.map((frequency) => ({
                                value: frequency,
                                primary: frequency.charAt(0).toUpperCase() + frequency.slice(1),
                            }))}
                        />
                        <TextInput label="Interval" id="interval" type="number" min="1" max="12" value={form.data.interval} onChange={(e) => form.setData('interval', e.target.value)} error={form.errors.interval} />
                        <TextInput label="Next run" id="next_run_at" type="date" value={form.data.next_run_at} onChange={(e) => form.setData('next_run_at', e.target.value)} error={form.errors.next_run_at} />
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} error={form.errors.amount} />
                        <TextInput label="Memo" id="memo" value={form.data.memo} onChange={(e) => form.setData('memo', e.target.value)} error={form.errors.memo} className="sm:col-span-2" />
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
                {processing ? 'Saving…' : label}
            </button>
        </>
    );
}
