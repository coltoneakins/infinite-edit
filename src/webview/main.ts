import App from './core/App';
import MessageClient from './core/MessageClient';

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

(async () => {

    // Initialize an instance of the InfiniteEdit app
    const app = new App();

    // Wait for the app to be fully initialized
    await app.ready;

    // Initialize message client
    // This is where the frontend handles message passing
    const messageClient = new MessageClient();
    app.canvasManagerInstance.setMessageClient(messageClient);

    // Signal that we are ready to receive messages
    messageClient.send('ready');
})();
