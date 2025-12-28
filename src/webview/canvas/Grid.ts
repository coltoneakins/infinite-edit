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

    private lastDrawnBounds: Rectangle = new Rectangle(0, 0, 0, 0);
    private lastScale: number = -1;

    constructor(viewport: Viewport) {
        super();
        this.viewport = viewport;
        this.graphics = new Graphics();
        this.addChild(this.graphics);

        this.maskGraphics = new Graphics();
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
        const padding = 2000; // Large enough to cover visible area

        this.maskGraphics.rect(
            bounds.left - padding,
            bounds.top - padding,
            bounds.width + padding * 2,
            bounds.height + padding * 2
        ).fill(0xffffff);

        for (const node of nodes) {
            const nodeBounds = node.getMaskBounds();
            // Use hole to cut out the node area from the mask
            this.maskGraphics.rect(
                nodeBounds.x,
                nodeBounds.y,
                nodeBounds.width,
                nodeBounds.height
            ).cut();
        }
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

        if (!scaleChanged && isInside && currentScale !== this.lastScale) {
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
        // We don't have nodes here easily, so maybe CanvasManager should call it.
        // Actually, let's just make CanvasManager call updateMask when grid updates.
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
