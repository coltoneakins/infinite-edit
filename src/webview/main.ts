import { Application } from 'pixi.js';
import { CanvasManager } from './canvas/CanvasManager';

declare function acquireVsCodeApi(): any;

const vscode = acquireVsCodeApi();

(async () => {
    const app = new Application();
    await app.init({
        resizeTo: window,
        backgroundColor: 0x1099bb,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });

    const container = document.getElementById('canvas-container');
    if (container) {
        container.appendChild(app.canvas);
    } else {
        document.body.appendChild(app.canvas);
    }

    const canvasManager = new CanvasManager(app);

    // Handle window resize
    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        canvasManager.onResize();
    });

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'openFile':
                canvasManager.addEditor(message.file, message.content);
                break;
        }
    });

    // Handle save requests from editors
    window.addEventListener('save-file', (event: any) => {
        vscode.postMessage({
            command: 'saveFile',
            file: event.detail.file,
            content: event.detail.content
        });
    });

    // Signal that we are ready to receive messages
    vscode.postMessage({ command: 'ready' });
})();
