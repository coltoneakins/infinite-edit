import { Container, Graphics, Rectangle } from 'pixi.js';
import { Viewport } from './Viewport';

/**
 * Intelligent Grid that draws major and minor lines based on the viewport.
 * Uses the Viewport utility to calculate visible areas.
 */
export class Grid extends Container {
    private viewport: Viewport;
    private graphics: Graphics;

    private lastDrawnBounds: Rectangle = new Rectangle(0, 0, 0, 0);
    private lastScale: number = -1;

    constructor(viewport: Viewport) {
        super();
        this.viewport = viewport;
        this.graphics = new Graphics();
        this.addChild(this.graphics);
    }

    public update() {
        const bounds = this.viewport.getBounds();
        const currentScale = this.viewport.getScale();

        // 1. Check if we need to redraw
        const scaleChanged = Math.abs(currentScale - this.lastScale) > 0.01 * currentScale;

        const marginX = this.lastDrawnBounds.width * 0.1;
        const marginY = this.lastDrawnBounds.height * 0.1;

        const isInside = (
            bounds.left >= this.lastDrawnBounds.x + marginX &&
            bounds.right <= this.lastDrawnBounds.right - marginX &&
            bounds.top >= this.lastDrawnBounds.y + marginY &&
            bounds.bottom <= this.lastDrawnBounds.bottom - marginY
        );

        if (!scaleChanged && isInside && this.lastScale !== -1) {
            return;
        }

        // 2. Calculate new draw area
        const majorSize = 1000;
        const minorSize = 100;

        const left = Math.floor((bounds.left - bounds.width) / majorSize) * majorSize;
        const top = Math.floor((bounds.top - bounds.height) / majorSize) * majorSize;
        const right = Math.ceil((bounds.right + bounds.width) / majorSize) * majorSize;
        const bottom = Math.ceil((bounds.bottom + bounds.height) / majorSize) * majorSize;

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

        // Draw Minor Lines
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
            pixelLine: true,
        });

        // Draw Origin Dot
        this.graphics.circle(0, 0, 4).fill({ color: 0xffffff });

        // Allow culling
        this.graphics.cullable = true;
    }
}
