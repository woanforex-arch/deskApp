const accents = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function StatCard({ label, value, hint, icon: Icon, accent = 'brand', trend, className = '', onClick, active = false, activeLabel }) {
    const interactive = typeof onClick === 'function';

    const content = (
        <>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-2 truncate font-display text-2xl font-semibold tracking-tight text-slate-900">
                        {value}
                    </p>
                    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
                </div>
                {Icon && (
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${accents[accent] ?? accents.brand}`}>
                        <Icon className="h-5 w-5" />
                    </span>
                )}
            </div>
            {trend && (
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500">{trend}</div>
            )}
        </>
    );

    const classes = [
        'relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition',
        active ? 'border-brand-300 ring-2 ring-brand-500/20' : 'border-slate-200/80',
        interactive
            ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'
            : 'hover:-translate-y-0.5 hover:shadow-md',
        className,
    ].join(' ');

    if (interactive) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-pressed={active}
                aria-label={activeLabel}
                title={activeLabel}
                className={`w-full ${classes}`}
            >
                {content}
            </button>
        );
    }

    return <div className={classes}>{content}</div>;
}
