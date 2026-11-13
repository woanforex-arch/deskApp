import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDaysIcon, CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Corporate form controls.
 *
 * The fields share a crisp, classic treatment: a quiet uppercase label, a
 * 1px slate border, a soft inset highlight and an inset affix cell that holds
 * the dropdown chevron or the calendar affordance. Keeping it in one place
 * means every page inherits the same look.
 */
export const fieldShellClasses =
    'block w-full rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export const inputClasses = `${fieldShellClasses} px-3.5 py-2.5`;

export const selectClasses = `${fieldShellClasses} appearance-none py-2.5 pl-3.5 pr-12`;

const affixClasses =
    'pointer-events-none absolute inset-y-1 right-1 flex w-8 items-center justify-center rounded-[5px] border-l border-slate-200 bg-slate-50 text-slate-500';

export function FieldError({ children }) {
    if (!children) {
        return null;
    }

    return <p className="mt-1.5 text-xs font-medium text-rose-600">{children}</p>;
}

export function Label({ htmlFor, children, className = '' }) {
    return (
        <label
            htmlFor={htmlFor}
            className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${className}`}
        >
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

export function DateInput({ label, id, error, hint, className = '', ...props }) {
    const inputRef = useRef(null);

    return (
        <div className={className}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <div className="relative">
                <input
                    ref={inputRef}
                    id={id}
                    type="date"
                    className={`${selectClasses} date-input tabular-nums ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                    {...props}
                />
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => inputRef.current?.showPicker?.()}
                    className={`${affixClasses} transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none`}
                    aria-label="Open date picker"
                >
                    <CalendarDaysIcon className="h-4 w-4" />
                </button>
            </div>
            {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
            <FieldError>{error}</FieldError>
        </div>
    );
}

export function Select({ label, id, error, hint, className = '', children, ...props }) {
    return (
        <div className={className}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <div className="relative">
                <select id={id} className={`${selectClasses} ${error ? 'border-rose-300' : ''}`} {...props}>
                    {children}
                </select>
                <span className={affixClasses} aria-hidden="true">
                    <ChevronDownIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
            </div>
            {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
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

/**
 * A rich dropdown for choices that deserve more than one cramped line of
 * native option text — e.g. open invoices. Searchable popover with rows of
 * { value, primary, secondary, meta, badge: { label, classes } }, keyboard
 * support (arrows/enter/escape) and click-outside dismissal.
 */
export function RichSelect({ label, id, value, onChange, error, hint, disabled = false, options = [], placeholder = 'Select…', emptyText = 'Nothing found', className = '' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [panelStyle, setPanelStyle] = useState(null);
    const wrapperRef = useRef(null);
    const triggerRef = useRef(null);
    const searchRef = useRef(null);

    const selected = options.find((option) => String(option.value) === String(value));

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (!needle) {
            return options;
        }

        return options.filter((option) =>
            `${option.primary ?? ''} ${option.secondary ?? ''} ${option.meta ?? ''}`.toLowerCase().includes(needle),
        );
    }, [options, query]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        // Fixed positioning anchored to the trigger escapes overflow-hidden
        // cards and keeps the panel above modals (z-60).
        const trigger = triggerRef.current;

        if (trigger) {
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 340 && rect.top > spaceBelow;

            setPanelStyle({
                position: 'fixed',
                top: openUp ? undefined : rect.bottom + 6,
                bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                left: rect.left,
                width: rect.width,
                zIndex: 60,
            });
        }

        const onDocMouseDown = (event) => {
            if (!wrapperRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        // Any scroll/resize outside this control closes the panel — simpler
        // and safer than re-tracking the trigger position.
        const onScrollOrResize = (event) => {
            if (wrapperRef.current?.contains(event.target)) {
                return;
            }

            close();
        };

        document.addEventListener('mousedown', onDocMouseDown);
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        searchRef.current?.focus();

        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open]);

    const close = () => {
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
    };

    const pick = (option) => {
        onChange(option.value);
        close();
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + delta + filtered.length) % filtered.length));
            return;
        }

        if (event.key === 'Enter' && filtered[activeIndex]) {
            event.preventDefault();
            pick(filtered[activeIndex]);
        }
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {label && <Label htmlFor={id}>{label}</Label>}
            <button
                ref={triggerRef}
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => (open ? close() : setOpen(true))}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`${fieldShellClasses} flex items-center justify-between gap-3 px-3.5 py-2.5 text-left ${error ? 'border-rose-300' : ''}`}
            >
                {selected ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="truncate font-medium text-slate-900">{selected.primary}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{selected.meta}</span>
                    </span>
                ) : (
                    <span className="font-normal text-slate-400">{placeholder}</span>
                )}
                <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
                    style={panelStyle}
                    role="listbox"
                >
                    <div className="relative border-b border-slate-100">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={onKeyDown}
                            placeholder="Search…"
                            className="w-full bg-transparent px-10 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto p-1.5">
                        {filtered.map((option, index) => {
                            const isSelected = String(option.value) === String(value);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => pick(option)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                                        index === activeIndex ? 'bg-slate-100' : ''
                                    } ${isSelected ? 'bg-brand-50' : ''}`}
                                >
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold text-slate-900">{option.primary}</span>
                                            {option.badge && (
                                                <span
                                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${option.badge.classes ?? 'bg-slate-100 text-slate-600'}`}
                                                >
                                                    {option.badge.label}
                                                </span>
                                            )}
                                        </span>
                                        {option.secondary && (
                                            <span className="mt-0.5 block truncate text-xs text-slate-500">{option.secondary}</span>
                                        )}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        {option.meta && (
                                            <span className="text-sm font-semibold tabular-nums text-slate-900">{option.meta}</span>
                                        )}
                                        {isSelected && <CheckIcon className="h-4 w-4 text-brand-600" />}
                                    </span>
                                </button>
                            );
                        })}

                        {filtered.length === 0 && (
                            <p className="px-3 py-6 text-center text-xs text-slate-500">{emptyText}</p>
                        )}
                    </div>
                </div>
            )}

            {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
            <FieldError>{error}</FieldError>
        </div>
    );
}
