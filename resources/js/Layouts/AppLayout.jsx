import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowPathIcon,
    ArrowRightOnRectangleIcon,
    ArrowTrendingUpIcon,
    ArrowsRightLeftIcon,
    BanknotesIcon,
    Bars3Icon,
    BookOpenIcon,
    BuildingOffice2Icon,
    CalculatorIcon,
    ChartBarIcon,
    ChartPieIcon,
    ChevronDownIcon,
    ClipboardDocumentListIcon,
    CubeIcon,
    CurrencyDollarIcon,
    DocumentDuplicateIcon,
    DocumentTextIcon,
    GlobeAltIcon,
    KeyIcon,
    PaperClipIcon,
    PlusCircleIcon,
    ReceiptPercentIcon,
    ScaleIcon,
    ServerStackIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    UsersIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import FlashMessages from '../Components/FlashMessages';
import { configureMoney, getDisplayCurrency, initials, setDisplayCurrency } from '../lib/format';

const navigationGroups = [
    {
        label: 'Overview',
        items: [{ name: 'Dashboard', href: '/dashboard', icon: ChartPieIcon }],
    },
    {
        label: 'Ledger',
        items: [
            { name: 'Enter transaction', href: '/journal?compose=1', icon: PlusCircleIcon },
            { name: 'General journal', href: '/journal', icon: BookOpenIcon },
        ],
    },
    {
        label: 'Receivables',
        items: [
            { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon },
            { name: 'Credit notes', href: '/credit-notes', icon: DocumentDuplicateIcon },
        ],
    },
    {
        label: 'Payables',
        items: [
            { name: 'Bills', href: '/bills', icon: ReceiptPercentIcon },
            { name: 'Vendor payments', href: '/vendor-payments', icon: BanknotesIcon },
        ],
    },
    {
        label: 'Banking & cash',
        items: [
            { name: 'Banking', href: '/banking', icon: ArrowsRightLeftIcon },
            { name: 'Cashbooks', href: '/cashbooks', icon: BanknotesIcon },
        ],
    },
    {
        label: 'Inventory & assets',
        items: [
            { name: 'Inventory', href: '/inventory', icon: CubeIcon },
            { name: 'Fixed assets', href: '/fixed-assets', icon: BuildingOffice2Icon },
        ],
    },
    {
        label: 'Payroll & tax',
        items: [
            { name: 'Payroll', href: '/payroll', icon: UserGroupIcon },
            { name: 'Tax & VAT', href: '/tax', icon: CalculatorIcon },
        ],
    },
    {
        label: 'Planning',
        items: [
            { name: 'Budgets', href: '/budgets', icon: ChartBarIcon },
            { name: 'Revenue recognition', href: '/revenue-schedules', icon: ArrowTrendingUpIcon },
            { name: 'Recurring transactions', href: '/recurring-transactions', icon: ArrowPathIcon },
            { name: 'Cost allocations', href: '/cost-allocations', icon: ScaleIcon },
        ],
    },
    {
        label: 'Organisation',
        items: [
            { name: 'Company registration', href: '/organisation/register', icon: BuildingOffice2Icon },
            { name: 'Structure & access', href: '/organisation', icon: UsersIcon },
            { name: 'Chart of accounts', href: '/accounts', icon: BanknotesIcon },
            { name: 'Reports', href: '/reports', icon: ClipboardDocumentListIcon },
            { name: 'Currencies & FX', href: '/currencies', icon: CurrencyDollarIcon },
        ],
    },
    {
        label: 'Controls',
        items: [
            { name: 'Periods & approvals', href: '/controls', icon: ShieldCheckIcon },
            { name: 'Documents & OCR', href: '/documents', icon: PaperClipIcon },
            { name: 'Audit history', href: '/audit', icon: ClipboardDocumentListIcon },
        ],
    },
    {
        label: 'Platform',
        items: [
            { name: 'Integrations & automation', href: '/platform', icon: ServerStackIcon, adminsOnly: true },
            { name: 'API tokens', href: '/api-tokens', icon: KeyIcon },
        ],
    },
];

const navigation = navigationGroups.flatMap((group) => group.items);

// Kept in memory only, so it survives Inertia visits but resets on a full
// page load or refresh.
let sidebarScrollPosition = 0;

function navIsActive(url, href) {
    const path = url.split('?')[0].replace(/\/$/, '') || '/';

    return path === href || path.startsWith(`${href}/`);
}

function SidebarContent({ url, user, company, onNavigate }) {
    const navRef = useRef(null);
    const hasRestoredScroll = useRef(false);

    const visibleGroups = navigationGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.adminsOnly || user?.is_admin),
        }))
        .filter((group) => group.items.length > 0);

    const activeHref = visibleGroups
        .flatMap((group) => group.items.map((item) => item.href))
        .filter((href) => navIsActive(url, href))
        .sort((a, b) => b.length - a.length)[0] ?? null;

    useLayoutEffect(() => {
        const nav = navRef.current;

        if (!nav) {
            return;
        }

        nav.scrollTop = sidebarScrollPosition;
        hasRestoredScroll.current = true;
    }, []);

    const handleSidebarScroll = () => {
        if (!navRef.current || !hasRestoredScroll.current) {
            return;
        }

        sidebarScrollPosition = navRef.current.scrollTop;
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-3 px-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display text-base font-bold text-white shadow-lg shadow-brand-900/40">
                    L
                </span>
                <div>
                    <p className="font-display text-base font-semibold tracking-tight text-white">Ledgerly</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Accounting</p>
                </div>
            </div>

            <div className="mx-4 mt-4 rounded-xl border border-white/5 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Registered entity</p>
                {company?.name ? (
                    <>
                        <div className="mt-1.5 flex items-center gap-2.5">
                            {company.logo_url ? (
                                <img
                                    src={company.logo_url}
                                    alt="Company logo"
                                    className="h-9 w-9 flex-none rounded-lg border border-white/10 bg-white object-contain p-0.5"
                                />
                            ) : (
                                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 font-display text-xs font-bold text-white">
                                    {company.name.slice(0, 2).toUpperCase()}
                                </span>
                            )}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-200">{company.name}</p>
                                <p className="truncate text-[10px] text-slate-400">
                                    {company.trading_name && company.trading_name !== company.name ? `Trading as ${company.trading_name}` : company.code}
                                </p>
                            </div>
                        </div>
                        {company.business_type && (
                            <p className="mt-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">{company.business_type}</p>
                        )}
                        {company.address && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{company.address}</p>
                        )}
                        {(company.business_email || company.website) && (
                            <p className="mt-1 truncate text-[11px] text-brand-300">
                                {company.website ?? company.business_email}
                            </p>
                        )}
                    </>
                ) : (
                    <Link
                        href="/organisation/register"
                        onClick={onNavigate}
                        className="mt-1 inline-flex text-xs font-semibold text-brand-300 transition hover:text-brand-200"
                    >
                        Register a company
                    </Link>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Fiscal year</span>
                    <span className="text-xs font-medium text-slate-200">{new Date().getFullYear()} · Open</span>
                </div>
            </div>

            <div className="relative mt-5 min-h-0 flex-1">
                <nav ref={navRef} onScroll={handleSidebarScroll} className="sidebar-scroll h-full space-y-5 overflow-y-auto px-3 pb-5">
                    {visibleGroups.map((group) => (
                        <div key={group.label} className="space-y-1">
                            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {group.label}
                            </p>
                            {group.items.map((item) => {
                                const active = item.href === activeHref;

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={onNavigate}
                                        data-sidebar-active={active ? 'true' : undefined}
                                        aria-current={active ? 'page' : undefined}
                                        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                                            active
                                                ? 'bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                        }`}
                                    >
                                        <item.icon
                                            className={`h-5 w-5 shrink-0 transition ${
                                                active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300'
                                            }`}
                                        />
                                        <span className="truncate">{item.name}</span>
                                        {active && (
                                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-slate-900 to-transparent"
                    aria-hidden="true"
                />
            </div>

            <div className="border-t border-white/5 p-3">
                <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/10">
                        {initials(user?.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{user?.name}</p>
                        <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AppLayout({ children }) {
    const { url, props } = usePage();
    const user = props.auth?.user;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [preferredCurrency, setPreferredCurrency] = useState(() => getDisplayCurrency());
    const money = configureMoney(props.money, preferredCurrency);

    useEffect(() => {
        setMobileOpen(false);
    }, [url]);

    const changeDisplayCurrency = (event) => {
        const code = event.target.value;

        if (code === '__manage') {
            router.visit('/currencies');
            return;
        }

        if (code === money.display) {
            return;
        }

        setDisplayCurrency(code);
        setPreferredCurrency(code);
        router.reload({ preserveScroll: true, preserveState: true });
    };

    return (
        <div className="min-h-full">
            <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">
                <SidebarContent url={url} user={user} company={props.company} />
            </aside>

            {mobileOpen && (
                <div className="no-print fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                        aria-hidden="true"
                    />
                    <aside className="relative h-full w-72 max-w-[85vw] bg-slate-900 shadow-2xl">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                            aria-label="Close navigation"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                        <SidebarContent url={url} user={user} company={props.company} onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </div>
            )}

            <div className="lg:pl-64 print:pl-0">
                <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                        aria-label="Open navigation"
                    >
                        <Bars3Icon className="h-5 w-5" />
                    </button>

                    <div className="flex flex-1 items-center gap-2 text-sm">
                        <span className="hidden text-slate-400 sm:inline">Workspace</span>
                        <span className="hidden text-slate-300 sm:inline">/</span>
                        <span className="font-medium text-slate-700">
                            {navigation.find((item) => navIsActive(url, item.href))?.name ?? 'Dashboard'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <GlobeAltIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <select
                                value={money.display}
                                onChange={changeDisplayCurrency}
                                title={
                                    money.display === money.base
                                        ? 'Display currency'
                                        : 'Display currency — amounts are converted at current exchange rates'
                                }
                                aria-label="Display currency"
                                className={`h-8 appearance-none rounded-full border py-0 pl-8 pr-7 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                                    money.display === money.base
                                        ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                        : 'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300'
                                }`}
                            >
                                {money.currencies.map((option) => (
                                    <option key={option.code} value={option.code}>
                                        {option.code}
                                    </option>
                                ))}
                                <option value="__manage">Manage currencies…</option>
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        </div>
                        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Books open
                        </span>
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white lg:hidden">
                            {initials(user?.name)}
                        </span>
                    </div>
                </header>

                <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">{children}</main>
            </div>

            <FlashMessages />
        </div>
    );
}
