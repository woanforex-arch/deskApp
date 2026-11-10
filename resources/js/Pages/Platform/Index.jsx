import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowPathIcon,
    ArrowUpTrayIcon,
    CheckCircleIcon,
    CircleStackIcon,
    CloudArrowUpIcon,
    ClipboardDocumentCheckIcon,
    EnvelopeIcon,
    LinkIcon,
    PlusIcon,
    ServerStackIcon,
    SignalIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea } from '../../Components/FormControls';
import { formatDate, formatDateTime, number } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

function bytes(value) {
    const size = Number(value ?? 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PlatformIndex({ integrations, webhooks, deliveries, scheduledReports, imports, backups, checklists, stats, integrationTypes, reportKeys, frequencies, events, importTypes }) {
    const [tab, setTab] = useState('integrations');
    const [modal, setModal] = useState(null);
    const [checklistFor, setChecklistFor] = useState(null);

    const integrationForm = useForm({ name: '', type: 'erp', provider: '', endpoint: '', api_key: '' });
    const webhookForm = useForm({ name: '', event: events[0] ?? '', url: '', secret: '' });
    const reportForm = useForm({ name: '', report: reportKeys[0] ?? '', recipients: '', frequency: 'monthly' });
    const importForm = useForm({ type: 'accounts', file: null });
    const checklistForm = useForm({ name: '', accounting_period_id: '', due_date: today(), tasks: '' });
    const taskForm = useForm({ title: '', owner: '' });

    const tabs = [
        { key: 'integrations', label: 'Integrations', count: integrations.length },
        { key: 'webhooks', label: 'Webhooks', count: webhooks.length },
        { key: 'scheduled', label: 'Scheduled reports', count: scheduledReports.length },
        { key: 'imports', label: 'Imports', count: imports.length },
        { key: 'backups', label: 'Backups', count: backups.length },
        { key: 'closing', label: 'Closing checklists', count: checklists.length },
    ];

    const submitIntegration = (event) => {
        event.preventDefault();
        integrationForm.post('/platform/integrations', { preserveScroll: true, onSuccess: () => { setModal(null); integrationForm.reset(); } });
    };
    const submitWebhook = (event) => {
        event.preventDefault();
        webhookForm.post('/platform/webhooks', { preserveScroll: true, onSuccess: () => { setModal(null); webhookForm.reset(); } });
    };
    const submitReport = (event) => {
        event.preventDefault();
        reportForm.post('/platform/scheduled-reports', { preserveScroll: true, onSuccess: () => { setModal(null); reportForm.reset(); } });
    };
    const submitImport = (event) => {
        event.preventDefault();
        importForm.post('/platform/imports', { preserveScroll: true, forceFormData: true, onSuccess: () => { setModal(null); importForm.reset(); } });
    };
    const submitChecklist = (event) => {
        event.preventDefault();
        checklistForm.transform((data) => ({
            ...data,
            tasks: data.tasks ? data.tasks.split('\n').map((task) => task.trim()).filter(Boolean) : [],
        }));
        checklistForm.post('/platform/closing-checklists', {
            preserveScroll: true,
            onSuccess: () => { setModal(null); checklistForm.reset(); },
        });
    };
    const submitTask = (event) => {
        event.preventDefault();
        taskForm.post(`/platform/closing-checklists/${checklistFor.id}/tasks`, { preserveScroll: true, onSuccess: () => taskForm.reset() });
    };

    const sync = (integration) => router.post(`/platform/integrations/${integration.id}/sync`, {}, { preserveScroll: true });
    const testWebhook = (webhook) => router.post(`/platform/webhooks/${webhook.id}/test`, {}, { preserveScroll: true });
    const backup = () => router.post('/platform/backups', {}, { preserveScroll: true });
    const completeTask = (checklist, task) => router.post(`/platform/closing-checklists/${checklist.id}/tasks/${task.id}/complete`, {}, { preserveScroll: true });

    return (
        <AppLayout>
            <Head title="Platform" />

            <div className="space-y-6">
                <PageHeader eyebrow="Platform" title="Integrations & automation" description="Connect external systems, deliver webhooks, schedule reports, import data, back up the ledger and run closing checklists.">
                    <button type="button" onClick={backup} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                        <CircleStackIcon className="h-4 w-4" />
                        Run backup
                    </button>
                    <button
                        type="button"
                        onClick={() => setModal(tab === 'webhooks' ? 'webhook' : tab === 'scheduled' ? 'report' : tab === 'imports' ? 'import' : tab === 'closing' ? 'checklist' : 'integration')}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New {tab === 'scheduled' ? 'schedule' : tab === 'closing' ? 'checklist' : tab === 'integrations' ? 'integration' : tab.slice(0, -1)}
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Connected systems" value={stats.integrations} hint="Live integrations" icon={SignalIcon} accent="emerald" />
                    <StatCard label="Active webhooks" value={stats.webhooks} hint="Event subscribers" icon={LinkIcon} accent="sky" />
                    <StatCard label="Scheduled reports" value={stats.scheduled} hint="Automated deliveries" icon={EnvelopeIcon} accent="violet" />
                    <StatCard label="Backups" value={stats.backups} hint="Snapshots retained" icon={CloudArrowUpIcon} accent="amber" />
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>
                            {item.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item.key ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>
                        </button>
                    ))}
                </div>

                {tab === 'integrations' && (
                    <Card title="Integrations" description="Sync with ERP, CRM, banking, payroll, tax and commerce systems.">
                        {integrations.length === 0 ? <EmptyState title="No integrations" description="Connect a system to synchronise data." icon={ServerStackIcon} /> : (
                            <Table head={['Integration', 'Type', 'Provider', 'Last sync', 'Status', 'Actions']}>
                                {integrations.map((integration) => (
                                    <tr key={integration.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{integration.name}</p><p className="text-xs text-slate-500">{integration.config?.endpoint ?? 'No endpoint configured'}</p></td>
                                        <td className="px-5 py-3.5 capitalize text-slate-600">{integration.type}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{integration.provider ?? '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{integration.last_synced_at ? formatDateTime(integration.last_synced_at) : 'Never'}</td>
                                        <td className="px-5 py-3.5"><Badge tone={integration.status === 'connected' ? 'emerald' : 'slate'} dot>{integration.status}</Badge></td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button type="button" onClick={() => sync(integration)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700">
                                                <ArrowPathIcon className="h-3.5 w-3.5" /> Sync
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'webhooks' && (
                    <div className="space-y-4">
                        <Card title="Webhooks" description="Subscribe external endpoints to accounting events.">
                            {webhooks.length === 0 ? <EmptyState title="No webhooks" description="Register an endpoint to receive events." icon={LinkIcon} /> : (
                                <Table head={['Name', 'Event', 'Endpoint', 'Triggered', 'Status', 'Actions']}>
                                    {webhooks.map((webhook) => (
                                        <tr key={webhook.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{webhook.name}</p><p className="text-xs text-slate-500">{webhook.deliveries_count} deliveries</p></td>
                                            <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{webhook.event}</td>
                                            <td className="max-w-[16rem] truncate px-5 py-3.5 text-slate-500">{webhook.url}</td>
                                            <td className="px-5 py-3.5 text-slate-500">{webhook.last_triggered_at ? formatDateTime(webhook.last_triggered_at) : 'Never'}</td>
                                            <td className="px-5 py-3.5"><Badge tone={webhook.is_active ? 'emerald' : 'slate'} dot>{webhook.is_active ? 'active' : 'inactive'}</Badge></td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button type="button" onClick={() => testWebhook(webhook)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700">Send test</button>
                                            </td>
                                        </tr>
                                    ))}
                                </Table>
                            )}
                        </Card>
                        <Card title="Recent deliveries" description="Delivery attempts logged with response status.">
                            {deliveries.length === 0 ? <EmptyState title="No deliveries yet" description="Test a webhook to see delivery logs." icon={SignalIcon} /> : (
                                <Table head={['Webhook', 'Event', 'Response', 'Delivered']}>
                                    {deliveries.map((delivery) => (
                                        <tr key={delivery.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3 text-slate-700">{delivery.webhook ?? '—'}</td>
                                            <td className="px-5 py-3 font-mono text-xs text-slate-600">{delivery.event}</td>
                                            <td className="px-5 py-3"><Badge tone={delivery.response_status && delivery.response_status < 400 ? 'emerald' : 'rose'}>{delivery.response_status ?? 'error'}</Badge></td>
                                            <td className="px-5 py-3 text-slate-500">{formatDateTime(delivery.delivered_at)}</td>
                                        </tr>
                                    ))}
                                </Table>
                            )}
                        </Card>
                    </div>
                )}

                {tab === 'scheduled' && (
                    <Card title="Scheduled reports" description="Deliver recurring financial reports to recipients automatically.">
                        {scheduledReports.length === 0 ? <EmptyState title="No scheduled reports" description="Schedule a report to automate delivery." icon={EnvelopeIcon} /> : (
                            <Table head={['Name', 'Report', 'Recipients', 'Frequency', 'Next run', 'Status']}>
                                {scheduledReports.map((report) => (
                                    <tr key={report.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-3.5 font-semibold text-slate-900">{report.name}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{report.report.replace(/-/g, ' ')}</td>
                                        <td className="max-w-[16rem] truncate px-5 py-3.5 text-slate-500">{report.recipients}</td>
                                        <td className="px-5 py-3.5 capitalize text-slate-600">{report.frequency}</td>
                                        <td className="px-5 py-3.5 text-slate-500">{formatDateTime(report.next_run_at)}</td>
                                        <td className="px-5 py-3.5"><Badge tone={report.is_active ? 'emerald' : 'slate'} dot>{report.is_active ? 'active' : 'paused'}</Badge></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </Card>
                )}

                {tab === 'imports' && (
                    <div className="space-y-4">
                        <Card title="Data imports" description="Import accounts and contacts from CSV/TXT files.">
                            {imports.length === 0 ? <EmptyState title="No imports" description="Upload a CSV or TXT file to import data." icon={ArrowUpTrayIcon} /> : (
                                <Table head={['Type', 'File', 'Rows', 'Importer', 'Status', 'Imported']}>
                                    {imports.map((item) => (
                                        <tr key={item.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3 capitalize text-slate-700">{item.type}</td>
                                            <td className="px-5 py-3 text-slate-600">{item.file_name}</td>
                                            <td className="px-5 py-3 text-slate-500">{number(item.rows_processed)}</td>
                                            <td className="px-5 py-3 text-slate-500">{item.importer ?? '—'}</td>
                                            <td className="px-5 py-3"><Badge tone={item.status === 'completed' ? 'emerald' : item.status === 'failed' ? 'rose' : 'amber'} dot>{item.status}</Badge></td>
                                            <td className="px-5 py-3 text-slate-500">{formatDateTime(item.created_at)}</td>
                                        </tr>
                                    ))}
                                </Table>
                            )}
                        </Card>
                        <Card title="Backups & retention" description="Snapshot the ledger and retain copies for disaster recovery.">
                            {backups.length === 0 ? <EmptyState title="No backups" description="Run a backup to create a retention snapshot." icon={CloudArrowUpIcon} /> : (
                                <Table head={['Name', 'Disk', 'Path', 'Size', 'Created by', 'Status', 'Created']}>
                                    {backups.map((item) => (
                                        <tr key={item.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3 font-semibold text-slate-900">{item.name}</td>
                                            <td className="px-5 py-3 text-slate-600">{item.disk}</td>
                                            <td className="max-w-[16rem] truncate px-5 py-3 font-mono text-xs text-slate-500">{item.path}</td>
                                            <td className="px-5 py-3 text-slate-500">{bytes(item.size)}</td>
                                            <td className="px-5 py-3 text-slate-500">{item.creator ?? '—'}</td>
                                            <td className="px-5 py-3"><Badge tone={item.status === 'completed' ? 'emerald' : 'amber'} dot>{item.status}</Badge></td>
                                            <td className="px-5 py-3 text-slate-500">{formatDateTime(item.created_at)}</td>
                                        </tr>
                                    ))}
                                </Table>
                            )}
                        </Card>
                    </div>
                )}

                {tab === 'closing' && (
                    <div className="space-y-4">
                        {checklists.length === 0 ? (
                            <Card title="Closing checklists" description="Track the steps required to close an accounting period.">
                                <EmptyState title="No closing checklists" description="Create a checklist to track period close tasks." icon={ClipboardDocumentCheckIcon} />
                            </Card>
                        ) : (
                            checklists.map((checklist) => (
                                <div key={checklist.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                        <div>
                                            <h2 className="font-display text-base font-semibold text-slate-900">{checklist.name}</h2>
                                            <p className="mt-0.5 text-xs text-slate-500">{checklist.period ?? 'No period'}{checklist.due_date ? ` · due ${formatDate(checklist.due_date)}` : ''} · {checklist.progress}% complete</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge tone={checklist.status === 'completed' ? 'emerald' : 'amber'} dot>{checklist.status.replace(/_/g, ' ')}</Badge>
                                            <button type="button" onClick={() => setChecklistFor(checklist)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">Add task</button>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-100">
                                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${checklist.progress}%` }} />
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {checklist.tasks.map((task) => (
                                            <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                                                <button type="button" onClick={() => completeTask(checklist, task)} className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-transparent hover:border-emerald-400'}`}>
                                                    <CheckCircleIcon className="h-4 w-4" />
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm ${task.status === 'done' ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>{task.title}</p>
                                                    <p className="text-xs text-slate-400">{task.owner ? `Owner: ${task.owner}` : 'Unassigned'}{task.notes ? ` · ${task.notes}` : ''}</p>
                                                </div>
                                                <Badge tone={task.status === 'done' ? 'emerald' : 'slate'}>{task.status}</Badge>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <Modal open={modal === 'integration'} onClose={() => setModal(null)} title="New integration" footer={<ActionFooter label="Create integration" processing={integrationForm.processing} form="integration-form" onCancel={() => setModal(null)} />}>
                <form id="integration-form" onSubmit={submitIntegration} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="integration_name" value={integrationForm.data.name} onChange={(e) => integrationForm.setData('name', e.target.value)} error={integrationForm.errors.name} />
                        <Select label="Type" id="integration_type" value={integrationForm.data.type} onChange={(e) => integrationForm.setData('type', e.target.value)} error={integrationForm.errors.type}>
                            {integrationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </Select>
                        <TextInput label="Provider" id="integration_provider" value={integrationForm.data.provider} onChange={(e) => integrationForm.setData('provider', e.target.value)} error={integrationForm.errors.provider} />
                        <TextInput label="Endpoint" id="integration_endpoint" value={integrationForm.data.endpoint} onChange={(e) => integrationForm.setData('endpoint', e.target.value)} placeholder="https://" error={integrationForm.errors.endpoint} />
                        <TextInput label="API key" id="integration_key" type="password" value={integrationForm.data.api_key} onChange={(e) => integrationForm.setData('api_key', e.target.value)} error={integrationForm.errors.api_key} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'webhook'} onClose={() => setModal(null)} title="Register webhook" footer={<ActionFooter label="Register" processing={webhookForm.processing} form="webhook-form" onCancel={() => setModal(null)} />}>
                <form id="webhook-form" onSubmit={submitWebhook} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="webhook_name" value={webhookForm.data.name} onChange={(e) => webhookForm.setData('name', e.target.value)} error={webhookForm.errors.name} />
                        <Select label="Event" id="webhook_event" value={webhookForm.data.event} onChange={(e) => webhookForm.setData('event', e.target.value)} error={webhookForm.errors.event}>
                            {events.map((event) => <option key={event} value={event}>{event}</option>)}
                        </Select>
                        <TextInput label="Endpoint URL" id="webhook_url" value={webhookForm.data.url} onChange={(e) => webhookForm.setData('url', e.target.value)} placeholder="https://" error={webhookForm.errors.url} className="sm:col-span-2" />
                        <TextInput label="Signing secret" id="webhook_secret" type="password" value={webhookForm.data.secret} onChange={(e) => webhookForm.setData('secret', e.target.value)} error={webhookForm.errors.secret} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'report'} onClose={() => setModal(null)} title="Schedule report" footer={<ActionFooter label="Schedule" processing={reportForm.processing} form="schedule-form" onCancel={() => setModal(null)} />}>
                <form id="schedule-form" onSubmit={submitReport} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="report_name" value={reportForm.data.name} onChange={(e) => reportForm.setData('name', e.target.value)} error={reportForm.errors.name} />
                        <Select label="Report" id="report_key" value={reportForm.data.report} onChange={(e) => reportForm.setData('report', e.target.value)} error={reportForm.errors.report}>
                            {reportKeys.map((key) => <option key={key} value={key}>{key.replace(/-/g, ' ')}</option>)}
                        </Select>
                        <TextInput label="Recipients" id="report_recipients" value={reportForm.data.recipients} onChange={(e) => reportForm.setData('recipients', e.target.value)} placeholder="finance@example.com" error={reportForm.errors.recipients} className="sm:col-span-2" />
                        <Select label="Frequency" id="report_frequency" value={reportForm.data.frequency} onChange={(e) => reportForm.setData('frequency', e.target.value)} error={reportForm.errors.frequency} className="sm:col-span-2">
                            {frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
                        </Select>
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import data" description="Upload a CSV or TXT file with a header row." footer={<ActionFooter label="Upload & import" processing={importForm.processing} form="import-form" onCancel={() => setModal(null)} />}>
                <form id="import-form" onSubmit={submitImport} className="space-y-4">
                    <Select label="Import type" id="import_type" value={importForm.data.type} onChange={(e) => importForm.setData('type', e.target.value)} error={importForm.errors.type}>
                        {importTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </Select>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="import_file">File</label>
                        <input id="import_file" type="file" accept=".csv,.txt" onChange={(e) => importForm.setData('file', e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                        {importForm.errors.file && <p className="mt-1.5 text-xs font-medium text-rose-600">{importForm.errors.file}</p>}
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'checklist'} onClose={() => setModal(null)} title="New closing checklist" description="Optionally list one task per line; default tasks are added if left blank." footer={<ActionFooter label="Create checklist" processing={checklistForm.processing} form="checklist-form" onCancel={() => setModal(null)} />}>
                <form id="checklist-form" onSubmit={submitChecklist} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="checklist_name" value={checklistForm.data.name} onChange={(e) => checklistForm.setData('name', e.target.value)} error={checklistForm.errors.name} />
                        <TextInput label="Due date" id="checklist_due" type="date" value={checklistForm.data.due_date} onChange={(e) => checklistForm.setData('due_date', e.target.value)} error={checklistForm.errors.due_date} />
                    </div>
                    <Textarea label="Tasks" id="checklist_tasks" value={checklistForm.data.tasks} onChange={(e) => checklistForm.setData('tasks', e.target.value)} placeholder="One task per line" error={checklistForm.errors.tasks} rows={5} />
                </form>
            </Modal>

            <Modal open={checklistFor !== null} onClose={() => setChecklistFor(null)} title="Add closing task" description={checklistFor?.name} footer={<ActionFooter label="Add task" processing={taskForm.processing} form="task-form" onCancel={() => setChecklistFor(null)} />}>
                <form id="task-form" onSubmit={submitTask} className="space-y-4">
                    <TextInput label="Task" id="task_title" value={taskForm.data.title} onChange={(e) => taskForm.setData('title', e.target.value)} error={taskForm.errors.title} />
                    <TextInput label="Owner" id="task_owner" value={taskForm.data.owner} onChange={(e) => taskForm.setData('owner', e.target.value)} error={taskForm.errors.owner} />
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
                {processing ? 'Working…' : label}
            </button>
        </>
    );
}
