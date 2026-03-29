import './main.scss';
import './styles/seti.less';
import App from './core/App';

import { LANGUAGE_WORKER_MAP } from '../shared/MonacoConfig';

// Configure Monaco Environment for webview context
// We use a Blob proxy to allow workers to load cross-origin scripts in the webview
(self as any).MonacoEnvironment = {
    getWorker: function (_moduleId: any, label: string) {
        const getResourceUrl = (url: string) => {
            // Create a blob that imports the actual worker script
            // This bypasses the security restriction where web workers cannot be created from cross-origin URLs
            const blob = new Blob([`importScripts("${url}");`], { type: 'text/javascript' });
            return URL.createObjectURL(blob);
        };

        const workers = (window as any).MONACO_WORKERS;
        const workerKey = LANGUAGE_WORKER_MAP[label] || 'editor';
        const workerUrl = workers[workerKey] || workers.editor;

        return new Worker(getResourceUrl(workerUrl));
    }
};

declare const module: any;

(async () => {

    // Initialize an instance of the InfiniteEdit app
    const app = new App();
    (window as any).infiniteEditApp = app;

    // Wait for the app to be fully initialized
    await app.ready;

    // Signal that we are ready to receive messages
    app.messageClientInstance.send('ready');

    const hmr =
        (import.meta as any).hot ||
        (import.meta as any).webpackHot ||
        (typeof module !== 'undefined' && (module as any).hot) ||
        (window as any).__webpack_hmr__ ||
        (window as any).webpackHotUpdate ||
        (window as any).RSPACK_HMR ||
        (window as any).__RSPACK_HMR__;

    app.messageClientInstance.send('hmrStatus', { enabled: !!hmr });
    console.log('HMR probe:', {
        importMetaHot: !!(import.meta as any).hot,
        importMetaWebpackHot: !!(import.meta as any).webpackHot,
        moduleHot: typeof module !== 'undefined' && !!(module as any).hot,
        globalWebpackHmr: !!(window as any).__webpack_hmr__,
        globalWebpackHotUpdate: !!(window as any).webpackHotUpdate,
        globalRspackHmr: !!(window as any).RSPACK_HMR || !!(window as any).__RSPACK_HMR__
    });

    if (hmr) {
        console.log('HMR: hot module API available.', hmr);

        hmr.accept?.(() => {
            console.log('HMR: main module accepted.');
        });

        hmr.dispose?.(() => {
            console.log('HMR: disposing existing app instance.');
            try {
                const existingApp = (window as any).infiniteEditApp as App | undefined;
                existingApp?.dispose?.();
            } catch (e) {
                console.error('HMR dispose error', e);
            }
        });
    } else {
        console.warn('HMR: no hot module API detected.');
    }

})();
