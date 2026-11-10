export default function PageHeader({ eyebrow, title, description, children }) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
                )}
                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {title}
                </h1>
                {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>}
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}
