import { usePage } from '@inertiajs/react';

const displayWebsite = (website) => String(website ?? '').replace(/^https?:\/\//i, '').replace(/\/$/, '');

const websiteHref = (website) => {
    const value = String(website ?? '').trim();
    if (!value) {
        return undefined;
    }

    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

/**
 * Formal letterhead for the registered legal entity. Two layouts are provided:
 *
 * - `document` (default): a corporate letterhead for invoices, bills and forms,
 *   with the identity on the left and address/statutory details on the right.
 * - `report`: a classic centred letterhead for formal financial statements.
 */
export default function CompanyIdentity({
    company: provided,
    size = 'md',
    align = 'left',
    showMeta = true,
    variant = 'document',
    className = '',
}) {
    const sharedCompany = usePage().props.company;
    const company = provided ?? sharedCompany;

    if (!company?.name) {
        return null;
    }

    const large = size === 'lg';
    const report = variant === 'report';
    const logoClass = large ? 'h-16 w-16 rounded-xl p-2' : 'h-12 w-12 rounded-lg p-1.5';
    const nameClass = large ? 'text-xl' : 'text-lg';

    const tradingAs = company.trading_name && company.trading_name !== company.name ? company.trading_name : null;

    const addresses = [company.address ?? company.physical_address, company.postal_address].filter(Boolean);
    const contacts = [
        company.business_email
            ? { label: 'Email', value: company.business_email, href: `mailto:${company.business_email}` }
            : null,
        company.website
            ? { label: 'Web', value: displayWebsite(company.website), href: websiteHref(company.website) }
            : null,
    ].filter(Boolean);
    const statutory = [
        company.registration_number ? ['Reg. No.', company.registration_number] : null,
        company.tax_number ? ['Tax ID', company.tax_number] : null,
        company.code ? ['Company code', company.code] : null,
        company.base_currency ? ['Reporting', company.base_currency] : null,
    ].filter(Boolean);

    const logo = company.logo_url ? (
        <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className={`flex-none border border-slate-200 bg-white object-contain shadow-sm ${logoClass}`}
        />
    ) : null;

    if (report) {
        return (
            <div className={`text-center ${className}`}>
                <div className="flex flex-col items-center">
                    {logo && <div className="mb-3">{logo}</div>}
                    <p className={`font-display font-semibold uppercase tracking-[0.14em] text-slate-900 ${large ? 'text-2xl' : 'text-xl'}`}>
                        {company.name}
                    </p>
                    {tradingAs && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Trading as {tradingAs}
                        </p>
                    )}
                    {company.business_type && (
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                            {company.business_type}
                        </p>
                    )}
                </div>

                {(addresses.length > 0 || contacts.length > 0) && (
                    <div className="mx-auto mt-3 max-w-2xl space-y-1 text-[11px] leading-relaxed text-slate-600">
                        {addresses.map((line, index) => (
                            <p key={`${line}-${index}`} className="whitespace-pre-line">
                                {line}
                            </p>
                        ))}
                        {contacts.length > 0 && (
                            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                                {contacts.map((contact) => (
                                    <a
                                        key={contact.label}
                                        href={contact.href}
                                        target={contact.label === 'Web' ? '_blank' : undefined}
                                        rel={contact.label === 'Web' ? 'noreferrer' : undefined}
                                        className="hover:text-brand-700"
                                    >
                                        {contact.value}
                                    </a>
                                ))}
                            </p>
                        )}
                    </div>
                )}

                {showMeta && statutory.length > 0 && (
                    <div className="mx-auto mt-2 flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                        {statutory.map(([label, value]) => (
                            <span key={label}>
                                {label} <span className="text-slate-600">{value}</span>
                            </span>
                        ))}
                    </div>
                )}

                <div className="mx-auto mt-5 max-w-3xl border-t-2 border-slate-900" />
            </div>
        );
    }

    const alignment = align === 'right' ? 'text-right' : '';

    return (
        <div className={className}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    {logo}
                    <div className="min-w-0">
                        <p className={`font-display font-semibold tracking-tight text-slate-900 ${nameClass}`}>{company.name}</p>
                        {tradingAs && (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Trading as {tradingAs}
                            </p>
                        )}
                        {company.business_type && (
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-brand-600">
                                {company.business_type}
                            </p>
                        )}
                    </div>
                </div>

                <div className={`min-w-0 text-xs leading-relaxed text-slate-600 sm:max-w-xs sm:text-right ${alignment}`}>
                    {addresses.map((line, index) => (
                        <p key={`${line}-${index}`} className={index === 0 ? 'font-medium text-slate-700 whitespace-pre-line' : 'mt-0.5 whitespace-pre-line'}>
                            {line}
                        </p>
                    ))}

                    {contacts.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 sm:justify-end">
                            {contacts.map((contact) => (
                                <a
                                    key={contact.label}
                                    href={contact.href}
                                    target={contact.label === 'Web' ? '_blank' : undefined}
                                    rel={contact.label === 'Web' ? 'noreferrer' : undefined}
                                    className="hover:text-brand-700"
                                >
                                    {contact.value}
                                </a>
                            ))}
                        </p>
                    )}

                    {showMeta && statutory.length > 0 && (
                        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:justify-end">
                            {statutory.map(([label, value]) => (
                                <span key={label}>
                                    {label} <span className="text-slate-600">{value}</span>
                                </span>
                            ))}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
