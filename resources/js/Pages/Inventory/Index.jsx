import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { ArchiveBoxIcon, ArrowTrendingDownIcon, CubeIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, number } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function InventoryIndex({ items, movements, filters, stats, accounts, categories }) {
    const [modal, setModal] = useState(null);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const [category, setCategory] = useState(filters.category ?? '');

    const itemForm = useForm({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: 'unit',
        cost_method: 'weighted_average',
        unit_cost: 0,
        quantity_on_hand: 0,
        reorder_level: 0,
        inventory_account_id: '',
        cogs_account_id: '',
    });

    const movementForm = useForm({ type: 'receive', movement_date: today(), quantity: 0, unit_cost: '', reference: '', notes: '' });

    const applyFilters = (event) => {
        event?.preventDefault();
        router.get('/inventory', { ...(search ? { search } : {}), ...(category ? { category } : {}) }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitItem = (e) => {
        e.preventDefault();
        itemForm.post('/inventory', { preserveScroll: true, onSuccess: () => { setModal(null); itemForm.reset(); } });
    };

    const openMovement = (item) => {
        setSelected(item);
        movementForm.setData({ type: 'receive', movement_date: today(), quantity: 0, unit_cost: item.unit_cost, reference: '', notes: '' });
        setModal('movement');
    };

    const submitMovement = (e) => {
        e.preventDefault();
        movementForm.post(`/inventory/${selected.id}/movements`, { preserveScroll: true, onSuccess: () => { setModal(null); movementForm.reset(); } });
    };

    return (
        <AppLayout>
            <Head title="Inventory" />

            <div className="space-y-6">
                <PageHeader eyebrow="Inventory & assets" title="Inventory accounting" description="Stock items, weighted-average costing, movements, and automatic inventory/COGS postings.">
                    <button type="button" onClick={() => setModal('item')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        New item
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Inventory value" value={currency(stats.value)} hint="On hand at current cost" icon={CubeIcon} accent="brand" />
                    <StatCard label="Items" value={stats.items} hint="SKUs in the register" icon={ArchiveBoxIcon} accent="sky" />
                    <StatCard label="Low stock" value={stats.low_stock} hint="At or below reorder level" icon={ArrowTrendingDownIcon} accent="rose" />
                    <StatCard label="Movements" value={stats.movements} hint="Receipts, issues and adjustments" icon={CubeIcon} accent="violet" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <form onSubmit={applyFilters} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU or name…" className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <RichSelect
                                    value={category}
                                    onChange={(value) => setCategory(value)}
                                    placeholder="All categories"
                                    options={categories.map((option) => ({
                                        value: option,
                                        primary: option,
                                    }))}
                                    className="w-full sm:w-auto"
                                />
                                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Filter</button>
                                {(filters.search || filters.category) && (
                                    <button type="button" onClick={() => { setSearch(''); setCategory(''); router.get('/inventory', {}, { preserveState: true, preserveScroll: true, replace: true }); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">
                                        Reset
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {items.length === 0 ? (
                        <EmptyState title="No inventory items" description="Add an item to begin tracking stock and cost of goods sold." icon={CubeIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">SKU</th>
                                        <th className="px-5 py-3">Item</th>
                                        <th className="px-5 py-3 text-right">On hand</th>
                                        <th className="px-5 py-3 text-right">Reorder</th>
                                        <th className="px-5 py-3 text-right">Unit cost</th>
                                        <th className="px-5 py-3 text-right">Value</th>
                                        <th className="px-5 py-3">Method</th>
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => (
                                        <tr key={item.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-slate-500">{item.sku}</td>
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{item.name}</p>
                                                <p className="text-xs text-slate-500">{item.category ?? 'Uncategorised'} · {item.inventory_account ?? 'No inventory account'}</p>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-700">
                                                {number(item.quantity_on_hand, { maximumFractionDigits: 2 })} {item.unit}
                                                {item.low_stock && <span className="ml-2"><Badge tone="rose">Low</Badge></span>}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-500">{number(item.reorder_level, { maximumFractionDigits: 2 })}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(item.unit_cost)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(item.value)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 capitalize text-slate-500">{item.cost_method.replace(/_/g, ' ')}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                <button type="button" onClick={() => openMovement(item)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                                                    Movement
                                                </button>
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
                        <h2 className="font-display text-base font-semibold text-slate-900">Recent movements</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Every receipt, issue, adjustment, and revaluation.</p>
                    </div>
                    {movements.length === 0 ? (
                        <EmptyState title="No movements yet" description="Record a stock movement to see the history here." icon={ArchiveBoxIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3">Item</th>
                                        <th className="px-5 py-3">Type</th>
                                        <th className="px-5 py-3 text-right">Quantity</th>
                                        <th className="px-5 py-3 text-right">Unit cost</th>
                                        <th className="px-5 py-3 text-right">Total cost</th>
                                        <th className="px-5 py-3">Reference</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {movements.map((movement) => (
                                        <tr key={movement.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(movement.movement_date)}</td>
                                            <td className="px-5 py-3.5">
                                                <p className="font-medium text-slate-900">{movement.item}</p>
                                                <p className="text-xs text-slate-400">{movement.sku}</p>
                                            </td>
                                            <td className="px-5 py-3.5"><Badge tone={movement.type === 'receive' ? 'emerald' : movement.type === 'issue' ? 'rose' : 'amber'}>{movement.type}</Badge></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-700">{number(movement.quantity, { maximumFractionDigits: 2 })}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(movement.unit_cost)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(movement.total_cost)}</td>
                                            <td className="px-5 py-3.5 text-slate-500">{movement.reference ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={modal === 'item'} onClose={() => setModal(null)} title="New inventory item" size="lg" footer={<Footer label="Create item" processing={itemForm.processing} form="item-form" onCancel={() => setModal(null)} />}>
                <form id="item-form" onSubmit={submitItem} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="SKU" id="sku" value={itemForm.data.sku} onChange={(e) => itemForm.setData('sku', e.target.value)} error={itemForm.errors.sku} />
                        <TextInput label="Name" id="name" value={itemForm.data.name} onChange={(e) => itemForm.setData('name', e.target.value)} error={itemForm.errors.name} />
                        <TextInput label="Category" id="category" value={itemForm.data.category} onChange={(e) => itemForm.setData('category', e.target.value)} error={itemForm.errors.category} />
                        <TextInput label="Unit" id="unit" value={itemForm.data.unit} onChange={(e) => itemForm.setData('unit', e.target.value)} error={itemForm.errors.unit} />
                        <RichSelect
                            label="Cost method"
                            id="cost_method"
                            value={itemForm.data.cost_method}
                            onChange={(value) => itemForm.setData('cost_method', value)}
                            error={itemForm.errors.cost_method}
                            options={[
                                { value: 'weighted_average', primary: 'Weighted average' },
                                { value: 'fifo', primary: 'FIFO' },
                                { value: 'lifo', primary: 'LIFO' },
                                { value: 'standard', primary: 'Standard' },
                            ]}
                        />
                        <TextInput label="Unit cost" id="unit_cost" type="number" step="0.0001" value={itemForm.data.unit_cost} onChange={(e) => itemForm.setData('unit_cost', e.target.value)} error={itemForm.errors.unit_cost} />
                        <TextInput label="Opening quantity" id="quantity_on_hand" type="number" step="0.01" value={itemForm.data.quantity_on_hand} onChange={(e) => itemForm.setData('quantity_on_hand', e.target.value)} error={itemForm.errors.quantity_on_hand} />
                        <TextInput label="Reorder level" id="reorder_level" type="number" step="0.01" value={itemForm.data.reorder_level} onChange={(e) => itemForm.setData('reorder_level', e.target.value)} error={itemForm.errors.reorder_level} />
                        <RichSelect
                            label="Inventory account"
                            id="inventory_account_id"
                            value={itemForm.data.inventory_account_id}
                            onChange={(value) => itemForm.setData('inventory_account_id', value)}
                            error={itemForm.errors.inventory_account_id}
                            placeholder="Default (1300)"
                            options={accounts.filter((a) => a.type === 'asset').map((account) => ({
                                value: account.id,
                                primary: account.name,
                                meta: account.code,
                            }))}
                        />
                        <RichSelect
                            label="COGS account"
                            id="cogs_account_id"
                            value={itemForm.data.cogs_account_id}
                            onChange={(value) => itemForm.setData('cogs_account_id', value)}
                            error={itemForm.errors.cogs_account_id}
                            placeholder="Default (5100)"
                            options={accounts.filter((a) => a.type === 'expense').map((account) => ({
                                value: account.id,
                                primary: account.name,
                                meta: account.code,
                            }))}
                        />
                    </div>
                    <Textarea label="Description" id="description" value={itemForm.data.description} onChange={(e) => itemForm.setData('description', e.target.value)} error={itemForm.errors.description} rows={2} />
                </form>
            </Modal>

            <Modal open={modal === 'movement'} onClose={() => setModal(null)} title={`Stock movement — ${selected?.name ?? ''}`} footer={<Footer label="Post movement" processing={movementForm.processing} form="movement-form" onCancel={() => setModal(null)} />}>
                <form id="movement-form" onSubmit={submitMovement} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <RichSelect
                            label="Movement type"
                            id="type"
                            value={movementForm.data.type}
                            onChange={(value) => movementForm.setData('type', value)}
                            error={movementForm.errors.type}
                            options={[
                                { value: 'receive', primary: 'Receive', badge: { label: 'Receive', classes: 'bg-emerald-50 text-emerald-600' } },
                                { value: 'issue', primary: 'Issue', badge: { label: 'Issue', classes: 'bg-rose-50 text-rose-600' } },
                                { value: 'adjust', primary: 'Adjust' },
                                { value: 'revalue', primary: 'Revalue' },
                            ]}
                        />
                        <TextInput label="Movement date" id="movement_date" type="date" value={movementForm.data.movement_date} onChange={(e) => movementForm.setData('movement_date', e.target.value)} error={movementForm.errors.movement_date} />
                        <TextInput label={movementForm.data.type === 'revalue' ? 'New unit cost' : 'Quantity'} id="quantity" type="number" step="0.01" value={movementForm.data.quantity} onChange={(e) => movementForm.setData('quantity', e.target.value)} error={movementForm.errors.quantity} />
                        <TextInput label="Unit cost" id="unit_cost" type="number" step="0.0001" value={movementForm.data.unit_cost} onChange={(e) => movementForm.setData('unit_cost', e.target.value)} error={movementForm.errors.unit_cost} />
                        <TextInput label="Reference" id="reference" value={movementForm.data.reference} onChange={(e) => movementForm.setData('reference', e.target.value)} error={movementForm.errors.reference} className="sm:col-span-2" />
                    </div>
                    <Textarea label="Notes" id="notes" value={movementForm.data.notes} onChange={(e) => movementForm.setData('notes', e.target.value)} error={movementForm.errors.notes} rows={2} />
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
