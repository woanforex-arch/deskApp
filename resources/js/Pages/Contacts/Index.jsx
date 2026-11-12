import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    BuildingOffice2Icon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    PlusIcon,
    ReceiptPercentIcon,
    TrashIcon,
    UserGroupIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import Pagination from '../../Components/Pagination';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Checkbox, Select, TextInput, Textarea } from '../../Components/FormControls';
import { currency, initials, statusTone } from '../../lib/format';

const blankContact = {
    name: '',
    email: '',
    phone: '',
    type: 'customer',
    tax_number: '',
    address: '',
    city: '',
    country: '',
    notes: '',
    is_active: true,
};

export default function ContactsIndex({ contacts, filters, stats, types }) {
    const page = usePage();
    const canWrite = page.props.auth?.user?.can_write;
    const [search, setSearch] = useState(filters.search ?? '');
    const [type, setType] = useState(filters.type ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const form = useForm({ ...blankContact });

    const applyFilters = (event) => {
        event?.preventDefault();

        router.get(
            '/contacts',
            {
                ...(search ? { search } : {}),
                ...(type ? { type } : {}),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearch('');
        setType('');
        router.get('/contacts', {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...blankContact });
        form.clearErrors();
        setOpen(true);
    };

    const openEdit = (contact) => {
        setEditing(contact);
        form.setData({
            name: contact.name,
            email: contact.email ?? '',
            phone: contact.phone ?? '',
            type: contact.type,
            tax_number: contact.tax_number ?? '',
            address: contact.address ?? '',
            city: contact.city ?? '',
            country: contact.country ?? '',
            notes: contact.notes ?? '',
            is_active: Boolean(contact.is_active),
        });
        form.clearErrors();
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
    };

    const submit = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                closeModal();
                form.reset();
            },
        };

        if (editing) {
            form.put(`/contacts/${editing.id}`, options);
        } else {
            form.post('/contacts', options);
        }
    };

    const remove = (contact) => {
        if (confirm(`Delete contact ${contact.name}?`)) {
            router.delete(`/contacts/${contact.id}`, { preserveScroll: true });
        }
    };

    const hasFilters = Boolean(filters.search || filters.type);

    return (
        <AppLayout>
            <Head title="Contacts" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Relationships"
                    title="Contacts"
                    description="Customers and vendors that make up your billing and purchasing network."
                >
                    {canWrite && (
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New contact
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Customers"
                        value={stats.customers}
                        hint="Including customer & vendor"
                        icon={UsersIcon}
                        accent="brand"
                    />
                    <StatCard
                        label="Vendors"
                        value={stats.vendors}
                        hint="Suppliers and service partners"
                        icon={BuildingOffice2Icon}
                        accent="amber"
                    />
                    <StatCard
                        label="Active contacts"
                        value={stats.active}
                        hint="Available for new documents"
                        icon={UserGroupIcon}
                        accent="emerald"
                    />
                    <StatCard
                        label="Outstanding"
                        value={currency(stats.outstanding)}
                        hint="Open receivables across the ledger"
                        icon={ReceiptPercentIcon}
                        accent="sky"
                    />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <form onSubmit={applyFilters} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search by name or email…"
                                    className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={type}
                                    onChange={(event) => setType(event.target.value)}
                                    className="rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                >
                                    <option value="">All types</option>
                                    {types.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                >
                                    Filter
                                </button>

                                {hasFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {contacts.data.length === 0 ? (
                        <EmptyState
                            title={hasFilters ? 'No contacts match your filters' : 'No contacts yet'}
                            description={
                                hasFilters
                                    ? 'Try a different type or search term.'
                                    : 'Add your first customer or vendor to start invoicing and purchasing.'
                            }
                            icon={UsersIcon}
                            action={
                                hasFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                                    >
                                        Clear filters
                                    </button>
                                ) : (
                                    canWrite && (
                                        <button
                                            type="button"
                                            onClick={openCreate}
                                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                        >
                                            New contact
                                        </button>
                                    )
                                )
                            }
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Contact</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">Location</th>
                                            <th className="px-5 py-3 text-right">Invoices</th>
                                            <th className="px-5 py-3 text-right">Outstanding</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {contacts.data.map((contact) => (
                                            <tr key={contact.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                                            {initials(contact.name)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-slate-900">{contact.name}</p>
                                                            <p className="truncate text-xs text-slate-500">{contact.email ?? '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Badge tone={statusTone(contact.type)}>{contact.type_label}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                                                    {[contact.city, contact.country].filter(Boolean).join(', ') || '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {contact.invoices_count}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                                                    {currency(contact.outstanding)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5">
                                                    <Badge tone={contact.is_active ? 'emerald' : 'slate'} dot>
                                                        {contact.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {canWrite && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(contact)}
                                                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                                                                title="Edit contact"
                                                            >
                                                                <PencilSquareIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {canWrite && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(contact)}
                                                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                                title="Delete contact"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <Pagination paginator={contacts} />
                        </>
                    )}
                </div>
            </div>

            <Modal
                open={open}
                onClose={closeModal}
                title={editing ? `Edit ${editing.name}` : 'New contact'}
                description="Customers are billed on invoices; vendors are paid through bills."
                size="lg"
                footer={
                    <>
                        <button type="button" onClick={closeModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="contact-form"
                            disabled={form.processing}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Create contact'}
                        </button>
                    </>
                }
            >
                <form id="contact-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                            label="Name"
                            id="name"
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            error={form.errors.name}
                            required
                        />
                        <Select
                            label="Type"
                            id="type"
                            value={form.data.type}
                            onChange={(event) => form.setData('type', event.target.value)}
                            error={form.errors.type}
                        >
                            {types.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                        <TextInput
                            label="Email"
                            id="email"
                            type="email"
                            value={form.data.email}
                            onChange={(event) => form.setData('email', event.target.value)}
                            error={form.errors.email}
                        />
                        <TextInput
                            label="Phone"
                            id="phone"
                            value={form.data.phone}
                            onChange={(event) => form.setData('phone', event.target.value)}
                            error={form.errors.phone}
                        />
                        <TextInput
                            label="Tax number"
                            id="tax_number"
                            value={form.data.tax_number}
                            onChange={(event) => form.setData('tax_number', event.target.value)}
                            error={form.errors.tax_number}
                        />
                        <TextInput
                            label="Address"
                            id="address"
                            value={form.data.address}
                            onChange={(event) => form.setData('address', event.target.value)}
                            error={form.errors.address}
                        />
                        <TextInput
                            label="City"
                            id="city"
                            value={form.data.city}
                            onChange={(event) => form.setData('city', event.target.value)}
                            error={form.errors.city}
                        />
                        <TextInput
                            label="Country"
                            id="country"
                            value={form.data.country}
                            onChange={(event) => form.setData('country', event.target.value)}
                            error={form.errors.country}
                        />
                    </div>

                    <Textarea
                        label="Notes"
                        id="notes"
                        value={form.data.notes}
                        onChange={(event) => form.setData('notes', event.target.value)}
                        error={form.errors.notes}
                        rows={3}
                    />

                    <Checkbox
                        label="Active"
                        id="is_active"
                        description="Inactive contacts stay in history but are hidden from new documents."
                        checked={form.data.is_active}
                        onChange={(event) => form.setData('is_active', event.target.checked)}
                    />
                </form>
            </Modal>
        </AppLayout>
    );
}
