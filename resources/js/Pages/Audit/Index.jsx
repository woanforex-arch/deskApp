import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { ClockIcon, FingerPrintIcon, MagnifyingGlassIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import Pagination from '../../Components/Pagination';
import { Select, TextInput } from '../../Components/FormControls';
import { formatDateTime } from '../../lib/format';

export default function AuditIndex({ logs, filters, stats, users, actions }) {
    const [form, setForm] = useState({
        action: filters.action ?? '',
        user_id: filters.user_id ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
    });
    const [selected, setSelected] = useState(null);

    const apply = (event) => {
        event.preventDefault();
        const query = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '' && value !== null));
        router.get('/audit', query, { preserveState: true, preserveScroll: true, replace: true });
    };

    const reset = () => {
        setForm({ action: '', user_id: '', from: '', to: '' });
        router.get('/audit', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const hasFilters = Boolean(filters.action || filters.user_id || filters.from || filters.to);

    return (
        <AppLayout>
            <Head title="Audit history" />

            <div className="space-y-6">
                <PageHeader eyebrow="Controls" title="Audit history" description="An immutable trail of every important action, who performed it and what changed." />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Events" value={stats.total} hint="All recorded audit events" icon={FingerPrintIcon} accent="brand" />
                    <StatCard label="Today" value={stats.today} hint="Events in the last 24h" icon={ClockIcon} accent="sky" />
                    <StatCard label="Action types" value={stats.actions} hint="Distinct event categories" icon={ShieldCheckIcon} accent="violet" />
                    <StatCard label="Users" value={stats.users} hint="Actors captured" icon={UserCircleIcon} accent="emerald" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <Select label="Action" id="filter_action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                                <option value="">All actions</option>
                                {actions.map((action) => <option key={action} value={action}>{action}</option>)}
                            </Select>
                            <Select label="User" id="filter_user" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                                <option value="">All users</option>
                                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                            </Select>
                            <TextInput label="From" id="filter_from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                            <TextInput label="To" id="filter_to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                            <div className="flex items-end gap-2">
                                <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                                    <MagnifyingGlassIcon className="h-4 w-4" /> Filter
                                </button>
                                {hasFilters && (
                                    <button type="button" onClick={reset} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">Reset</button>
                                )}
                            </div>
                        </form>
                    </div>

                    {logs.data.length === 0 ? (
                        <EmptyState title={hasFilters ? 'No events match your filters' : 'No audit events yet'} description="Activity will be recorded here as users work in the ledger." icon={FingerPrintIcon} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">When</th>
                                            <th className="px-5 py-3">Action</th>
                                            <th className="px-5 py-3">Summary</th>
                                            <th className="px-5 py-3">Subject</th>
                                            <th className="px-5 py-3">User</th>
                                            <th className="px-5 py-3">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.data.map((log) => (
                                            <tr key={log.id} className="cursor-pointer transition hover:bg-slate-50/70" onClick={() => setSelected(log)}>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDateTime(log.created_at)}</td>
                                                <td className="px-5 py-3.5"><Badge tone="sky">{log.action}</Badge></td>
                                                <td className="max-w-[18rem] truncate px-5 py-3.5 text-slate-700">{log.description ?? '—'}</td>
                                                <td className="px-5 py-3.5 text-slate-500">{log.subject ?? '—'}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{log.user ?? 'System'}</td>
                                                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{log.ip_address ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination paginator={logs} />
                        </>
                    )}
                </div>
            </div>

            <Modal open={selected !== null} onClose={() => setSelected(null)} title="Audit event detail" description={selected?.action} size="lg">
                {selected && (
                    <div className="space-y-4 text-sm">
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">When</dt><dd className="mt-1 text-slate-800">{formatDateTime(selected.created_at)}</dd></div>
                            <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">User</dt><dd className="mt-1 text-slate-800">{selected.user ?? 'System'}</dd></div>
                            <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</dt><dd className="mt-1 text-slate-800">{selected.subject ?? '—'}</dd></div>
                            <div><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">IP address</dt><dd className="mt-1 font-mono text-slate-800">{selected.ip_address ?? '—'}</dd></div>
                        </dl>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
                            <p className="mt-1 text-slate-800">{selected.description ?? '—'}</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Before</p>
                                <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-200">{selected.old_values ? JSON.stringify(selected.old_values, null, 2) : '—'}</pre>
                            </div>
                            <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">After</p>
                                <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-200">{selected.new_values ? JSON.stringify(selected.new_values, null, 2) : '—'}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}
