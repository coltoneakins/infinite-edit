import { Application } from 'pixi.js';
import { CanvasManager } from '../canvas/CanvasManager';
import { MessageClient } from '../core/MessageClient';

class App {

    private app!: Application;
    private canvasManager!: CanvasManager;
    private messageClient!: MessageClient;
    public ready: Promise<void>;

    constructor() {
        this.ready = this.init();
    }

    private async init() {
        this.app = new Application();
        await this.app.init({
            resizeTo: window,
            backgroundColor: 0x0d162b,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.app.canvas);
        } else {
            document.body.appendChild(this.app.canvas);
        }

        // Initialize message client
        // This is where the frontend handles message passing
        this.messageClient = new MessageClient();

        this.canvasManager = new CanvasManager(this.app, this.messageClient);

        // Handle window resize
        window.addEventListener('resize', () => {
            // Pixi automatically handles renderer resize due to 'resizeTo: window'
            // but we need to notify the canvas manager to update its internal state
            this.canvasManager.onResize();
        });

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'openFile':
                    this.canvasManager.addEditor(message.file, message.content);
                    break;
            }
        });
    }

    get appInstance() {
        return this.app;
    }

    get canvasManagerInstance() {
        return this.canvasManager;
    }

    get messageClientInstance() {
        return this.messageClient;
    }

}

export default App; 
