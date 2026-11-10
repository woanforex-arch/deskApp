import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import {
    ArrowsRightLeftIcon,
    BanknotesIcon,
    CheckCircleIcon,
    ClipboardDocumentCheckIcon,
    LinkIcon,
    PlusIcon,
    RectangleStackIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { Select, TextInput, Textarea } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime, statusTone } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function BankingIndex({ accounts, transactions, reconciliations, transfers, filters, stats, glAccounts, contacts, currencies }) {
    const [tab, setTab] = useState('accounts');
    const [modal, setModal] = useState(null);

    const accountForm = useForm({ name: '', bank_name: '', account_number: '', iban: '', gl_account_id: '', currency: 'USD', opening_balance: 0 });
    const txnForm = useForm({ bank_account_id: filters.account_id ?? '', transaction_date: today(), description: '', reference: '', type: 'deposit', amount: '', contact_id: '' });
    const reconForm = useForm({ bank_account_id: filters.account_id ?? '', statement_date: today(), statement_balance: '', notes: '' });
    const transferForm = useForm({ from_bank_account_id: '', to_bank_account_id: '', amount: '', transfer_date: today(), reference: '', notes: '' });

    const tabs = [
        { key: 'accounts', label: 'Accounts', icon: RectangleStackIcon },
        { key: 'transactions', label: 'Transactions', icon: ArrowsRightLeftIcon },
        { key: 'reconciliations', label: 'Reconciliations', icon: ClipboardDocumentCheckIcon },
        { key: 'transfers', label: 'Transfers', icon: BanknotesIcon },
    ];

    const submitAccount = (e) => {
        e.preventDefault();
        accountForm.post('/banking/accounts', { preserveScroll: true, onSuccess: () => { setModal(null); accountForm.reset(); } });
    };
    const submitTxn = (e) => {
        e.preventDefault();
        txnForm.post('/banking/transactions', { preserveScroll: true, onSuccess: () => { setModal(null); txnForm.reset(); } });
    };
    const submitRecon = (e) => {
        e.preventDefault();
        reconForm.post('/banking/reconciliations', { preserveScroll: true, onSuccess: () => { setModal(null); reconForm.reset(); } });
    };
    const submitTransfer = (e) => {
        e.preventDefault();
        transferForm.post('/banking/transfers', { preserveScroll: true, onSuccess: () => { setModal(null); transferForm.reset(); } });
    };

    const applyTxnFilter = (key, value) => {
        router.get('/banking', { ...filters, [key]: value || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const match = (txn) => router.post(`/banking/transactions/${txn.id}/match`, {}, { preserveScroll: true });
    const unmatch = (txn) => router.post(`/banking/transactions/${txn.id}/unmatch`, {}, { preserveScroll: true });
    const completeRecon = (recon) => {
        if (confirm('Complete this reconciliation and lock matched transactions?')) {
            router.post(`/banking/reconciliations/${recon.id}/complete`, {}, { preserveScroll: true });
        }
    };

    return (
        <AppLayout>
            <Head title="Banking" />

            <div className="space-y-6">
                <PageHeader eyebrow="Banking & cash" title="Banking" description="Multiple accounts, statement reconciliation, transaction matching, and inter-account transfers.">
                    <button type="button" onClick={() => setModal('transaction')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                        <PlusIcon className="h-4 w-4" />
                        Capture transaction
                    </button>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Cash at bank" value={currency(stats.cash)} hint={`${stats.accounts} active accounts`} icon={BanknotesIcon} accent="brand" />
                    <StatCard label="Unmatched" value={stats.unmatched} hint="Transactions awaiting a match" icon={LinkIcon} accent="amber" />
                    <StatCard label="Accounts" value={stats.accounts} hint="Connected bank accounts" icon={RectangleStackIcon} accent="sky" />
                    <StatCard label="Open reconciliations" value={stats.open_reconciliations} hint="Draft statements in progress" icon={ClipboardDocumentCheckIcon} accent="violet" />
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                                tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                            }`}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === 'accounts' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Bank accounts</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Book balances tracked per account and mapped to a GL account.</p>
                            </div>
                            <button type="button" onClick={() => setModal('account')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                                <PlusIcon className="h-3.5 w-3.5" /> Add account
                            </button>
                        </div>
                        {accounts.length === 0 ? (
                            <EmptyState title="No bank accounts yet" description="Add an account to begin reconciling statements." icon={RectangleStackIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Account</th>
                                            <th className="px-5 py-3">Bank</th>
                                            <th className="px-5 py-3">GL account</th>
                                            <th className="px-5 py-3 text-right">Opening</th>
                                            <th className="px-5 py-3 text-right">Current</th>
                                            <th className="px-5 py-3 text-right">Unmatched</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {accounts.map((account) => (
                                            <tr key={account.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-semibold text-slate-900">{account.name}</p>
                                                    <p className="text-xs text-slate-500">{account.account_number ?? '—'} · {account.currency}</p>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600">{account.bank_name ?? '—'}</td>
                                                <td className="px-5 py-3.5 text-slate-500">{account.gl_account ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(account.opening_balance, account.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(account.current_balance, account.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    <Badge tone={account.unmatched_count > 0 ? 'amber' : 'emerald'}>{account.unmatched_count}</Badge>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={account.is_active ? 'emerald' : 'slate'} dot>{account.is_active ? 'Active' : 'Inactive'}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'transactions' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Bank transactions</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Match statement lines to the book, or leave them in the unmatched queue.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select value={filters.account_id ?? ''} onChange={(e) => applyTxnFilter('account_id', e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                    <option value="">All accounts</option>
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>{account.name}</option>
                                    ))}
                                </select>
                                <select value={filters.status ?? ''} onChange={(e) => applyTxnFilter('status', e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500">
                                    <option value="">All statuses</option>
                                    <option value="unmatched">Unmatched</option>
                                    <option value="matched">Matched</option>
                                </select>
                                <button type="button" onClick={() => setModal('transaction')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                                    <PlusIcon className="h-3.5 w-3.5" /> Capture
                                </button>
                            </div>
                        </div>
                        {transactions.length === 0 ? (
                            <EmptyState title="No transactions" description="Capture a bank transaction or import statement feeds." icon={ArrowsRightLeftIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Account</th>
                                            <th className="px-5 py-3">Description</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {transactions.map((txn) => (
                                            <tr key={txn.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(txn.transaction_date)}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{txn.bank_account}</td>
                                                <td className="max-w-[16rem] px-5 py-3.5">
                                                    <p className="truncate font-medium text-slate-900">{txn.description}</p>
                                                    <p className="text-xs text-slate-400">{txn.reference ?? txn.contact ?? '—'}</p>
                                                </td>
                                                <td className="px-5 py-3.5 capitalize text-slate-500">{txn.type}</td>
                                                <td className={`whitespace-nowrap px-5 py-3.5 text-right font-semibold ${txn.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {txn.type === 'deposit' ? '+' : '−'}{currency(txn.amount, txn.currency)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={txn.status === 'matched' ? 'emerald' : 'amber'} dot>{txn.status}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    {txn.status === 'unmatched' ? (
                                                        <button type="button" onClick={() => match(txn)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                            Match
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => unmatch(txn)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300">
                                                            Unmatch
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
                )}

                {tab === 'reconciliations' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Reconciliations</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Compare statement balances with the book and close out the period.</p>
                            </div>
                            <button type="button" onClick={() => setModal('reconciliation')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                                <PlusIcon className="h-3.5 w-3.5" /> Start reconciliation
                            </button>
                        </div>
                        {reconciliations.length === 0 ? (
                            <EmptyState title="No reconciliations" description="Start a reconciliation against a bank statement." icon={ClipboardDocumentCheckIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Account</th>
                                            <th className="px-5 py-3">Statement date</th>
                                            <th className="px-5 py-3 text-right">Statement</th>
                                            <th className="px-5 py-3 text-right">Book</th>
                                            <th className="px-5 py-3 text-right">Difference</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reconciliations.map((recon) => (
                                            <tr key={recon.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5 font-medium text-slate-900">{recon.bank_account}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(recon.statement_date)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(recon.statement_balance, recon.currency)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(recon.book_balance, recon.currency)}</td>
                                                <td className={`whitespace-nowrap px-5 py-3.5 text-right font-semibold ${Math.abs(recon.difference) < 0.005 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {currency(recon.difference, recon.currency)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={recon.status === 'completed' ? 'emerald' : 'amber'} dot>{recon.status}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    {recon.status !== 'completed' && (
                                                        <button type="button" onClick={() => completeRecon(recon)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                            Complete
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
                )}

                {tab === 'transfers' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
                            <div>
                                <h2 className="font-display text-base font-semibold text-slate-900">Transfers</h2>
                                <p className="mt-0.5 text-xs text-slate-500">Move funds between bank accounts with automatic double-entry posting.</p>
                            </div>
                            <button type="button" onClick={() => setModal('transfer')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
                                <PlusIcon className="h-3.5 w-3.5" /> New transfer
                            </button>
                        </div>
                        {transfers.length === 0 ? (
                            <EmptyState title="No transfers" description="Transfer funds between two bank accounts." icon={ArrowsRightLeftIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">From</th>
                                            <th className="px-5 py-3">To</th>
                                            <th className="px-5 py-3">Reference</th>
                                            <th className="px-5 py-3 text-right">Amount</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {transfers.map((transfer) => (
                                            <tr key={transfer.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(transfer.transfer_date)}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{transfer.from}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{transfer.to}</td>
                                                <td className="px-5 py-3.5 text-slate-500">{transfer.reference ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(transfer.amount)}</td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={statusTone(transfer.status)} dot>{transfer.status}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal open={modal === 'account'} onClose={() => setModal(null)} title="Add bank account" footer={<ActionFooter label="Add account" processing={accountForm.processing} form="bank-account-form" onCancel={() => setModal(null)} />}>
                <form id="bank-account-form" onSubmit={submitAccount} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Account name" id="name" value={accountForm.data.name} onChange={(e) => accountForm.setData('name', e.target.value)} error={accountForm.errors.name} />
                        <TextInput label="Bank name" id="bank_name" value={accountForm.data.bank_name} onChange={(e) => accountForm.setData('bank_name', e.target.value)} error={accountForm.errors.bank_name} />
                        <TextInput label="Account number" id="account_number" value={accountForm.data.account_number} onChange={(e) => accountForm.setData('account_number', e.target.value)} error={accountForm.errors.account_number} />
                        <TextInput label="IBAN" id="iban" value={accountForm.data.iban} onChange={(e) => accountForm.setData('iban', e.target.value)} error={accountForm.errors.iban} />
                        <Select label="GL account" id="gl_account_id" value={accountForm.data.gl_account_id} onChange={(e) => accountForm.setData('gl_account_id', e.target.value)} error={accountForm.errors.gl_account_id}>
                            <option value="">Auto-map to cash</option>
                            {glAccounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
                            ))}
                        </Select>
                        <Select label="Currency" id="currency" value={accountForm.data.currency} onChange={(e) => accountForm.setData('currency', e.target.value)} error={accountForm.errors.currency}>
                            {currencies.length === 0 ? ['USD'].map((code) => <option key={code} value={code}>{code}</option>) : currencies.map((code) => <option key={code} value={code}>{code}</option>)}
                        </Select>
                        <TextInput label="Opening balance" id="opening_balance" type="number" step="0.01" value={accountForm.data.opening_balance} onChange={(e) => accountForm.setData('opening_balance', e.target.value)} error={accountForm.errors.opening_balance} />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'transaction'} onClose={() => setModal(null)} title="Capture bank transaction" footer={<ActionFooter label="Capture" processing={txnForm.processing} form="bank-txn-form" onCancel={() => setModal(null)} />}>
                <form id="bank-txn-form" onSubmit={submitTxn} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Bank account" id="bank_account_id" value={txnForm.data.bank_account_id} onChange={(e) => txnForm.setData('bank_account_id', e.target.value)} error={txnForm.errors.bank_account_id} className="sm:col-span-2">
                            <option value="">Select account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>
                            ))}
                        </Select>
                        <TextInput label="Date" id="transaction_date" type="date" value={txnForm.data.transaction_date} onChange={(e) => txnForm.setData('transaction_date', e.target.value)} error={txnForm.errors.transaction_date} />
                        <Select label="Type" id="type" value={txnForm.data.type} onChange={(e) => txnForm.setData('type', e.target.value)} error={txnForm.errors.type}>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
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

            <Modal open={modal === 'reconciliation'} onClose={() => setModal(null)} title="Start reconciliation" footer={<ActionFooter label="Start" processing={reconForm.processing} form="recon-form" onCancel={() => setModal(null)} />}>
                <form id="recon-form" onSubmit={submitRecon} className="space-y-4">
                    <Select label="Bank account" id="bank_account_id" value={reconForm.data.bank_account_id} onChange={(e) => reconForm.setData('bank_account_id', e.target.value)} error={reconForm.errors.bank_account_id}>
                        <option value="">Select account</option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name} · book {currency(account.current_balance, account.currency)}</option>
                        ))}
                    </Select>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Statement date" id="statement_date" type="date" value={reconForm.data.statement_date} onChange={(e) => reconForm.setData('statement_date', e.target.value)} error={reconForm.errors.statement_date} />
                        <TextInput label="Statement balance" id="statement_balance" type="number" step="0.01" value={reconForm.data.statement_balance} onChange={(e) => reconForm.setData('statement_balance', e.target.value)} error={reconForm.errors.statement_balance} />
                    </div>
                    <Textarea label="Notes" id="notes" value={reconForm.data.notes} onChange={(e) => reconForm.setData('notes', e.target.value)} error={reconForm.errors.notes} rows={3} />
                </form>
            </Modal>

            <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="New bank transfer" footer={<ActionFooter label="Transfer" processing={transferForm.processing} form="transfer-form" onCancel={() => setModal(null)} />}>
                <form id="transfer-form" onSubmit={submitTransfer} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="From account" id="from_bank_account_id" value={transferForm.data.from_bank_account_id} onChange={(e) => transferForm.setData('from_bank_account_id', e.target.value)} error={transferForm.errors.from_bank_account_id}>
                            <option value="">Select account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </Select>
                        <Select label="To account" id="to_bank_account_id" value={transferForm.data.to_bank_account_id} onChange={(e) => transferForm.setData('to_bank_account_id', e.target.value)} error={transferForm.errors.to_bank_account_id}>
                            <option value="">Select account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </Select>
                        <TextInput label="Amount" id="amount" type="number" step="0.01" value={transferForm.data.amount} onChange={(e) => transferForm.setData('amount', e.target.value)} error={transferForm.errors.amount} />
                        <TextInput label="Transfer date" id="transfer_date" type="date" value={transferForm.data.transfer_date} onChange={(e) => transferForm.setData('transfer_date', e.target.value)} error={transferForm.errors.transfer_date} />
                        <TextInput label="Reference" id="reference" value={transferForm.data.reference} onChange={(e) => transferForm.setData('reference', e.target.value)} error={transferForm.errors.reference} className="sm:col-span-2" />
                    </div>
                    <Textarea label="Notes" id="notes" value={transferForm.data.notes} onChange={(e) => transferForm.setData('notes', e.target.value)} error={transferForm.errors.notes} rows={3} />
                </form>
            </Modal>
        </AppLayout>
    );
}

function ActionFooter({ label, processing, form, onCancel }) {
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
