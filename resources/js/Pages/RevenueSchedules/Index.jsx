import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowTrendingUpIcon, BanknotesIcon, CalendarDaysIcon, PlusIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput } from '../../Components/FormControls';
import { currency, formatDate, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function RevenueSchedulesIndex({ schedules, entries, filters, stats, invoices, statuses, methods }) {
    const [open, setOpen] = useState(false);
    const [recognizeFor, setRecognizeFor] = useState(null);

    const form = useForm({
        invoice_id: '',
        name: '',
        total_amount: '',
        start_date: today(),
        end_date: today(),
        method: 'straight_line',
    });

    const recognizeForm = useForm({ amount: '', recognition_date: today() });

    const applyFilter = (key, value) => {
        router.get('/revenue-schedules', { ...filters, [key]: value || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submit = (event) => {
        event.preventDefault();
        form.post('/revenue-schedules', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    const openRecognize = (schedule) => {
        setRecognizeFor(schedule);
        recognizeForm.setData({
            amount: Math.max(0, Number(schedule.deferred_amount)).toFixed(2),
            recognition_date: today(),
        });
    };

    const submitRecognition = (event) => {
        event.preventDefault();
        recognizeForm.post(`/revenue-schedules/${recognizeFor.id}/recognize`, {
            preserveScroll: true,
            onSuccess: () => {
                setRecognizeFor(null);
                recognizeForm.reset();
            },
        });
    };

    return (
        <AppLayout>
            <Head title="Revenue recognition" />

            <div className="space-y-6">
                <PageHeader eyebrow="Planning" title="Revenue recognition" description="Spread contracted revenue across periods and release it from deferred income as it is earned.">
                    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        New schedule
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Contracted" value={currency(stats.total)} hint="Total value of schedules" icon={ReceiptPercentIcon} accent="brand" />
                    <StatCard label="Recognised" value={currency(stats.recognized)} hint="Revenue earned to date" icon={ArrowTrendingUpIcon} accent="emerald" />
                    <StatCard label="Deferred" value={currency(stats.deferred)} hint="Unearned balance" icon={BanknotesIcon} accent="amber" />
                    <StatCard label="Active" value={stats.active} hint="Schedules in progress" icon={CalendarDaysIcon} accent="sky" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Schedules</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Recognise revenue in whole or in part against each schedule.</p>
                        </div>
                        <select value={filters.status ?? ''} onChange={(e) => applyFilter('status', e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                            <option value="">All statuses</option>
                            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </div>

                    {schedules.length === 0 ? (
                        <EmptyState title="No revenue schedules" description="Create a schedule to defer and recognise revenue over time." icon={ReceiptPercentIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Schedule</th>
                                        <th className="px-5 py-3">Invoice</th>
                                        <th className="px-5 py-3">Period</th>
                                        <th className="px-5 py-3 text-right">Total</th>
                                        <th className="px-5 py-3 text-right">Recognised</th>
                                        <th className="px-5 py-3 text-right">Deferred</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {schedules.map((schedule) => (
                                        <tr key={schedule.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{schedule.name}</p>
                                                <p className="text-xs capitalize text-slate-500">{schedule.method.replace(/_/g, ' ')}{schedule.months_remaining != null ? ` · ${schedule.months_remaining} mo left` : ''}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">{schedule.invoice ?? '—'}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(schedule.start_date)} – {formatDate(schedule.end_date)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(schedule.total_amount)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-emerald-600">{currency(schedule.recognized_amount)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-amber-600">{currency(schedule.deferred_amount)}</td>
                                            <td className="px-5 py-3.5"><Badge tone={statusTone(schedule.status)} dot>{schedule.status}</Badge></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                {schedule.status !== 'completed' && Number(schedule.deferred_amount) > 0 && (
                                                    <button type="button" onClick={() => openRecognize(schedule)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                        Recognise
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <h2 className="font-display text-base font-semibold text-slate-900">Recognition history</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Posted revenue recognition entries.</p>
                    </div>
                    {entries.length === 0 ? (
                        <EmptyState title="No recognition entries yet" description="Recognised revenue will appear here." icon={CalendarDaysIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3">Schedule</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(entry.recognition_date)}</td>
                                            <td className="px-5 py-3 text-slate-700">{entry.schedule ?? '—'}</td>
                                            <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900">{currency(entry.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={open} onClose={() => setOpen(false)} title="New revenue schedule" description="Defer invoiced revenue and recognise it over the service period." footer={<ActionFooter label="Create schedule" processing={form.processing} form="revenue-form" onCancel={() => setOpen(false)} />}>
                <form id="revenue-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Invoice" id="invoice_id" value={form.data.invoice_id} onChange={(e) => form.setData('invoice_id', e.target.value)} error={form.errors.invoice_id} className="sm:col-span-2">
                            <option value="">No linked invoice</option>
                            {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · {currency(invoice.total, invoice.currency)}</option>)}
                        </Select>
                        <TextInput label="Schedule name" id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} error={form.errors.name} className="sm:col-span-2" />
                        <TextInput label="Total amount" id="total_amount" type="number" step="0.01" value={form.data.total_amount} onChange={(e) => form.setData('total_amount', e.target.value)} error={form.errors.total_amount} />
                        <Select label="Method" id="method" value={form.data.method} onChange={(e) => form.setData('method', e.target.value)} error={form.errors.method}>
                            {methods.map((method) => <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>)}
                        </Select>
                        <TextInput label="Start date" id="start_date" type="date" value={form.data.start_date} onChange={(e) => form.setData('start_date', e.target.value)} error={form.errors.start_date} />
                        <TextInput label="End date" id="end_date" type="date" value={form.data.end_date} onChange={(e) => form.setData('end_date', e.target.value)} error={form.errors.end_date} />
                    </div>
                </form>
            </Modal>

            <Modal open={recognizeFor !== null} onClose={() => setRecognizeFor(null)} title="Recognise revenue" description={recognizeFor ? `${recognizeFor.name} · ${currency(recognizeFor.deferred_amount)} deferred.` : ''} footer={<ActionFooter label="Post recognition" processing={recognizeForm.processing} form="recognize-form" onCancel={() => setRecognizeFor(null)} />}>
                <form id="recognize-form" onSubmit={submitRecognition} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={recognizeForm.data.amount} onChange={(e) => recognizeForm.setData('amount', e.target.value)} error={recognizeForm.errors.amount} />
                        <TextInput label="Recognition date" id="recognition_date" type="date" value={recognizeForm.data.recognition_date} onChange={(e) => recognizeForm.setData('recognition_date', e.target.value)} error={recognizeForm.errors.recognition_date} />
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
