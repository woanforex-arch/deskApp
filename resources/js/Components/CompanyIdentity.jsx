import { usePage } from '@inertiajs/react';

/**
 * Letterhead for the registered legal entity. Falls back to the shared
 * company prop so every page and printed document can use the same details:
 * logo, trading/business names, business type, contacts, addresses and
 * statutory numbers.
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

    const alignment = align === 'right' ? 'text-right' : align === 'center' ? 'text-center items-center' : '';

    const meta = [
        company.registration_number ? `Reg. ${company.registration_number}` : null,
        company.tax_number ? `Tax ${company.tax_number}` : null,
        company.code ? company.code : null,
        company.base_currency ? `${company.base_currency} reporting` : null,
    ].filter(Boolean);

    const addresses = [
        company.address ? ['Location', company.address] : null,
        company.postal_address ? ['Postal address', company.postal_address] : null,
    ].filter(Boolean);

    const contacts = [
        company.business_email ? { label: 'Email', value: company.business_email, href: `mailto:${company.business_email}` } : null,
        company.website ? { label: 'Web', value: company.website, href: company.website } : null,
    ].filter(Boolean);

    const logo = company.logo_url
        ? (
                <img
                    src={company.logo_url}
                    alt={`${company.name} logo`}
                    className={`flex-none border border-slate-200 bg-white object-contain p-1 shadow-sm ${size === 'lg' ? 'h-14 w-14 rounded-xl' : 'h-10 w-10 rounded-lg'}`}
                />
            )
        : null;

    return (
        <div className={`flex gap-3 ${alignment}`}>
            {logo}
            <div className={align === 'center' ? 'text-left' : ''}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className={`${nameClass} tracking-tight text-slate-900`}>{company.name}</p>
                    {company.trading_name && company.trading_name !== company.name && (
                        <p className="text-xs text-slate-500">Trading as {company.trading_name}</p>
                    )}
                    {company.business_type && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {company.business_type}
                        </span>
                    )}
                </div>

                {addresses.map(([label, value]) => (
                    <p key={label} className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">
                        <span className="font-medium text-slate-400">{label}:</span> {value}
                    </p>
                ))}

                {(contacts.length > 0 || meta.length > 0) && (
                    <p className="mt-1 text-xs text-slate-500">
                        {contacts.map((contact) => (
                            <span key={contact.label} className="mr-3">
                                <a
                                    href={contact.label === 'Email' ? contact.href : undefined}
                                    target={contact.label === 'Web' ? '_blank' : undefined}
                                    rel={contact.label === 'Web' ? 'noreferrer' : undefined}
                                    className={contact.label === 'Email' ? 'hover:text-brand-600' : undefined}
                                >
                                    {contact.value}
                                </a>
                            </span>
                        ))}
                        {meta.join(' · ')}
                    </p>
                )}
            </div>
        </div>
    );
}
