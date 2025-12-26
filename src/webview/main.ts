import App from './core/App';
import MessageClient from './core/MessageClient';

// Configure Monaco Environment for webview context
// We use a Blob proxy to allow workers to load cross-origin scripts in the webview
(self as any).MonacoEnvironment = {
    getWorker: function (_moduleId: any, label: string) {
        const getWorkerUrl = (url: string) => {
            // Create a blob that imports the actual worker script
            // This bypasses the security restriction where web workers cannot be created from cross-origin URLs
            const blob = new Blob([`importScripts("${url}");`], { type: 'text/javascript' });
            return URL.createObjectURL(blob);
        };

        const workers = (window as any).MONACO_WORKERS;

        switch (label) {
            case 'json':
                return new Worker(getWorkerUrl(workers.json));
            case 'css':
            case 'scss':
            case 'less':
                return new Worker(getWorkerUrl(workers.css));
            case 'html':
            case 'handlebars':
            case 'razor':
                return new Worker(getWorkerUrl(workers.html));
            case 'typescript':
            case 'javascript':
                return new Worker(getWorkerUrl(workers.typescript));
            default:
                return new Worker(getWorkerUrl(workers.editor));
        }
    }
};

(async () => {

    // Initialize an instance of the InfiniteEdit app
    const app = new App();

    // Wait for the app to be fully initialized
    await app.ready;

    // Initialize message client
    // This is where the frontend handles message passing
    const messageClient = new MessageClient(app.appInstance, app.canvasManagerInstance);
    app.canvasManagerInstance.setMessageClient(messageClient);

})();
