import { Application, Container, Graphics, Rectangle } from 'pixi.js';

/**
 * Intelligent Grid that draws major and minor lines based on the viewport.
 * It uses a local cache (lastDrawnBounds) to avoid redrawing every frame, 
 * which prevents flashing while still responding to pan and zoom.
 */
export class Grid extends Container {
    private app: Application;
    private graphics: Graphics;

    // Tracks the world-space area currently covered by the graphics
    private lastDrawnBounds: Rectangle = new Rectangle(0, 0, 0, 0);
    private lastScale: number = -1;

    constructor(app: Application) {
        super();
        this.app = app;
        this.graphics = new Graphics();
        this.addChild(this.graphics);
    }

    public update() {
        const parent = this.parent;
        if (!parent) {
            return;
        }

        const currentScale = parent.scale.x;

        // 1. Get current visible bounds in world space
        const tl = parent.toLocal({ x: 0, y: 0 });
        const br = parent.toLocal({ x: this.app.screen.width, y: this.app.screen.height });
        const visibleRect = {
            left: tl.x,
            top: tl.y,
            right: br.x,
            bottom: br.y,
            width: br.x - tl.x,
            height: br.y - tl.y
        };

        // 2. Check if we need to redraw
        // Redraw if zoom changed significantly OR if viewport is approaching the edge of drawn area
        const scaleChanged = Math.abs(currentScale - this.lastScale) > 0.01 * currentScale;

        // Hysteresis: we check if the current viewport is still comfortably inside the last drawn bounds
        // (We leave a 10% safety margin of the drawn area)
        const marginX = this.lastDrawnBounds.width * 0.1;
        const marginY = this.lastDrawnBounds.height * 0.1;

        const isInside = (
            visibleRect.left >= this.lastDrawnBounds.x + marginX &&
            visibleRect.right <= this.lastDrawnBounds.right - marginX &&
            visibleRect.top >= this.lastDrawnBounds.y + marginY &&
            visibleRect.bottom <= this.lastDrawnBounds.bottom - marginY
        );

        if (!scaleChanged && isInside && this.lastScale !== -1) {
            return;
        }

        // 3. Calculate new draw area (Viewport size + significant buffer)
        // We draw 3x the viewport width/height to minimize redraw frequency during panning
        const drawWidth = visibleRect.width * 3;
        const drawHeight = visibleRect.height * 3;

        const majorSize = 1000;
        const minorSize = 100;

        // Round to major grid for perfect alignment during transitions
        const left = Math.floor((visibleRect.left - visibleRect.width) / majorSize) * majorSize;
        const top = Math.floor((visibleRect.top - visibleRect.height) / majorSize) * majorSize;
        const right = Math.ceil((visibleRect.right + visibleRect.width) / majorSize) * majorSize;
        const bottom = Math.ceil((visibleRect.bottom + visibleRect.height) / majorSize) * majorSize;

        this.lastDrawnBounds.x = left;
        this.lastDrawnBounds.y = top;
        this.lastDrawnBounds.width = right - left;
        this.lastDrawnBounds.height = bottom - top;
        this.lastScale = currentScale;

        this.redraw(left, top, right, bottom);
    }

    private redraw(left: number, top: number, right: number, bottom: number) {
        this.graphics.clear();

        const minorSize = 100;
        const majorSize = 1000;

        // Draw Minor Lines (drawn first so they are under major lines if needed, though they don't overlap here)
        for (let x = left; x <= right; x += minorSize) {
            if (x % majorSize !== 0) {
                this.graphics.moveTo(x, top).lineTo(x, bottom);
            }
        }
        for (let y = top; y <= bottom; y += minorSize) {
            if (y % majorSize !== 0) {
                this.graphics.moveTo(left, y).lineTo(right, y);
            }
        }
        this.graphics.stroke({
            width: 1,
            color: 0x2c2c2c,
            alpha: 0.5,
            pixelLine: true
        });

        // Draw Major Lines
        for (let x = left; x <= right; x += majorSize) {
            this.graphics.moveTo(x, top).lineTo(x, bottom);
        }
        for (let y = top; y <= bottom; y += majorSize) {
            this.graphics.moveTo(left, y).lineTo(right, y);
        }
        this.graphics.stroke({
            width: 1,
            color: 0x2c2c2c,
            alpha: 0.9,
            pixelLine: true
        });

        // Draw Origin Dot
        // Note: Origin is at world (0,0). Constant.
        this.graphics.circle(0, 0, 4).fill({ color: 0xffffff });
    }
}
