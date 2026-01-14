import { Application } from 'pixi.js';
import { CanvasManager } from '../canvas/CanvasManager';
import { MessageClient } from '../core/MessageClient';
import { MaskManager } from './MaskManager';
import { LSPBridge } from './LSPBridge';

class App {

    private app!: Application;
    private canvasManager!: CanvasManager;
    private messageClient!: MessageClient;
    private maskManager!: MaskManager;
    public ready: Promise<void>;

    constructor() {
        this.ready = this.init();
    }

    private async init() {
        this.app = new Application();
        await this.app.init({
            resizeTo: window,
            backgroundAlpha: 0,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Initialize MaskManager
        this.maskManager = new MaskManager();

        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.app.canvas);
            // Add seti-icons class to body for icon styles
            document.body.classList.add('seti-icons');
            // IMPORTANT:We listen on the canvas again, but we use the parent 
            // container for the move listener to capture the user's intent 
            // and toggle pointer-events accordingly.

            container.addEventListener('pointermove', (e: PointerEvent) => {
                // clientX/Y are global.
                // In PixiJS 8, we use rootBoundary.hitTest to find the object at this point.
                const hit = (this.app.renderer.events as any).rootBoundary?.hitTest(e.clientX, e.clientY);

                // If hit is null, it means we are over a "hole" (like the masked part of the Grid)
                // or somewhere else that shouldn't block. 
                // We want auto if we hit something interactive (Grid, Buttons, etc).
                const isHole = !hit;

                this.app.canvas.style.pointerEvents = isHole ? 'none' : 'auto';
            }, { passive: true });
        } else {
            document.body.appendChild(this.app.canvas);
        }

        // Default to none to allow background panning and editor interaction
        this.app.canvas.style.pointerEvents = 'none';

        // Initialize message client
        // This is where the frontend handles message passing
        this.messageClient = new MessageClient();

        // Initialize LSP Bridge
        new LSPBridge(this.messageClient);

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
                    this.canvasManager.addEditor(message.file, message.content, message.uri);
                    break;
                case 'didChangeTextDocument':
                    this.canvasManager.updateEditorContent(message.file, message.content);
                    break;
                case 'setDiagnostics':
                    this.canvasManager.setEditorDiagnostics(message.file, message.diagnostics);
                    break;
                case 'setBreakpoints':
                    this.canvasManager.setEditorBreakpoints(message.file, message.breakpoints);
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
