export const inputClasses =
    'block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50';

export const selectClasses =
    'block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function FieldError({ children }) {
    if (!children) {
        return null;
    }

    return <p className="mt-1.5 text-xs font-medium text-rose-600">{children}</p>;
}

export function Label({ htmlFor, children, className = '' }) {
    return (
        <label htmlFor={htmlFor} className={`mb-1.5 block text-sm font-medium text-slate-700 ${className}`}>
            {children}
        </label>
    );
}

export function TextInput({ label, id, error, hint, trailing, className = '', ...props }) {
    return (
        <div className={className}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <div className="relative">
                <input
                    id={id}
                    className={`${inputClasses} ${trailing ? 'pr-11' : ''} ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                    {...props}
                />
                {trailing && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>
                )}
            </div>
            {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
            <FieldError>{error}</FieldError>
        </div>
    );
}

export function Select({ label, id, error, className = '', children, ...props }) {
    return (
        <div className={className}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <select id={id} className={`${selectClasses} ${error ? 'border-rose-300' : ''}`} {...props}>
                {children}
            </select>
            <FieldError>{error}</FieldError>
        </div>
    );
}

export function Textarea({ label, id, error, className = '', ...props }) {
    return (
        <div className={className}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <textarea id={id} className={`${inputClasses} min-h-24 resize-y ${error ? 'border-rose-300' : ''}`} {...props} />
            <FieldError>{error}</FieldError>
        </div>
    );
}

export function Checkbox({ label, id, description, className = '', ...props }) {
    return (
        <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 ${className}`}>
            <input
                id={id}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 shadow-sm focus:ring-brand-500"
                {...props}
            />
            <span>
                <span className="block text-sm font-medium text-slate-700">{label}</span>
                {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
            </span>
        </label>
    );
}
