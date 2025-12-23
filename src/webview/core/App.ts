import { Application } from 'pixi.js';
import { CanvasManager } from '../canvas/CanvasManager';

class App {

    private app!: Application;
    private canvasManager!: CanvasManager;
    public ready: Promise<void>;

    constructor() {
        this.ready = this.init();
    }

    private async init() {
        this.app = new Application();
        await this.app.init({
            resizeTo: window,
            backgroundColor: 0x0b073d,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.app.canvas);
        } else {
            document.body.appendChild(this.app.canvas);
        }

        this.canvasManager = new CanvasManager(this.app);
    }

    get appInstance() {
        return this.app;
    }

    get canvasManagerInstance() {
        return this.canvasManager;
    }

}

export default App; 
