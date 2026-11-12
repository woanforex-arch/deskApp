import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { CalculatorIcon, CheckCircleIcon, ClockIcon, PlusIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function TaxIndex({ rates, remittances, vat, filters, stats, accounts, types, periods }) {
    const page = usePage();
    const canWrite = page.props.auth?.user?.can_write;
    const [modal, setModal] = useState(null);
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const rateForm = useForm({ name: '', code: '', rate: 0, type: 'vat', account_id: '' });
    const remittanceForm = useForm({ tax_rate_id: '', name: '', period: currentPeriod(), due_date: today(), amount: 0 });

    const applyDates = (event) => {
        event?.preventDefault();
        router.get('/tax', { ...(from ? { from } : {}), ...(to ? { to } : {}) }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitRate = (e) => {
        e.preventDefault();
        rateForm.post('/tax/rates', { preserveScroll: true, onSuccess: () => { setModal(null); rateForm.reset(); } });
    };
    const submitRemittance = (e) => {
        e.preventDefault();
        remittanceForm.post('/tax/remittances', { preserveScroll: true, onSuccess: () => { setModal(null); remittanceForm.reset(); } });
    };
    const remit = (remittance) => {
        if (confirm(`Post remittance ${remittance.name} to the ledger?`)) {
            router.post(`/tax/remittances/${remittance.id}/remit`, {}, { preserveScroll: true });
        }
    };

    return (
        <AppLayout>
            <Head title="Tax" />

            <div className="space-y-6">
                <PageHeader eyebrow="Payroll & tax" title="Tax & VAT" description="Tax rates, VAT returns, and remittance tracking with ledger posting.">
                    {canWrite && (
                        <button type="button" onClick={() => setModal('rate')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                            <PlusIcon className="h-4 w-4" />
                            New tax rate
                        </button>
                    )}
                    {canWrite && (
                        <button type="button" onClick={() => setModal('remittance')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <PlusIcon className="h-4 w-4" />
                            Schedule remittance
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Active rates" value={stats.rates} hint="Configured tax rates" icon={ReceiptPercentIcon} accent="brand" />
                    <StatCard label="Pending remittance" value={currency(stats.pending)} hint="Scheduled and unpaid" icon={ClockIcon} accent="amber" />
                    <StatCard label="Remitted" value={currency(stats.remitted)} hint="Paid to the authority" icon={CheckCircleIcon} accent="emerald" />
                    <StatCard label="Net VAT" value={currency(stats.net_vat)} hint="For the selected period" icon={CalculatorIcon} accent="violet" />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">VAT return</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Output VAT less input VAT for the selected range.</p>
                        </div>
                        <form onSubmit={applyDates} className="flex flex-wrap items-center gap-2">
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500" />
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500" />
                            <button type="submit" className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Apply</button>
                        </form>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Output VAT</p>
                            <p className="mt-1 font-display text-xl font-semibold text-slate-900">{currency(vat.output_tax)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Input VAT</p>
                            <p className="mt-1 font-display text-xl font-semibold text-slate-900">{currency(vat.input_tax)}</p>
                        </div>
                        <div className={`rounded-xl p-4 ${vat.status === 'payable' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{vat.status === 'payable' ? 'Net payable' : 'Net refundable'}</p>
                            <p className="mt-1 font-display text-xl font-semibold text-slate-900">{currency(Math.abs(vat.net_payable))}</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Period {formatDate(vat.from)} – {formatDate(vat.to)}</p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="border-b border-slate-100 p-4 sm:p-5">
                            <h2 className="font-display text-base font-semibold text-slate-900">Tax rates</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Rates applied to invoices, bills, and payroll.</p>
                        </div>
                        {rates.length === 0 ? (
                            <EmptyState title="No tax rates" description="Create a tax rate to apply it to transactions." icon={ReceiptPercentIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Rate</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3 text-right">Percent</th>
                                            <th className="px-5 py-3">Account</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rates.map((rate) => (
                                            <tr key={rate.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-semibold text-slate-900">{rate.name}</p>
                                                    <p className="text-xs text-slate-500">{rate.code}</p>
                                                </td>
                                                <td className="px-5 py-3.5 capitalize text-slate-500">{rate.type.replace(/_/g, ' ')}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{rate.rate}%</td>
                                                <td className="px-5 py-3.5 text-slate-500">{rate.account ?? '—'}</td>
                                                <td className="px-5 py-3.5"><Badge tone={rate.is_active ? 'emerald' : 'slate'} dot>{rate.is_active ? 'Active' : 'Inactive'}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="border-b border-slate-100 p-4 sm:p-5">
                            <h2 className="font-display text-base font-semibold text-slate-900">Remittances</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Scheduled tax payments and their status.</p>
                        </div>
                        {remittances.length === 0 ? (
                            <EmptyState title="No remittances" description="Schedule a tax remittance to track its due date." icon={ClockIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Remittance</th>
                                            <th className="px-5 py-3">Period</th>
                                            <th className="px-5 py-3">Due</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {remittances.map((remittance) => (
                                            <tr key={remittance.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-medium text-slate-900">{remittance.name}</p>
                                                    <p className="text-xs text-slate-500">{remittance.rate ?? '—'}</p>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{remittance.period}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(remittance.due_date)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(remittance.amount)}</td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={remittance.status === 'remitted' ? 'emerald' : 'amber'} dot>{remittance.status}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    {remittance.status !== 'remitted' && canWrite ? (
                                                        <button type="button" onClick={() => remit(remittance)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                            Mark remitted
                                                        </button>
                                                    ) : remittance.status === 'remitted' ? (
                                                        <span className="text-xs text-slate-400">{remittance.remitted_at ? formatDateTime(remittance.remitted_at) : 'Paid'}</span>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal open={modal === 'rate'} onClose={() => setModal(null)} title="New tax rate" footer={<Footer label="Create rate" processing={rateForm.processing} form="rate-form" onCancel={() => setModal(null)} />}>
                <form id="rate-form" onSubmit={submitRate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="name" value={rateForm.data.name} onChange={(e) => rateForm.setData('name', e.target.value)} error={rateForm.errors.name} />
                        <TextInput label="Code" id="code" value={rateForm.data.code} onChange={(e) => rateForm.setData('code', e.target.value)} error={rateForm.errors.code} />
                        <TextInput label="Rate (%)" id="rate" type="number" step="0.01" value={rateForm.data.rate} onChange={(e) => rateForm.setData('rate', e.target.value)} error={rateForm.errors.rate} />
                        <Select label="Type" id="type" value={rateForm.data.type} onChange={(e) => rateForm.setData('type', e.target.value)} error={rateForm.errors.type}>
                            {types.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                        </Select>
                        <Select label="Tax account" id="account_id" value={rateForm.data.account_id} onChange={(e) => rateForm.setData('account_id', e.target.value)} error={rateForm.errors.account_id} className="sm:col-span-2">
                            <option value="">Default</option>
                            {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                        </Select>
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'remittance'} onClose={() => setModal(null)} title="Schedule tax remittance" footer={<Footer label="Schedule" processing={remittanceForm.processing} form="remittance-form" onCancel={() => setModal(null)} />}>
                <form id="remittance-form" onSubmit={submitRemittance} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Tax rate" id="tax_rate_id" value={remittanceForm.data.tax_rate_id} onChange={(e) => remittanceForm.setData('tax_rate_id', e.target.value)} error={remittanceForm.errors.tax_rate_id} className="sm:col-span-2">
                            <option value="">No specific rate</option>
                            {rates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {rate.rate}%</option>)}
                        </Select>
                        <TextInput label="Name" id="name" value={remittanceForm.data.name} onChange={(e) => remittanceForm.setData('name', e.target.value)} error={remittanceForm.errors.name} className="sm:col-span-2" />
                        <Select label="Period" id="period" value={remittanceForm.data.period} onChange={(e) => remittanceForm.setData('period', e.target.value)} error={remittanceForm.errors.period}>
                            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
                        </Select>
                        <TextInput label="Due date" id="due_date" type="date" value={remittanceForm.data.due_date} onChange={(e) => remittanceForm.setData('due_date', e.target.value)} error={remittanceForm.errors.due_date} />
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={remittanceForm.data.amount} onChange={(e) => remittanceForm.setData('amount', e.target.value)} error={remittanceForm.errors.amount} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}

function Footer({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">Cancel</button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Working…' : label}
            </button>
        </>
    );
}
