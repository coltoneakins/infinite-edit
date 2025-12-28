import { Container, Graphics, Rectangle } from 'pixi.js';
import { Viewport } from './Viewport';

/**
 * Intelligent Grid that draws major and minor lines based on the viewport.
 * Uses the Viewport utility to calculate visible areas.
 */
export class Grid extends Container {
    private viewport: Viewport;
    private graphics: Graphics;
    private maskGraphics: Graphics;

    // lastDrawnBounds and lastScale are no longer used for optimization,
    // as the grid is now redrawn on every update via the ticker.
    private lastDrawnBounds: Rectangle = new Rectangle(0, 0, 0, 0);
    private lastScale: number = -1;

    constructor(viewport: Viewport) {
        super();
        this.viewport = viewport;
        this.graphics = new Graphics();
        this.addChild(this.graphics);

        this.maskGraphics = new Graphics();
        this.addChild(this.maskGraphics);
        this.mask = this.maskGraphics;
    }

    public updateMask(nodes: any[]) {
        this.maskGraphics.clear();

        // We want to draw the grid everywhere EXCEPT where the nodes are.
        // In PixiJS 8, we can draw a huge rectangle and then use holes.
        // Or we can draw the inverse.
        // For a mask, white = visible, black = hidden (in ALPHA mode).
        // By default masks use the shape.

        const bounds = this.viewport.getBounds();
        // Use a larger padding to ensure the mask covers the entire viewport area,
        // even when the viewport is rapidly moving or scaling.
        const padding = Math.max(bounds.width, bounds.height) * 2; // Dynamic padding based on viewport size

        this.maskGraphics
            .rect(bounds.left - padding, bounds.top - padding, bounds.width + padding * 2, bounds.height + padding * 2)
            .fill(0xffffff);

        for (const node of nodes) {
            const b = node.getMaskBounds();
            this.maskGraphics
                .rect(b.x, b.y, b.width, b.height)
                .cut();
        }
    }

    // This method is now called by an external ticker, ensuring it runs at a high priority.
    public update() {
        const bounds = this.viewport.getBounds();
        const currentScale = this.viewport.getScale();

        const majorSize = 1000;
        // Calculate the visible area with some extra padding to avoid flickering at edges
        const padding = majorSize * 2; // Ensure enough padding for major lines

        const left = Math.floor((bounds.left - padding) / majorSize) * majorSize;
        const top = Math.floor((bounds.top - padding) / majorSize) * majorSize;
        const right = Math.ceil((bounds.right + padding) / majorSize) * majorSize;
        const bottom = Math.ceil((bounds.bottom + padding) / majorSize) * majorSize;

        // Redraw grid on every update. Optimization based on lastDrawnBounds/lastScale is removed
        // to ensure perfect sync during drag/pan and scale changes.
        this.redraw(left, top, right, bottom);
    }

    private redraw(left: number, top: number, right: number, bottom: number) {
        // Clear previous lines
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
