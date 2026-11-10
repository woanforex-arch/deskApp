import { Head, Link, useForm } from '@inertiajs/react';
import GuestLayout from '../../Layouts/GuestLayout';
import { TextInput } from '../../Components/FormControls';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post('/register', {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout
            title="Create your workspace"
            subtitle="Start with a seeded chart of accounts and a clean ledger."
            footer={
                <>
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                        Sign in
                    </Link>
                </>
            }
        >
            <Head title="Create account" />

            <form onSubmit={submit} className="space-y-5">
                <TextInput
                    id="name"
                    label="Full name"
                    name="name"
                    value={data.name}
                    autoComplete="name"
                    autoFocus
                    onChange={(event) => setData('name', event.target.value)}
                    error={errors.name}
                    placeholder="Avery Chen"
                />

                <TextInput
                    id="email"
                    label="Email address"
                    type="email"
                    name="email"
                    value={data.email}
                    autoComplete="username"
                    onChange={(event) => setData('email', event.target.value)}
                    error={errors.email}
                    placeholder="you@company.com"
                />

                <TextInput
                    id="password"
                    label="Password"
                    type="password"
                    name="password"
                    value={data.password}
                    autoComplete="new-password"
                    onChange={(event) => setData('password', event.target.value)}
                    error={errors.password}
                    hint="Use at least 8 characters."
                />

                <TextInput
                    id="password_confirmation"
                    label="Confirm password"
                    type="password"
                    name="password_confirmation"
                    value={data.password_confirmation}
                    autoComplete="new-password"
                    onChange={(event) => setData('password_confirmation', event.target.value)}
                    error={errors.password_confirmation}
                />

                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Creating account…' : 'Create account'}
                </button>
            </form>
        </GuestLayout>
    );
}
