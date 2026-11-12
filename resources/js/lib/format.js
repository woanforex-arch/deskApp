const DEFAULT_CURRENCY = 'USD';
const DISPLAY_CURRENCY_KEY = 'ledgerly.display-currency';

let baseCurrencyCode = DEFAULT_CURRENCY;
let displayCurrencyCode = DEFAULT_CURRENCY;
let currencyRates = { [DEFAULT_CURRENCY]: 1 };
let currencyOptions = [];

function normalizeCurrency(code) {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

// Some imported or hand-entered records use a currency symbol as the "code".
// Map the unambiguous ones to their ISO 4217 code so Intl can format them.
const CURRENCY_SYMBOL_ALIASES = {
    'GH₵': 'GHS',
    '₵': 'GHS',
};

const supportedCurrencyCache = new Map();

function canonicalCurrency(code) {
    const normalized = normalizeCurrency(code);

    return CURRENCY_SYMBOL_ALIASES[normalized] ?? normalized;
}

function isSupportedCurrency(code) {
    const candidate = canonicalCurrency(code);

    if (!/^[A-Z]{3}$/.test(candidate)) {
        return false;
    }

    if (supportedCurrencyCache.has(candidate)) {
        return supportedCurrencyCache.get(candidate);
    }

    let supported = false;

    try {
        new Intl.NumberFormat('en-US', { style: 'currency', currency: candidate });
        supported = true;
    } catch {
        supported = false;
    }

    supportedCurrencyCache.set(candidate, supported);

    return supported;
}

function formatCurrencyCode(code) {
    const candidate = canonicalCurrency(code);

    return isSupportedCurrency(candidate) ? candidate : DEFAULT_CURRENCY;
}

export function readStoredDisplayCurrency() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.localStorage.getItem(DISPLAY_CURRENCY_KEY);
    } catch {
        return null;
    }
}

export function configureMoney(config = {}, preferredDisplay = null) {
    const base = formatCurrencyCode(config.base || DEFAULT_CURRENCY);
    const options = Array.isArray(config.currencies) ? config.currencies : [];

    const rates = { [base]: 1 };
    const currencies = [];
    const seen = new Set();

    for (const option of options) {
        const code = canonicalCurrency(option.code);
        if (!isSupportedCurrency(code) || seen.has(code)) {
            continue;
        }

        const rate = Number(option.rate);
        const safeRate = code === base ? 1 : Number.isFinite(rate) && rate > 0 ? rate : 1;
        rates[code] = safeRate;
        seen.add(code);
        currencies.push({ ...option, code, rate: safeRate });
    }

    const baseOptionIndex = currencies.findIndex((option) => option.code === base);

    if (baseOptionIndex === -1) {
        currencies.unshift({ code: base, name: base, symbol: null, rate: 1 });
    } else if (baseOptionIndex > 0) {
        const [baseOption] = currencies.splice(baseOptionIndex, 1);
        currencies.unshift(baseOption);
    }

    const available = new Set(Object.keys(rates));
    const requested =
        canonicalCurrency(preferredDisplay) ||
        canonicalCurrency(displayCurrencyCode) ||
        canonicalCurrency(readStoredDisplayCurrency()) ||
        base;

    baseCurrencyCode = base;
    displayCurrencyCode = available.has(requested) ? requested : base;
    currencyRates = rates;
    currencyOptions = currencies;

    return {
        base: baseCurrencyCode,
        display: displayCurrencyCode,
        rates: currencyRates,
        currencies: currencyOptions,
    };
}

export function setDisplayCurrency(code) {
    const next = canonicalCurrency(code);
    if (!next || !isSupportedCurrency(next)) {
        return;
    }

    displayCurrencyCode = next;

    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(DISPLAY_CURRENCY_KEY, next);
    } catch {
        // Storage can be unavailable in private browsing; the switch still works for this session.
    }
}

export function getDisplayCurrency() {
    return displayCurrencyCode;
}

function rateFor(code) {
    const normalized = canonicalCurrency(code) || baseCurrencyCode;

    if (normalized === baseCurrencyCode) {
        return 1;
    }

    const rate = Number(currencyRates[normalized]);

    return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function convertAmount(value, sourceCurrency) {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    const source = canonicalCurrency(sourceCurrency) || baseCurrencyCode;

    return amount * (rateFor(source) / rateFor(displayCurrencyCode));
}

export function currency(value, currencyCode = baseCurrencyCode, options = {}) {
    const { convert = true, ...numberFormatOptions } = options;
    const formatCurrency = formatCurrencyCode(convert ? displayCurrencyCode : currencyCode || baseCurrencyCode);
    const amount = convert ? convertAmount(value, currencyCode) : Number(value ?? 0);

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: formatCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...numberFormatOptions,
    }).format(Number.isFinite(amount) ? amount : 0);
}

export function compactCurrency(value, currencyCode = baseCurrencyCode, options = {}) {
    const { convert = true, ...numberFormatOptions } = options;
    const formatCurrency = formatCurrencyCode(convert ? displayCurrencyCode : currencyCode || baseCurrencyCode);
    const amount = convert ? convertAmount(value, currencyCode) : Number(value ?? 0);

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: formatCurrency,
        notation: 'compact',
        maximumFractionDigits: 1,
        ...numberFormatOptions,
    }).format(Number.isFinite(amount) ? amount : 0);
}

export function number(value, options = {}) {
    return new Intl.NumberFormat('en-US', options).format(Number(value ?? 0));
}

export function percent(value, digits = 1) {
    return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

export function formatDateTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

export function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function statusTone(status) {
    return {
        draft: 'slate',
        sent: 'sky',
        paid: 'emerald',
        overdue: 'rose',
        void: 'zinc',
        posted: 'emerald',
        customer: 'indigo',
        vendor: 'amber',
        both: 'violet',
    }[status] ?? 'slate';
}

export function decodePaginationLabel(label = '') {
    return label
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&amp;/g, '&')
        .replace(/&hellip;/g, '…')
        .replace(/<[^>]*>/g, '')
        .trim();
}

/**
 * The company's registration (base) currency is the universal currency:
 * forms default to it and every selectable option flows from the shared
 * `money` prop, so a company registered in GHS gets GHS everywhere.
 */
export function currencyChoices(money) {
    const base = String(money?.base ?? DEFAULT_CURRENCY).toUpperCase();
    const codes = (money?.currencies ?? [])
        .map((currency) => String(currency?.code ?? '').toUpperCase())
        .filter(Boolean);

    return {
        base,
        codes: [...new Set([base, ...codes])],
    };
}
