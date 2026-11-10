import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { configureMoney, readStoredDisplayCurrency } from './lib/format';

const appName = import.meta.env.VITE_APP_NAME || 'Ledgerly';

createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        configureMoney(props.initialPage.props.money, readStoredDisplayCurrency());
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#6366f1',
    },
});
