import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import GuestLayout from '../../Layouts/GuestLayout';
import { Checkbox, TextInput } from '../../Components/FormControls';

export default function Login({ status }) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (event) => {
        event.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    const useDemo = () => {
        setData({ email: 'admin@ledgerly.test', password: 'password', remember: true });
    };

    return (
        <GuestLayout
            title="Welcome back"
            subtitle="Sign in to your accounting workspace."
            footer={
                <>
                    New to Ledgerly?{' '}
                    <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
                        Create an account
                    </Link>
                </>
            }
        >
            <Head title="Sign in" />

            {status && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <TextInput
                    id="email"
                    label="Email address"
                    type="email"
                    name="email"
                    value={data.email}
                    autoComplete="username"
                    autoFocus
                    onChange={(event) => setData('email', event.target.value)}
                    error={errors.email}
                    placeholder="you@company.com"
                />

                <TextInput
                    id="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={data.password}
                    autoComplete="current-password"
                    onChange={(event) => setData('password', event.target.value)}
                    error={errors.password}
                    placeholder="••••••••"
                    trailing={
                        <button
                            type="button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                            title={showPassword ? 'Hide password' : 'Show password'}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    }
                />

                <div className="flex items-center justify-between">
                    <Checkbox
                        id="remember"
                        label="Remember me"
                        checked={data.remember}
                        onChange={(event) => setData('remember', event.target.checked)}
                    />
                    <span className="text-xs text-slate-400">Session secured with CSRF</span>
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Demo workspace
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">admin@ledgerly.test</span> · password
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={useDemo}
                        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                    >
                        Fill
                    </button>
                </div>
            </div>
        </GuestLayout>
    );
}
