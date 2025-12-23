import App from './core/App';
import MessageClient from './core/MessageClient';

// Configure Monaco Environment for webview context
// Disable workers to avoid CSP issues in VS Code webviews
(self as any).MonacoEnvironment = {
    getWorker() {
        // Return null to disable workers and run everything in the main thread
        // This is the recommended approach for VS Code webviews
        return null;
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

})();
