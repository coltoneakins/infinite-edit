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

    // Prefer ESM-style HMR API (import.meta.hot). Fall back to CommonJS-style `module.hot`.
    const hmr = (import.meta as any).hot || (typeof module !== 'undefined' && (module as any).hot);

    if (hmr) {
        // Dispose the existing app instance before this module is replaced.
        hmr.dispose?.(() => {
            try {
                const existingApp = (window as any).infiniteEditApp as App | undefined;
                existingApp?.dispose?.();
            } catch (e) {
                console.error('HMR dispose error', e);
            }
        });

        // Self-accept: Rspack will patch this module in place on each rebuild.
        hmr.accept?.();

        // Fall back to a full reload if HMR cannot apply the update.
        hmr.addStatusHandler?.((status: string) => {
            if (status === 'fail') {
                window.location.reload();
            }
        });
    }

})();
