import { Application, Container, Graphics } from 'pixi.js';

export class Grid extends Container {
    private app: Application;
    private graphics: Graphics;
    private gridSize: number = 100;

    constructor(app: Application) {
        super();
        this.app = app;
        this.graphics = new Graphics();
        this.addChild(this.graphics);
    }

    public update() {
        // We assume this Grid is added to the contentContainer (the world).
        // We need to calculate the visible world bounds.

        const parent = this.parent;
        if (!parent) {
            return;
        }

        // 1. Get screen bounds in global coordinates
        // const screenRect = this.app.screen; // x,y usually 0,0

        // 2. Map top-left and bottom-right of screen to local (world) coordinates
        const tl = parent.toLocal({ x: 0, y: 0 });
        const br = parent.toLocal({ x: this.app.screen.width, y: this.app.screen.height });

        // Calculate min/max for drawing
        // Provide some padding so we don't see lines appearing/disappearing abruptly
        const padding = this.gridSize * 2;

        const left = Math.floor(tl.x / this.gridSize) * this.gridSize - padding;
        const right = Math.ceil(br.x / this.gridSize) * this.gridSize + padding;
        const top = Math.floor(tl.y / this.gridSize) * this.gridSize - padding;
        const bottom = Math.ceil(br.y / this.gridSize) * this.gridSize + padding;

        this.graphics.clear();

        // Prepare path
        // Vertical lines
        for (let x = left; x <= right; x += this.gridSize) {
            this.graphics.moveTo(x, top).lineTo(x, bottom);
        }

        // Horizontal lines
        for (let y = top; y <= bottom; y += this.gridSize) {
            this.graphics.moveTo(left, y).lineTo(right, y);
        }

        // Stroke with pixelLine
        this.graphics.stroke({
            width: 1,
            color: 0x2c2c2c,
            alpha: 0.5,
            pixelLine: true
        });
    }
}
