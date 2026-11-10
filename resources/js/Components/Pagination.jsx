import { Link } from '@inertiajs/react';
import { decodePaginationLabel } from '../lib/format';

export default function Pagination({ paginator, className = '' }) {
    if (!paginator || !paginator.links || paginator.last_page <= 1) {
        return null;
    }

    return (
        <div className={`flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{paginator.from ?? 0}</span>–
                <span className="font-semibold text-slate-700">{paginator.to ?? 0}</span> of{' '}
                <span className="font-semibold text-slate-700">{paginator.total ?? 0}</span> results
            </p>

            <div className="flex flex-wrap items-center gap-1">
                {paginator.links.map((link, index) => {
                    const label = decodePaginationLabel(link.label);
                    const isPrevious = index === 0;
                    const isNext = index === paginator.links.length - 1;

                    if (!link.url) {
                        return (
                            <span
                                key={`${label}-${index}`}
                                className="inline-flex h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-300"
                            >
                                {isPrevious ? 'Previous' : isNext ? 'Next' : label}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={`${label}-${index}`}
                            href={link.url}
                            preserveScroll
                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition ${
                                link.active
                                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                            }`}
                        >
                            {isPrevious ? 'Previous' : isNext ? 'Next' : label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
