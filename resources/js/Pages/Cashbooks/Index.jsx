import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { BanknotesIcon, PlusIcon, WalletIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput } from '../../Components/FormControls';
import { currency, currencyChoices, formatDate } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function CashbooksIndex({ cashbooks, transactions, filters, stats, glAccounts, contacts }) {
    const page = usePage();
    const { base: baseCurrency, codes: currencyCodes } = currencyChoices(page.props.money);
    const [modal, setModal] = useState(null);

    const bookForm = useForm({ name: '', code: '', type: 'cash', gl_account_id: '', currency: baseCurrency, balance: 0, custodian: '' });
    const txnForm = useForm({ cashbook_id: filters.cashbook_id ?? '', transaction_date: today(), type: 'receipt', amount: '', description: '', reference: '', contact_id: '' });

    const submitBook = (e) => {
        e.preventDefault();
        bookForm.post('/cashbooks', { preserveScroll: true, onSuccess: () => { setModal(null); bookForm.reset(); } });
    };
    const submitTxn = (e) => {
        e.preventDefault();
        txnForm.post('/cashbooks/transactions', { preserveScroll: true, onSuccess: () => { setModal(null); txnForm.reset(); } });
    };

    const filterBook = (id) => {
        router.get('/cashbooks', id ? { cashbook_id: id } : {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout>
            <Head title="Cashbooks" />

            <div className="space-y-6">
                <PageHeader eyebrow="Banking & cash" title="Cash management" description="Cashbooks, petty cash, fund movements, and float balances by custodian.">
                    <button type="button" onClick={() => setModal('book')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                        <PlusIcon className="h-4 w-4" />
                        New cashbook
                    </button>
                    <button type="button" onClick={() => setModal('transaction')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        Record movement
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Cash on hand" value={currency(stats.cash)} hint="Cash-type cashbooks" icon={BanknotesIcon} accent="brand" />
                    <StatCard label="Petty cash" value={currency(stats.petty)} hint="Petty cash floats" icon={WalletIcon} accent="amber" />
                    <StatCard label="Total funds" value={currency(stats.funds)} hint="All cashbooks combined" icon={WalletIcon} accent="emerald" />
                    <StatCard label="Movements" value={stats.transactions} hint="Recorded cash transactions" icon={WalletIcon} accent="sky" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {cashbooks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 sm:col-span-2 xl:col-span-3">
                            <p className="text-sm text-slate-500">No cashbooks yet. Create a cashbook to track cash on hand or petty cash.</p>
                        </div>
                    ) : (
                        cashbooks.map((book) => (
                            <button
                                key={book.id}
                                type="button"
                                onClick={() => filterBook(book.id)}
                                className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                    String(filters.cashbook_id) === String(book.id) ? 'border-brand-300 ring-2 ring-brand-500/20' : 'border-slate-200/80'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-display text-base font-semibold text-slate-900">{book.name}</p>
                                        <p className="text-xs text-slate-500">{book.code} · {book.type}</p>
                                    </div>
                                    <Badge tone={book.is_active ? 'emerald' : 'slate'} dot>{book.is_active ? 'Active' : 'Inactive'}</Badge>
                                </div>
                                <p className="mt-4 font-display text-2xl font-semibold text-slate-900">{currency(book.balance, book.currency)}</p>
                                <p className="mt-1 text-xs text-slate-500">Custodian: {book.custodian ?? '—'}</p>
                                <p className="mt-1 truncate text-xs text-slate-400">{book.gl_account ?? 'No GL mapping'}</p>
                            </button>
                        ))
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Cash movements</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Receipts, payments, and transfers post straight to the ledger.</p>
                        </div>
                        <select value={filters.cashbook_id ?? ''} onChange={(e) => filterBook(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                            <option value="">All cashbooks</option>
                            {cashbooks.map((book) => (
                                <option key={book.id} value={book.id}>{book.name}</option>
                            ))}
                        </select>
                    </div>

                    {transactions.length === 0 ? (
                        <EmptyState title="No cash transactions" description="Record a receipt or payment against a cashbook." icon={BanknotesIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Date</th>
                                        <th className="px-5 py-3">Cashbook</th>
                                        <th className="px-5 py-3">Description</th>
                                        <th className="px-5 py-3">Type</th>
                                        <th className="px-5 py-3">Contact</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.map((txn) => (
                                        <tr key={txn.id} className="transition hover:bg-slate-50/70">
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(txn.transaction_date)}</td>
                                            <td className="px-5 py-3.5 font-medium text-slate-900">{txn.cashbook}</td>
                                            <td className="max-w-[16rem] px-5 py-3.5">
                                                <p className="truncate text-slate-700">{txn.description}</p>
                                                {txn.reference && <p className="text-xs text-slate-400">Ref {txn.reference}</p>}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge tone={['receipt', 'transfer_in'].includes(txn.type) ? 'emerald' : 'rose'}>{txn.type.replace(/_/g, ' ')}</Badge>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">{txn.contact ?? '—'}</td>
                                            <td className={`whitespace-nowrap px-5 py-3.5 text-right font-semibold ${['receipt', 'transfer_in'].includes(txn.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {['receipt', 'transfer_in'].includes(txn.type) ? '+' : '−'}{currency(txn.amount, txn.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={modal === 'book'} onClose={() => setModal(null)} title="New cashbook" footer={<Footer label="Create cashbook" processing={bookForm.processing} form="cashbook-form" onCancel={() => setModal(null)} />}>
                <form id="cashbook-form" onSubmit={submitBook} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Name" id="name" value={bookForm.data.name} onChange={(e) => bookForm.setData('name', e.target.value)} error={bookForm.errors.name} />
                        <TextInput label="Code" id="code" value={bookForm.data.code} onChange={(e) => bookForm.setData('code', e.target.value)} error={bookForm.errors.code} />
                        <Select label="Type" id="type" value={bookForm.data.type} onChange={(e) => bookForm.setData('type', e.target.value)} error={bookForm.errors.type}>
                            <option value="cash">Cash</option>
                            <option value="petty">Petty cash</option>
                            <option value="fund">Fund</option>
                        </Select>
                        <Select label="GL account" id="gl_account_id" value={bookForm.data.gl_account_id} onChange={(e) => bookForm.setData('gl_account_id', e.target.value)} error={bookForm.errors.gl_account_id}>
                            <option value="">Auto-map</option>
                            {glAccounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                            ))}
                        </Select>
                        <Select label="Currency" id="currency" value={bookForm.data.currency} onChange={(e) => bookForm.setData('currency', e.target.value)}>
                            {currencyCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                        </Select>
                        <TextInput label="Opening balance" id="balance" type="number" step="0.01" value={bookForm.data.balance} onChange={(e) => bookForm.setData('balance', e.target.value)} error={bookForm.errors.balance} />
                        <TextInput label="Custodian" id="custodian" value={bookForm.data.custodian} onChange={(e) => bookForm.setData('custodian', e.target.value)} error={bookForm.errors.custodian} className="sm:col-span-2" />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'transaction'} onClose={() => setModal(null)} title="Record cash movement" footer={<Footer label="Post movement" processing={txnForm.processing} form="cash-txn-form" onCancel={() => setModal(null)} />}>
                <form id="cash-txn-form" onSubmit={submitTxn} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Cashbook" id="cashbook_id" value={txnForm.data.cashbook_id} onChange={(e) => txnForm.setData('cashbook_id', e.target.value)} error={txnForm.errors.cashbook_id} className="sm:col-span-2">
                            <option value="">Select cashbook</option>
                            {cashbooks.map((book) => (
                                <option key={book.id} value={book.id}>{book.name} · {currency(book.balance, book.currency)}</option>
                            ))}
                        </Select>
                        <TextInput label="Date" id="transaction_date" type="date" value={txnForm.data.transaction_date} onChange={(e) => txnForm.setData('transaction_date', e.target.value)} error={txnForm.errors.transaction_date} />
                        <Select label="Type" id="type" value={txnForm.data.type} onChange={(e) => txnForm.setData('type', e.target.value)} error={txnForm.errors.type}>
                            <option value="receipt">Receipt</option>
                            <option value="payment">Payment</option>
                            <option value="transfer_in">Transfer in</option>
                            <option value="transfer_out">Transfer out</option>
                        </Select>
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={txnForm.data.amount} onChange={(e) => txnForm.setData('amount', e.target.value)} error={txnForm.errors.amount} />
                        <TextInput label="Reference" id="reference" value={txnForm.data.reference} onChange={(e) => txnForm.setData('reference', e.target.value)} error={txnForm.errors.reference} />
                        <TextInput label="Description" id="description" value={txnForm.data.description} onChange={(e) => txnForm.setData('description', e.target.value)} error={txnForm.errors.description} className="sm:col-span-2" />
                        <Select label="Contact" id="contact_id" value={txnForm.data.contact_id} onChange={(e) => txnForm.setData('contact_id', e.target.value)} error={txnForm.errors.contact_id} className="sm:col-span-2">
                            <option value="">No contact</option>
                            {contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                        </Select>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}

function Footer({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                Cancel
            </button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Working…' : label}
            </button>
        </>
    );
}
