import { usePage } from '@inertiajs/react';

/**
 * Letterhead for the registered legal entity. Falls back to the shared
 * company prop so every page and printed document can use the same details.
 */
export default function CompanyIdentity({ company: provided, size = 'md', align = 'left', showMeta = true, className = '' }) {
    const sharedCompany = usePage().props.company;
    const company = provided ?? sharedCompany;

    if (!company?.name) {
        return null;
    }

    const nameClass = size === 'lg'
        ? 'font-display text-xl font-semibold'
        : 'font-display text-base font-semibold';

    const alignment = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';

    const meta = [
        company.registration_number ? `Reg. ${company.registration_number}` : null,
        company.tax_number ? `Tax ${company.tax_number}` : null,
        company.code ? company.code : null,
    ].filter(Boolean);

    return (
        <div className={`${alignment} ${className}`}>
            <p className={`${nameClass} tracking-tight text-slate-900`}>{company.name}</p>
            {company.address && (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">{company.address}</p>
            )}
            {showMeta && meta.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">{meta.join(' · ')}</p>
            )}
        </div>
    );
}
