import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    CalendarDaysIcon,
    CheckCircleIcon,
    Cog6ToothIcon,
    LockClosedIcon,
    LockOpenIcon,
    PlusIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime, statusTone } from '../../lib/format';

export default function ControlsIndex({ periods, postingRules, workflows, approvals, stats, accounts, types, roles, statuses }) {
    const canApprove = usePage().props.auth?.user?.can_approve;
    const [tab, setTab] = useState('periods');
    const [modal, setModal] = useState(null);
    const [deciding, setDeciding] = useState(null);

    const periodForm = useForm({ name: '', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10), status: 'open', notes: '' });
    const ruleForm = useForm({ event: '', name: '', debit_account_id: '', credit_account_id: '', tax_account_id: '', description: '' });
    const workflowForm = useForm({ name: '', type: 'invoice', threshold: 0, approver_role: 'approver', description: '' });
    const decideForm = useForm({ status: 'approved', notes: '' });

    const tabs = [
        { key: 'periods', label: 'Period locks', count: periods.length },
        { key: 'rules', label: 'Posting rules', count: postingRules.length },
        { key: 'workflows', label: 'Approval workflows', count: workflows.length },
        { key: 'approvals', label: 'Approval queue', count: stats.pending_approvals },
    ];

    const submitPeriod = (event) => {
        event.preventDefault();
        periodForm.post('/controls/periods', { preserveScroll: true, onSuccess: () => { setModal(null); periodForm.reset(); } });
    };
    const submitRule = (event) => {
        event.preventDefault();
        ruleForm.post('/controls/posting-rules', { preserveScroll: true, onSuccess: () => { setModal(null); ruleForm.reset(); } });
    };
    const submitWorkflow = (event) => {
        event.preventDefault();
        workflowForm.post('/controls/workflows', { preserveScroll: true, onSuccess: () => { setModal(null); workflowForm.reset(); } });
    };
    const submitDecision = (event) => {
        event.preventDefault();
        decideForm.post(`/controls/approvals/${deciding.id}/decide`, {
            preserveScroll: true,
            onSuccess: () => { setDeciding(null); decideForm.reset(); },
        });
    };

    const closePeriod = (period) => {
        if (confirm(`Close ${period.name}? Posting into this period will be blocked.`)) {
            router.post(`/controls/periods/${period.id}/close`, {}, { preserveScroll: true });
        }
    };
    const reopenPeriod = (period) => {
        if (confirm(`Reopen ${period.name}?`)) {
            router.post(`/controls/periods/${period.id}/reopen`, {}, { preserveScroll: true });
        }
    };

    return (
        <AppLayout>
            <Head title="Controls" />

            <div className="space-y-6">
                <PageHeader eyebrow="Controls" title="Periods, rules & approvals" description="Enforce period locks, maintain posting rules and route documents through approval workflows.">
                    <button type="button" onClick={() => setModal(tab === 'rules' ? 'rule' : tab === 'workflows' ? 'workflow' : 'period')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        {tab === 'rules' ? 'New rule' : tab === 'workflows' ? 'New workflow' : 'New period'}
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Open periods" value={stats.open_periods} hint="Accepting postings" icon={LockOpenIcon} accent="emerald" />
                    <StatCard label="Closed periods" value={stats.closed_periods} hint="Locked to correction" icon={LockClosedIcon} accent="slate" />
                    <StatCard label="Active rules" value={stats.rules} hint="Automated posting rules" icon={Cog6ToothIcon} accent="sky" />
                    <StatCard label="Pending approvals" value={stats.pending_approvals} hint="Awaiting a decision" icon={ShieldCheckIcon} accent="amber" />
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>
                            {item.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item.key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>
                        </button>
                    ))}
                </div>

                {tab === 'periods' && (
                    <Card title="Accounting periods" description="A closed period blocks all new postings until reopened by an administrator.">
                        {periods.length === 0 ? <EmptyState title="No periods" description="Create a period to enable period locking." icon={CalendarDaysIcon} /> : (
                            <Table head={['Period', 'Range', 'Status', 'Closed by', 'Closed at', 'Actions']}>
                                {periods.map((period) => (
                                    <tr key={period.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5 font-semibold text-slate-900">{period.name}</td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(period.start_date)} – {formatDate(period.end_date)}</td>
                                        <td className="px-5 py-3.5"><Badge tone={period.status === 'closed' ? 'slate' : 'emerald'} dot>{period.status}</Badge></td>
                                        <td className="px-5 py-3.5 text-slate-600">{period.closed_by ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{period.closed_at ? formatDateTime(period.closed_at) : '—'}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            {period.status === 'closed' ? (
                                                <button type="button" onClick={() => reopenPeriod(period)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">Reopen</button>
                                            ) : (
                                                <button type="button" onClick={() => closePeriod(period)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300">Close period</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'rules' && (
                    <Card title="Posting rules" description="Map business events to default debit, credit and tax accounts.">
                        {postingRules.length === 0 ? <EmptyState title="No posting rules" description="Create a rule to standardise automated postings." icon={Cog6ToothIcon} /> : (
                            <Table head={['Event', 'Rule', 'Debit', 'Credit', 'Tax', 'Status']}>
                                {postingRules.map((rule) => (
                                    <tr key={rule.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{rule.event}</td>
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{rule.name}</p><p className="text-xs text-slate-500">{rule.description ?? '—'}</p></td>
                                        <td className="px-5 py-3.5 text-slate-600">{rule.debit_account ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{rule.credit_account ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{rule.tax_account ?? '—'}</td>
                                        <td className="px-5 py-3.5"><Badge tone={rule.is_active ? 'emerald' : 'slate'} dot>{rule.is_active ? 'active' : 'inactive'}</Badge></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'workflows' && (
                    <Card title="Approval workflows" description="Documents above the threshold are routed to the approver role before posting.">
                        {workflows.length === 0 ? <EmptyState title="No workflows" description="Create a workflow to require approvals." icon={ShieldCheckIcon} /> : (
                            <Table head={['Workflow', 'Type', 'Threshold', 'Approver role', 'Pending', 'Status']}>
                                {workflows.map((workflow) => (
                                    <tr key={workflow.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{workflow.name}</p><p className="text-xs text-slate-500">{workflow.description ?? '—'}</p></td>
                                        <td className="px-5 py-3.5 capitalize text-slate-600">{workflow.type}</td>
                                        <td className="px-5 py-3.5 text-right font-medium text-slate-900">{currency(workflow.threshold)}</td>
                                        <td className="px-5 py-3.5 capitalize text-slate-600">{workflow.approver_role}</td>
                                        <td className="px-5 py-3.5"><Badge tone={workflow.pending_count > 0 ? 'amber' : 'slate'}>{workflow.pending_count}</Badge></td>
                                        <td className="px-5 py-3.5"><Badge tone={workflow.is_active ? 'emerald' : 'slate'} dot>{workflow.is_active ? 'active' : 'inactive'}</Badge></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'approvals' && (
                    <Card title="Approval queue" description="Review and decide pending approval requests.">
                        {approvals.length === 0 ? <EmptyState title="No approval requests" description="Requests appear here when documents need approval." icon={ShieldCheckIcon} /> : (
                            <Table head={['Subject', 'Workflow', 'Requested by', 'Status', 'Decided', 'Actions']}>
                                {approvals.map((approval) => (
                                    <tr key={approval.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{approval.subject}</p><p className="text-xs text-slate-500">{approval.notes ?? '—'}</p></td>
                                        <td className="px-5 py-3.5 text-slate-600">{approval.workflow ?? '—'}<span className="block text-xs capitalize text-slate-400">{approval.type}</span></td>
                                        <td className="px-5 py-3.5 text-slate-600">{approval.requested_by ?? '—'}</td>
                                        <td className="px-5 py-3.5"><Badge tone={statusTone(approval.status)} dot>{approval.status}</Badge></td>
                                        <td className="px-5 py-3.5 text-slate-500">{approval.decided_at ? formatDateTime(approval.decided_at) : '—'}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            {approval.status === 'pending' ? (
                                                canApprove ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button type="button" onClick={() => { setDeciding(approval); decideForm.setData({ status: 'approved', notes: '' }); }} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                            <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
                                                        </button>
                                                        <button type="button" onClick={() => { setDeciding(approval); decideForm.setData({ status: 'rejected', notes: '' }); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                                                            <XCircleIcon className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Awaiting approver</span>
                                                )
                                            ) : (
                                                <span className="text-xs text-slate-400">{approval.approved_by ?? '—'}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}
            </div>

            <Modal open={modal === 'period'} onClose={() => setModal(null)} title="New accounting period" footer={<ActionFooter label="Create period" processing={periodForm.processing} form="period-form" onCancel={() => setModal(null)} />}>
                <form id="period-form" onSubmit={submitPeriod} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="period_name" value={periodForm.data.name} onChange={(e) => periodForm.setData('name', e.target.value)} placeholder="e.g. November 2026" error={periodForm.errors.name} className="sm:col-span-2" />
                        <TextInput label="Start date" id="period_start" type="date" value={periodForm.data.start_date} onChange={(e) => periodForm.setData('start_date', e.target.value)} error={periodForm.errors.start_date} />
                        <TextInput label="End date" id="period_end" type="date" value={periodForm.data.end_date} onChange={(e) => periodForm.setData('end_date', e.target.value)} error={periodForm.errors.end_date} />
                        <RichSelect
                            label="Status"
                            id="period_status"
                            value={periodForm.data.status}
                            onChange={(value) => periodForm.setData('status', value)}
                            error={periodForm.errors.status}
                            className="sm:col-span-2"
                            options={[
                                { value: 'open', primary: 'Open', badge: { label: 'Open', classes: 'bg-emerald-50 text-emerald-600' } },
                                { value: 'closed', primary: 'Closed', badge: { label: 'Closed', classes: 'bg-slate-100 text-slate-600' } },
                            ]}
                        />
                    </div>
                    <Textarea label="Notes" id="period_notes" value={periodForm.data.notes} onChange={(e) => periodForm.setData('notes', e.target.value)} error={periodForm.errors.notes} rows={3} />
                </form>
            </Modal>

            <Modal open={modal === 'rule'} onClose={() => setModal(null)} title="New posting rule" footer={<ActionFooter label="Create rule" processing={ruleForm.processing} form="rule-form" onCancel={() => setModal(null)} />}>
                <form id="rule-form" onSubmit={submitRule} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Event key" id="rule_event" value={ruleForm.data.event} onChange={(e) => ruleForm.setData('event', e.target.value)} placeholder="invoice.posted" error={ruleForm.errors.event} />
                        <TextInput label="Rule name" id="rule_name" value={ruleForm.data.name} onChange={(e) => ruleForm.setData('name', e.target.value)} error={ruleForm.errors.name} />
                        <RichSelect
                            label="Debit account"
                            id="rule_debit"
                            value={ruleForm.data.debit_account_id}
                            onChange={(value) => ruleForm.setData('debit_account_id', value)}
                            error={ruleForm.errors.debit_account_id}
                            placeholder="None"
                            emptyText="No accounts found"
                            options={accounts.map((account) => ({
                                value: account.id,
                                primary: account.name,
                                meta: account.code,
                            }))}
                        />
                        <RichSelect
                            label="Credit account"
                            id="rule_credit"
                            value={ruleForm.data.credit_account_id}
                            onChange={(value) => ruleForm.setData('credit_account_id', value)}
                            error={ruleForm.errors.credit_account_id}
                            placeholder="None"
                            emptyText="No accounts found"
                            options={accounts.map((account) => ({
                                value: account.id,
                                primary: account.name,
                                meta: account.code,
                            }))}
                        />
                        <RichSelect
                            label="Tax account"
                            id="rule_tax"
                            value={ruleForm.data.tax_account_id}
                            onChange={(value) => ruleForm.setData('tax_account_id', value)}
                            error={ruleForm.errors.tax_account_id}
                            placeholder="None"
                            emptyText="No accounts found"
                            className="sm:col-span-2"
                            options={accounts.map((account) => ({
                                value: account.id,
                                primary: account.name,
                                meta: account.code,
                            }))}
                        />
                    </div>
                    <Textarea label="Description" id="rule_description" value={ruleForm.data.description} onChange={(e) => ruleForm.setData('description', e.target.value)} error={ruleForm.errors.description} rows={3} />
                </form>
            </Modal>

            <Modal open={modal === 'workflow'} onClose={() => setModal(null)} title="New approval workflow" footer={<ActionFooter label="Create workflow" processing={workflowForm.processing} form="workflow-form" onCancel={() => setModal(null)} />}>
                <form id="workflow-form" onSubmit={submitWorkflow} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Workflow name" id="workflow_name" value={workflowForm.data.name} onChange={(e) => workflowForm.setData('name', e.target.value)} error={workflowForm.errors.name} className="sm:col-span-2" />
                        <RichSelect
                            label="Document type"
                            id="workflow_type"
                            value={workflowForm.data.type}
                            onChange={(value) => workflowForm.setData('type', value)}
                            error={workflowForm.errors.type}
                            emptyText="No types found"
                            options={types.map((type) => ({ value: type, primary: type }))}
                        />
                        <RichSelect
                            label="Approver role"
                            id="workflow_role"
                            value={workflowForm.data.approver_role}
                            onChange={(value) => workflowForm.setData('approver_role', value)}
                            error={workflowForm.errors.approver_role}
                            emptyText="No roles found"
                            options={roles.map((role) => ({ value: role, primary: role }))}
                        />
                        <TextInput label="Threshold" id="workflow_threshold" type="number" step="0.01" value={workflowForm.data.threshold} onChange={(e) => workflowForm.setData('threshold', e.target.value)} error={workflowForm.errors.threshold} className="sm:col-span-2" />
                    </div>
                    <Textarea label="Description" id="workflow_description" value={workflowForm.data.description} onChange={(e) => workflowForm.setData('description', e.target.value)} error={workflowForm.errors.description} rows={3} />
                </form>
            </Modal>

            <Modal open={deciding !== null} onClose={() => setDeciding(null)} title={decideForm.data.status === 'approved' ? 'Approve request' : 'Reject request'} description={deciding?.subject} footer={<ActionFooter label={decideForm.data.status === 'approved' ? 'Approve' : 'Reject'} processing={decideForm.processing} form="decide-form" onCancel={() => setDeciding(null)} />}>
                <form id="decide-form" onSubmit={submitDecision} className="space-y-4">
                    <RichSelect
                        label="Decision"
                        id="decision_status"
                        value={decideForm.data.status}
                        onChange={(value) => decideForm.setData('status', value)}
                        error={decideForm.errors.status}
                        options={[
                            { value: 'approved', primary: 'Approve', badge: { label: 'Approved', classes: 'bg-emerald-50 text-emerald-600' } },
                            { value: 'rejected', primary: 'Reject', badge: { label: 'Rejected', classes: 'bg-rose-50 text-rose-600' } },
                        ]}
                    />
                    <Textarea label="Notes" id="decision_notes" value={decideForm.data.notes} onChange={(e) => decideForm.setData('notes', e.target.value)} error={decideForm.errors.notes} rows={3} />
                </form>
            </Modal>
        </AppLayout>
    );
}

function Card({ title, description, children }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
                <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
            {children}
        </div>
    );
}

function Table({ head, children }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead>
                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {head.map((label) => <th key={label} className="px-5 py-3">{label}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{children}</tbody>
            </table>
        </div>
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
