import { Application } from "pixi.js";
import { CanvasManager } from "../canvas/CanvasManager";

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

class MessageClient {
    private app: Application;
    private canvasManager: CanvasManager;

    constructor(app: Application, canvasManager: CanvasManager) {
        this.app = app;
        this.canvasManager = canvasManager;
        this.init();
    }

    private init() {
        // Register event listeners

        // Handle window resize
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.canvasManager.onResize();
        });

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'openFile':
                    this.canvasManager.addEditor(message.file, message.content);
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
    }
}

export default MessageClient;
