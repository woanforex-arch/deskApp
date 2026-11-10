import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { BuildingOffice2Icon, CurrencyDollarIcon, PlusIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function FixedAssetsIndex({ assets, depreciation, filters, stats, categories, accounts, statuses }) {
    const [modal, setModal] = useState(null);
    const [selected, setSelected] = useState(null);

    const assetForm = useForm({
        name: '',
        code: '',
        category: '',
        purchase_date: today(),
        cost: 0,
        salvage_value: 0,
        useful_life_years: 5,
        depreciation_method: 'straight_line',
        location: '',
        assigned_to: '',
        notes: '',
    });
    const depreciationForm = useForm({ period: currentPeriod(), depreciation_date: today() });
    const disposeForm = useForm({ proceeds: 0, disposal_date: today() });
    const revalueForm = useForm({ new_value: 0, revaluation_date: today(), notes: '' });

    const submitAsset = (e) => {
        e.preventDefault();
        assetForm.post('/fixed-assets', { preserveScroll: true, onSuccess: () => { setModal(null); assetForm.reset(); } });
    };

    const open = (kind, asset) => {
        setSelected(asset);
        if (kind === 'depreciate') depreciationForm.setData({ period: currentPeriod(), depreciation_date: today() });
        if (kind === 'dispose') disposeForm.setData({ proceeds: 0, disposal_date: today() });
        if (kind === 'revalue') revalueForm.setData({ new_value: asset.book_value, revaluation_date: today(), notes: '' });
        setModal(kind);
    };

    const submitDepreciation = (e) => {
        e.preventDefault();
        depreciationForm.post(`/fixed-assets/${selected.id}/depreciate`, { preserveScroll: true, onSuccess: () => setModal(null) });
    };
    const submitDispose = (e) => {
        e.preventDefault();
        disposeForm.post(`/fixed-assets/${selected.id}/dispose`, { preserveScroll: true, onSuccess: () => setModal(null) });
    };
    const submitRevalue = (e) => {
        e.preventDefault();
        revalueForm.post(`/fixed-assets/${selected.id}/revalue`, { preserveScroll: true, onSuccess: () => setModal(null) });
    };

    const filter = (key, value) => router.get('/fixed-assets', { ...filters, [key]: value || undefined }, { preserveState: true, preserveScroll: true, replace: true });

    return (
        <AppLayout>
            <Head title="Fixed assets" />

            <div className="space-y-6">
                <PageHeader eyebrow="Inventory & assets" title="Fixed assets" description="Asset register, straight-line depreciation, revaluations, and disposals.">
                    <button type="button" onClick={() => setModal('asset')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        Register asset
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Asset cost" value={currency(stats.cost)} hint={`${stats.active} active assets`} icon={BuildingOffice2Icon} accent="brand" />
                    <StatCard label="Book value" value={currency(stats.book_value)} hint="Net of accumulated depreciation" icon={CurrencyDollarIcon} accent="emerald" />
                    <StatCard label="Accumulated depreciation" value={currency(stats.accumulated)} hint="Posted to date" icon={WrenchScrewdriverIcon} accent="amber" />
                    <StatCard label="Disposed" value={stats.disposed} hint="Assets retired" icon={BuildingOffice2Icon} accent="slate" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Asset register</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Depreciation and revaluations post through the ledger.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={filters.status ?? ''} onChange={(e) => filter('status', e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                <option value="">All statuses</option>
                                {statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                            </select>
                            <select value={filters.category ?? ''} onChange={(e) => filter('category', e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                <option value="">All categories</option>
                                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </div>
                    </div>

                    {assets.length === 0 ? (
                        <EmptyState title="No fixed assets" description="Register an asset to start depreciating it." icon={BuildingOffice2Icon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Asset</th>
                                        <th className="px-5 py-3">Category</th>
                                        <th className="px-5 py-3 text-right">Cost</th>
                                        <th className="px-5 py-3 text-right">Monthly dep.</th>
                                        <th className="px-5 py-3 text-right">Accumulated</th>
                                        <th className="px-5 py-3 text-right">Book value</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {assets.map((asset) => (
                                        <tr key={asset.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{asset.name}</p>
                                                <p className="text-xs text-slate-500">{asset.code} · {asset.location ?? 'No location'}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">{asset.category ?? '—'}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(asset.cost)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(asset.monthly_depreciation)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(asset.accumulated_depreciation)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(asset.book_value)}</td>
                                            <td className="px-5 py-3.5"><Badge tone={asset.status === 'active' ? 'emerald' : asset.status === 'disposed' ? 'slate' : 'amber'} dot>{asset.status.replace(/_/g, ' ')}</Badge></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                {asset.status === 'active' ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button type="button" onClick={() => open('depreciate', asset)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">Depreciate</button>
                                                        <button type="button" onClick={() => open('revalue', asset)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">Revalue</button>
                                                        <button type="button" onClick={() => open('dispose', asset)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">Dispose</button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
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
                        <h2 className="font-display text-base font-semibold text-slate-900">Depreciation history</h2>
                    </div>
                    {depreciation.length === 0 ? (
                        <EmptyState title="No depreciation posted" description="Post depreciation for an asset to build history." icon={WrenchScrewdriverIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Period</th>
                                        <th className="px-5 py-3">Asset</th>
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                        <th className="px-5 py-3 text-right">Accumulated after</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {depreciation.map((entry) => (
                                        <tr key={entry.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">{entry.period}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{entry.asset} <span className="text-xs text-slate-400">{entry.code}</span></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(entry.depreciation_date)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(entry.amount)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(entry.accumulated_after)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={modal === 'asset'} onClose={() => setModal(null)} title="Register fixed asset" size="lg" footer={<Footer label="Register asset" processing={assetForm.processing} form="asset-form" onCancel={() => setModal(null)} />}>
                <form id="asset-form" onSubmit={submitAsset} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="name" value={assetForm.data.name} onChange={(e) => assetForm.setData('name', e.target.value)} error={assetForm.errors.name} />
                        <TextInput label="Asset code" id="code" value={assetForm.data.code} onChange={(e) => assetForm.setData('code', e.target.value)} error={assetForm.errors.code} />
                        <TextInput label="Category" id="category" value={assetForm.data.category} onChange={(e) => assetForm.setData('category', e.target.value)} error={assetForm.errors.category} />
                        <TextInput label="Purchase date" id="purchase_date" type="date" value={assetForm.data.purchase_date} onChange={(e) => assetForm.setData('purchase_date', e.target.value)} error={assetForm.errors.purchase_date} />
                        <TextInput label="Cost" id="cost" type="number" step="0.01" value={assetForm.data.cost} onChange={(e) => assetForm.setData('cost', e.target.value)} error={assetForm.errors.cost} />
                        <TextInput label="Salvage value" id="salvage_value" type="number" step="0.01" value={assetForm.data.salvage_value} onChange={(e) => assetForm.setData('salvage_value', e.target.value)} error={assetForm.errors.salvage_value} />
                        <TextInput label="Useful life (years)" id="useful_life_years" type="number" value={assetForm.data.useful_life_years} onChange={(e) => assetForm.setData('useful_life_years', e.target.value)} error={assetForm.errors.useful_life_years} />
                        <Select label="Method" id="depreciation_method" value={assetForm.data.depreciation_method} onChange={(e) => assetForm.setData('depreciation_method', e.target.value)} error={assetForm.errors.depreciation_method}>
                            <option value="straight_line">Straight line</option>
                            <option value="declining_balance">Declining balance</option>
                        </Select>
                        <TextInput label="Location" id="location" value={assetForm.data.location} onChange={(e) => assetForm.setData('location', e.target.value)} error={assetForm.errors.location} />
                        <TextInput label="Assigned to" id="assigned_to" value={assetForm.data.assigned_to} onChange={(e) => assetForm.setData('assigned_to', e.target.value)} error={assetForm.errors.assigned_to} />
                    </div>
                    <Textarea label="Notes" id="notes" value={assetForm.data.notes} onChange={(e) => assetForm.setData('notes', e.target.value)} error={assetForm.errors.notes} rows={2} />
                </form>
            </Modal>

            <Modal open={modal === 'depreciate'} onClose={() => setModal(null)} title={`Post depreciation — ${selected?.name ?? ''}`} footer={<Footer label="Post depreciation" processing={depreciationForm.processing} form="dep-form" onCancel={() => setModal(null)} />}>
                <form id="dep-form" onSubmit={submitDepreciation} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Period (YYYY-MM)" id="period" value={depreciationForm.data.period} onChange={(e) => depreciationForm.setData('period', e.target.value)} error={depreciationForm.errors.period} placeholder="2026-11" />
                        <TextInput label="Depreciation date" id="depreciation_date" type="date" value={depreciationForm.data.depreciation_date} onChange={(e) => depreciationForm.setData('depreciation_date', e.target.value)} error={depreciationForm.errors.depreciation_date} />
                    </div>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Monthly charge: <span className="font-semibold text-slate-700">{currency(selected?.monthly_depreciation ?? 0)}</span>. Posting is blocked if the period already has an entry or the asset is fully depreciated.
                    </p>
                </form>
            </Modal>

            <Modal open={modal === 'dispose'} onClose={() => setModal(null)} title={`Dispose asset — ${selected?.name ?? ''}`} footer={<Footer label="Dispose & post" processing={disposeForm.processing} form="dispose-form" onCancel={() => setModal(null)} />}>
                <form id="dispose-form" onSubmit={submitDispose} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Proceeds" id="proceeds" type="number" step="0.01" value={disposeForm.data.proceeds} onChange={(e) => disposeForm.setData('proceeds', e.target.value)} error={disposeForm.errors.proceeds} />
                        <TextInput label="Disposal date" id="disposal_date" type="date" value={disposeForm.data.disposal_date} onChange={(e) => disposeForm.setData('disposal_date', e.target.value)} error={disposeForm.errors.disposal_date} />
                    </div>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Book value at disposal: <span className="font-semibold text-slate-700">{currency(selected?.book_value ?? 0)}</span>. Any gain or loss is posted to the ledger.
                    </p>
                </form>
            </Modal>

            <Modal open={modal === 'revalue'} onClose={() => setModal(null)} title={`Revalue asset — ${selected?.name ?? ''}`} footer={<Footer label="Post revaluation" processing={revalueForm.processing} form="revalue-form" onCancel={() => setModal(null)} />}>
                <form id="revalue-form" onSubmit={submitRevalue} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="New value" id="new_value" type="number" step="0.01" value={revalueForm.data.new_value} onChange={(e) => revalueForm.setData('new_value', e.target.value)} error={revalueForm.errors.new_value} />
                        <TextInput label="Revaluation date" id="revaluation_date" type="date" value={revalueForm.data.revaluation_date} onChange={(e) => revalueForm.setData('revaluation_date', e.target.value)} error={revalueForm.errors.revaluation_date} />
                    </div>
                    <Textarea label="Notes" id="revalue_notes" value={revalueForm.data.notes} onChange={(e) => revalueForm.setData('notes', e.target.value)} error={revalueForm.errors.notes} rows={2} />
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
