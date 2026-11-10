import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    CheckIcon,
    ClipboardDocumentIcon,
    KeyIcon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import Badge from '../../Components/Badge';
import Modal from '../../Components/Modal';
import EmptyState from '../../Components/EmptyState';
import { Checkbox, TextInput } from '../../Components/FormControls';

const abilityLabels = {
    '*': 'Full access',
    read: 'Read',
    write: 'Write',
};

const abilityDescriptions = {
    '*': 'Read and write access to every resource.',
    read: 'View accounts, contacts, invoices, and reports.',
    write: 'Create invoices, payments, contacts, and journal entries.',
};

function TokenRow({ token, onRevoke }) {
    return (
        <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{token.name}</p>
                    <div className="flex flex-wrap gap-1">
                        {token.abilities.map((ability) => (
                            <Badge key={ability} tone={ability === '*' ? 'violet' : 'slate'}>
                                {abilityLabels[ability] ?? ability}
                            </Badge>
                        ))}
                    </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                    Created {token.created_at ?? '—'}
                    {token.last_used_at ? ` · Last used ${token.last_used_at}` : ' · Never used'}
                </p>
            </div>

            <button
                type="button"
                onClick={() => onRevoke(token)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
                <TrashIcon className="h-3.5 w-3.5" />
                Revoke
            </button>
        </li>
    );
}

export default function ApiTokensIndex({ tokens, apiBaseUrl }) {
    const { flash } = usePage().props;
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        name: '',
        abilities: ['read'],
    });

    const openCreate = () => {
        clearErrors();
        setCreating(true);
    };

    const closeCreate = () => {
        setCreating(false);
        reset();
        clearErrors();
    };

    const toggleAbility = (ability) => {
        if (ability === '*') {
            setData('abilities', data.abilities.includes('*') ? [] : ['*']);
            return;
        }

        const withoutFull = data.abilities.filter((item) => item !== '*');
        const next = withoutFull.includes(ability)
            ? withoutFull.filter((item) => item !== ability)
            : [...withoutFull, ability];

        setData('abilities', next);
    };

    const submit = (event) => {
        event.preventDefault();
        post('/api-tokens', {
            preserveScroll: true,
            onSuccess: () => {
                setCreating(false);
                reset();
            },
        });
    };

    const revoke = (token) => {
        if (window.confirm(`Revoke “${token.name}”? Applications using this token will lose access.`)) {
            router.delete(`/api-tokens/${token.id}`, { preserveScroll: true });
        }
    };

    const copyToken = async () => {
        try {
            await navigator.clipboard.writeText(flash.plain_text_token);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <AppLayout>
            <Head title="API tokens" />

            <div className="space-y-6">
                <PageHeader
                    eyebrow="Integrations"
                    title="API tokens"
                    description="Issue Sanctum bearer tokens for scripts, integrations, and external tools."
                >
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New token
                    </button>
                </PageHeader>

                {flash.plain_text_token && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-amber-900">Copy your new token now</p>
                                <p className="mt-1 text-xs text-amber-700">
                                    For security, this token will not be shown again after you leave this page.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={copyToken}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                            >
                                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs text-amber-200">
                            {flash.plain_text_token}
                        </code>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-2">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="font-display text-base font-semibold text-slate-900">Active tokens</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Tokens authenticate requests to the REST API with a Bearer header.
                            </p>
                        </div>

                        {tokens.length === 0 ? (
                            <EmptyState
                                title="No API tokens yet"
                                description="Create a token to connect a script, dashboard, or integration."
                                icon={KeyIcon}
                                action={
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Create token
                                    </button>
                                }
                            />
                        ) : (
                            <ul className="divide-y divide-slate-100 px-5">
                                {tokens.map((token) => (
                                    <TokenRow key={token.id} token={token} onRevoke={revoke} />
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">API base URL</h2>
                            <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-slate-200">
                                {apiBaseUrl}
                            </code>
                            <p className="mt-3 text-xs leading-relaxed text-slate-500">
                                Send the token as <span className="font-mono text-slate-700">Authorization: Bearer &lt;token&gt;</span>.
                                Authenticate with <span className="font-mono text-slate-700">POST /auth/login</span> to
                                obtain one programmatically.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                            <h2 className="font-display text-base font-semibold text-slate-900">Quick reference</h2>
                            <ul className="mt-3 space-y-2 text-xs text-slate-500">
                                {[
                                    ['GET', '/reports/dashboard'],
                                    ['GET', '/reports/trial-balance'],
                                    ['GET', '/reports/profit-loss'],
                                    ['GET', '/invoices'],
                                    ['POST', '/journal-entries'],
                                ].map(([method, path]) => (
                                    <li key={path} className="flex items-center gap-2">
                                        <span className="w-10 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-600">
                                            {method}
                                        </span>
                                        <span className="truncate font-mono text-slate-600">{path}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={creating}
                onClose={closeCreate}
                title="Create API token"
                description="Give the token a recognizable name and choose its abilities."
                footer={
                    <>
                        <button
                            type="button"
                            onClick={closeCreate}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="create-token-form"
                            disabled={processing}
                            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {processing ? 'Creating…' : 'Create token'}
                        </button>
                    </>
                }
            >
                <form id="create-token-form" onSubmit={submit} className="space-y-5">
                    <TextInput
                        id="token-name"
                        label="Token name"
                        value={data.name}
                        onChange={(event) => setData('name', event.target.value)}
                        error={errors.name}
                        placeholder="Reporting script"
                        autoFocus
                    />

                    <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">Abilities</p>
                        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                            {['read', 'write', '*'].map((ability) => (
                                <Checkbox
                                    key={ability}
                                    id={`ability-${ability}`}
                                    label={abilityLabels[ability]}
                                    description={abilityDescriptions[ability]}
                                    checked={data.abilities.includes(ability)}
                                    onChange={() => toggleAbility(ability)}
                                />
                            ))}
                        </div>
                        {errors.abilities && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.abilities}</p>}
                        {errors['abilities.0'] && (
                            <p className="mt-1.5 text-xs font-medium text-rose-600">{errors['abilities.0']}</p>
                        )}
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
