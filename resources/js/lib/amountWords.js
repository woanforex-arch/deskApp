// Cheque-style "amount in words": 1234.5 GHS -> "One thousand two hundred
// thirty-four Ghana cedis and fifty pesewas only". Returns null when the
// value is not a positive, representable amount.

const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
];

const MAX_AMOUNT = 999_999_999.99;

const CURRENCY_UNITS = {
    GHS: { major: 'Ghana cedis', minor: 'pesewas' },
    USD: { major: 'US dollars', minor: 'cents' },
    EUR: { major: 'euros', minor: 'cents' },
    GBP: { major: 'pounds', minor: 'pence' },
    NGN: { major: 'naira', minor: 'kobo' },
    ZAR: { major: 'rand', minor: 'cents' },
    KES: { major: 'shillings', minor: 'cents' },
    GMD: { major: 'dalasis', minor: 'bututs' },
};

function chunkToWords(value) {
    const words = [];
    const hundreds = Math.floor(value / 100);
    let rest = value % 100;

    if (hundreds > 0) {
        words.push(`${ONES[hundreds - 1]} hundred`);
    }

    if (rest >= 20) {
        const ten = TENS[Math.floor(rest / 10) - 2];
        const one = rest % 10;
        words.push(one > 0 ? `${ten}-${ONES[one - 1]}` : ten);
    } else if (rest > 0) {
        words.push(rest < 10 ? ONES[rest - 1] : TEENS[rest - 10]);
    }

    return words.join(' ');
}

function integerToWords(value) {
    if (value === 0) {
        return 'zero';
    }

    const words = [];
    let remaining = value;

    for (const [scale, name] of SCALES) {
        const count = Math.floor(remaining / scale);

        if (count > 0) {
            words.push(`${chunkToWords(count)} ${name}`);
            remaining %= scale;
        }
    }

    if (remaining > 0) {
        words.push(chunkToWords(remaining));
    }

    return words.join(' ');
}

export function amountToWords(value, currencyCode = 'USD') {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        return null;
    }

    const rounded = Math.round(amount * 100);
    let major = Math.floor(rounded / 100);
    let minor = rounded % 100;

    if (major >= 1_000_000_000) {
        return null;
    }

    const units = CURRENCY_UNITS[String(currencyCode ?? '').toUpperCase()] ?? {
        major: `${String(currencyCode ?? 'USD').toUpperCase()}`,
        minor: 'cents',
    };

    let words = `${integerToWords(major)} ${units.major}`;

    if (minor > 0) {
        words += ` and ${integerToWords(minor)} ${units.minor}`;
    }

    const sentence = words.charAt(0).toUpperCase() + words.slice(1);

    return `${sentence} only`;
}
