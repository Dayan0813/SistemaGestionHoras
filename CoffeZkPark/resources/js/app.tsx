import '../css/app.css';

import MainLayout from '@/Layouts/MainLayout';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import.meta.glob('./pages/**/*.tsx');

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),

    resolve: async (name) => {
        const page = (await resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx'))) as { default: any };

        const Component = page.default;

        if (!name.startsWith('Auth/')) {
            Component.layout = (pageProps: any) => <MainLayout RouteNavbar={pageProps.props.currentRouteName}>{pageProps}</MainLayout>;
        }

        return page;
    },

    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
});
