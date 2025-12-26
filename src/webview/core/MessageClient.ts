import { Application } from "pixi.js";
import { CanvasManager } from "../canvas/CanvasManager";

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

export class MessageClient {
    private app: Application;
    private canvasManager: CanvasManager;
    private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
    private requestIdCounter: number = 0;

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

            if (message.command === 'response') {
                const req = this.pendingRequests.get(message.requestId);
                if (req) {
                    req.resolve(message.body);
                    this.pendingRequests.delete(message.requestId);
                }
                return;
            } else if (message.command === 'error') {
                const req = this.pendingRequests.get(message.requestId);
                if (req) {
                    req.reject(message.message);
                    this.pendingRequests.delete(message.requestId);
                }
                return;
            }

            switch (message.command) {
                case 'openFile':
                    this.canvasManager.addEditor(message.file, message.content);
                    break;
            }
        });

        // Handle save requests from editors
        window.addEventListener('save-file', (event: any) => {
            this.send('saveFile', {
                file: event.detail.file,
                content: event.detail.content
            });
        });

        // Signal that we are ready to receive messages
        this.send('ready');
    }

    public request(command: string, body: any = {}): Promise<any> {
        const requestId = (this.requestIdCounter++).toString();
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            vscode.postMessage({ command, requestId, ...body });
        });
    }

    public send(command: string, body: any = {}) {
        vscode.postMessage({ command, ...body });
    }
}

export default MessageClient;
