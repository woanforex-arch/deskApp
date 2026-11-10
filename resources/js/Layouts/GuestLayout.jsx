import { Link, usePage } from '@inertiajs/react';
import FlashMessages from '../Components/FlashMessages';

export default function GuestLayout({ title, subtitle, children, footer }) {
    const { appName } = usePage().props;

    return (
        <div className="flex min-h-screen bg-slate-950">
            <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex">
                <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
                <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.18),transparent_45%)]" />

                <div className="relative flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-lg font-bold text-white shadow-lg shadow-brand-900/40">
                        L
                    </span>
                    <div>
                        <p className="font-display text-lg font-semibold tracking-tight text-white">
                            {appName || 'Ledgerly'}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
                            Accounting workspace
                        </p>
                    </div>
                </div>

                <div className="relative max-w-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-300">
                        Double-entry, done properly
                    </p>
                    <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-white text-balance">
                        Every invoice, payment, and journal entry in one clear ledger.
                    </h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                        Track receivables, reconcile the trial balance, and expose a clean REST API to your
                        own tooling — all from a single workspace.
                    </p>

                    <dl className="mt-8 grid grid-cols-3 gap-4">
                        {[
                            ['2×', 'Entry bookkeeping'],
                            ['REST', 'Sanctum API'],
                            ['YTD', 'Live reporting'],
                        ].map(([value, label]) => (
                            <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <dt className="font-display text-lg font-semibold text-white">{value}</dt>
                                <dd className="mt-0.5 text-[11px] text-slate-400">{label}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <p className="relative text-xs text-slate-500">
                    © {new Date().getFullYear()} {appName || 'Ledgerly'}. Built with Laravel, Inertia & React.
                </p>
            </div>

            <div className="flex w-full flex-col justify-center bg-slate-50 px-5 py-10 sm:px-10 lg:w-1/2 lg:px-16">
                <div className="mx-auto w-full max-w-sm">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white">
                            L
                        </span>
                        <p className="font-display text-lg font-semibold tracking-tight text-slate-900">
                            {appName || 'Ledgerly'}
                        </p>
                    </div>

                    <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
                    {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}

                    <div className="mt-8">{children}</div>

                    {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
                </div>
            </div>

            <FlashMessages />
        </div>
    );
}
