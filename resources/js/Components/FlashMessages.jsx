import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function FlashMessages() {
    const { flash } = usePage().props;
    const [dismissed, setDismissed] = useState({});

    useEffect(() => {
        setDismissed({});
    }, [flash?.success, flash?.error]);

    const messages = [
        flash?.success && { key: `success-${flash.success}`, tone: 'success', text: flash.success },
        flash?.error && { key: `error-${flash.error}`, tone: 'error', text: flash.error },
    ].filter(Boolean);

    if (messages.length === 0) {
        return null;
    }

    return (
        <div className="no-print fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2">
            {messages.map((message) => {
                if (dismissed[message.key]) {
                    return null;
                }

                const isSuccess = message.tone === 'success';

                return (
                    <div
                        key={message.key}
                        className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${
                            isSuccess
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        ) : (
                            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                        )}
                        <p className="flex-1 text-sm font-medium">{message.text}</p>
                        <button
                            type="button"
                            onClick={() => setDismissed((current) => ({ ...current, [message.key]: true }))}
                            className="rounded p-0.5 opacity-60 transition hover:opacity-100"
                            aria-label="Dismiss notification"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
