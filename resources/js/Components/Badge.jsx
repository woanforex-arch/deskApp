const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

const dots = {
    slate: 'bg-slate-400',
    zinc: 'bg-zinc-400',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    brand: 'bg-brand-500',
};

export default function Badge({ tone = 'slate', dot = false, className = '', children }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                tones[tone] ?? tones.slate
            } ${className}`}
        >
            {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone] ?? dots.slate}`} />}
            {children}
        </span>
    );
}
