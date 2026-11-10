import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowsRightLeftIcon, BanknotesIcon, GlobeAltIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput } from '../../Components/FormControls';
import { formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function CurrenciesIndex({ currencies, rates, stats, sources }) {
    const [modal, setModal] = useState(null);
    const [editing, setEditing] = useState(null);

    const blankCurrency = { code: '', name: '', symbol: '', rate_to_base: 1, is_base: false };
    const currencyForm = useForm({ ...blankCurrency });
    const rateForm = useForm({ currency_code: currencies.find((currency) => !currency.is_base)?.code ?? '', rate: '', effective_date: today(), source: 'manual' });

    const openCreate = () => {
        setEditing(null);
        currencyForm.setData({ ...blankCurrency });
        currencyForm.clearErrors();
        setModal('currency');
    };

    const openEdit = (currency) => {
        setEditing(currency);
        currencyForm.setData({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol ?? '',
            rate_to_base: currency.rate_to_base,
        });
        currencyForm.clearErrors();
        setModal('currency');
    };

    const closeModal = () => {
        setModal(null);
        setEditing(null);
    };

    const submitCurrency = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                currencyForm.reset();
                closeModal();
            },
        };

        if (editing) {
            currencyForm.put(`/currencies/${editing.id}`, options);
        } else {
            currencyForm.post('/currencies', options);
        }
    };

    const submitRate = (event) => {
        event.preventDefault();
        rateForm.post('/currencies/rates', { preserveScroll: true, onSuccess: () => { setModal(null); rateForm.reset(); } });
    };
    const toggle = (currency) => router.post(`/currencies/${currency.id}/toggle`, {}, { preserveScroll: true });
    const remove = (currency) => {
        if (confirm(`Delete ${currency.code} and its exchange-rate history? Transactions already posted keep their currency code.`)) {
            router.delete(`/currencies/${currency.id}`, { preserveScroll: true });
        }
    };

    return (
        <AppLayout>
            <Head title="Currencies & FX" />

            <div className="space-y-6">
                <PageHeader eyebrow="Organisation" title="Currencies & FX" description="Maintain multi-currency settings, base currency and dated exchange rates.">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                            <PlusIcon className="h-4 w-4" />
                            Add currency
                        </button>
                        <button type="button" onClick={() => setModal('rate')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <ArrowsRightLeftIcon className="h-4 w-4" />
                            Record rate
                        </button>
                    </div>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Base currency" value={stats.base} hint="Functional reporting currency" icon={GlobeAltIcon} accent="brand" />
                    <StatCard label="Currencies" value={stats.currencies} hint="Configured in the ledger" icon={BanknotesIcon} accent="sky" />
                    <StatCard label="Active" value={stats.active} hint="Available for transactions" icon={ArrowsRightLeftIcon} accent="emerald" />
                    <StatCard label="Exchange rates" value={stats.rates} hint="Dated rate records" icon={ArrowsRightLeftIcon} accent="violet" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <h2 className="font-display text-base font-semibold text-slate-900">Currencies</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Rates express one unit of the currency in the base currency.</p>
                    </div>
                    {currencies.length === 0 ? (
                        <EmptyState title="No currencies" description="Add a currency to begin multi-currency accounting." icon={GlobeAltIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Currency</th>
                                        <th className="px-5 py-3">Symbol</th>
                                        <th className="px-5 py-3 text-right">Rate to base</th>
                                        <th className="px-5 py-3 text-right">Latest rate</th>
                                        <th className="px-5 py-3 text-right">Records</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currencies.map((currency) => (
                                        <tr key={currency.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{currency.code} {currency.is_base && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">BASE</span>}</p>
                                                <p className="text-xs text-slate-500">{currency.name}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">{currency.symbol ?? '—'}</td>
                                            <td className="px-5 py-3.5 text-right text-slate-600">{Number(currency.rate_to_base).toFixed(4)}</td>
                                            <td className="px-5 py-3.5 text-right font-medium text-slate-900">{Number(currency.latest_rate).toFixed(4)}</td>
                                            <td className="px-5 py-3.5 text-right text-slate-500">{currency.rates_count}</td>
                                            <td className="px-5 py-3.5"><Badge tone={currency.is_active ? 'emerald' : 'slate'} dot>{currency.is_active ? 'active' : 'inactive'}</Badge></td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(currency)}
                                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                                                        title="Edit currency"
                                                    >
                                                        <PencilSquareIcon className="h-4 w-4" />
                                                    </button>
                                                    {!currency.is_base && (
                                                        <>
                                                            <button type="button" onClick={() => toggle(currency)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300">
                                                                {currency.is_active ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(currency)}
                                                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                title={`Delete ${currency.code}`}
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
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <h2 className="font-display text-base font-semibold text-slate-900">Exchange rate history</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Dated rates used to translate foreign currency transactions.</p>
                    </div>
                    {rates.length === 0 ? (
                        <EmptyState title="No exchange rates" description="Record a rate to support foreign currency postings." icon={ArrowsRightLeftIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Currency</th>
                                        <th className="px-5 py-3">Effective date</th>
                                        <th className="px-5 py-3 text-right">Rate</th>
                                        <th className="px-5 py-3">Source</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rates.map((rate) => (
                                        <tr key={rate.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3 font-semibold text-slate-900">{rate.currency_code}</td>
                                            <td className="px-5 py-3 text-slate-500">{formatDate(rate.effective_date)}</td>
                                            <td className="px-5 py-3 text-right text-slate-700">{Number(rate.rate).toFixed(4)}</td>
                                            <td className="px-5 py-3 capitalize text-slate-500">{rate.source ?? 'manual'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={modal === 'currency'}
                onClose={closeModal}
                title={editing ? `Edit ${editing.code}` : 'Add currency'}
                description={editing
                    ? 'Update the currency details. Postage-safe: the code cannot change while the currency is in use.'
                    : 'Rates express one unit of this currency in the base currency.'}
                footer={<ActionFooter label={editing ? 'Save changes' : 'Add currency'} processing={currencyForm.processing} form="currency-form" onCancel={closeModal} />}
            >
                <form id="currency-form" onSubmit={submitCurrency} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Code"
                            id="currency_code"
                            value={currencyForm.data.code}
                            onChange={(e) => currencyForm.setData('code', e.target.value.toUpperCase())}
                            maxLength={3}
                            error={currencyForm.errors.code}
                            disabled={Boolean(editing?.is_base) || Boolean(editing?.in_use)}
                            hint={editing?.is_base ? 'The base currency code cannot change.' : editing?.in_use ? 'This code is in use and cannot change.' : undefined}
                        />
                        <TextInput label="Name" id="currency_name" value={currencyForm.data.name} onChange={(e) => currencyForm.setData('name', e.target.value)} error={currencyForm.errors.name} required />
                        <TextInput label="Symbol" id="currency_symbol" value={currencyForm.data.symbol} onChange={(e) => currencyForm.setData('symbol', e.target.value)} error={currencyForm.errors.symbol} />
                        <TextInput
                            label="Rate to base"
                            id="rate_to_base"
                            type="number"
                            step="0.0001"
                            value={currencyForm.data.rate_to_base}
                            onChange={(e) => currencyForm.setData('rate_to_base', e.target.value)}
                            error={currencyForm.errors.rate_to_base}
                            disabled={Boolean(editing?.is_base)}
                            hint={editing?.is_base ? 'The base currency always has a rate of 1.' : undefined}
                        />
                    </div>
                    {!editing && (
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={currencyForm.data.is_base}
                                onChange={(e) => currencyForm.setData('is_base', e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            Set as base currency
                        </label>
                    )}
                </form>
            </Modal>

            <Modal open={modal === 'rate'} onClose={() => setModal(null)} title="Record exchange rate" footer={<ActionFooter label="Save rate" processing={rateForm.processing} form="rate-form" onCancel={() => setModal(null)} />}>
                <form id="rate-form" onSubmit={submitRate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Currency" id="rate_currency" value={rateForm.data.currency_code} onChange={(e) => rateForm.setData('currency_code', e.target.value)} error={rateForm.errors.currency_code}>
                            <option value="">Select currency</option>
                            {currencies.filter((currency) => !currency.is_base).map((currency) => <option key={currency.id} value={currency.code}>{currency.code} · {currency.name}</option>)}
                        </Select>
                        <TextInput label="Rate to base" id="rate_value" type="number" step="0.0001" value={rateForm.data.rate} onChange={(e) => rateForm.setData('rate', e.target.value)} error={rateForm.errors.rate} />
                        <TextInput label="Effective date" id="effective_date" type="date" value={rateForm.data.effective_date} onChange={(e) => rateForm.setData('effective_date', e.target.value)} error={rateForm.errors.effective_date} />
                        <Select label="Source" id="rate_source" value={rateForm.data.source} onChange={(e) => rateForm.setData('source', e.target.value)} error={rateForm.errors.source}>
                            {sources.map((source) => <option key={source} value={source}>{source.replace(/_/g, ' ')}</option>)}
                        </Select>
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
