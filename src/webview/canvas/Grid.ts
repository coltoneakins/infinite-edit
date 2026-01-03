import { Container, Graphics, Rectangle } from 'pixi.js';
import { Viewport } from './Viewport';
import { MaskManager, MaskConsumer, MaskProvider } from '../core/MaskManager';

/**
 * Intelligent Grid that draws major and minor lines based on the viewport.
 * Uses the Viewport utility to calculate visible areas.
 */
export class Grid extends Container implements MaskConsumer {
    private viewport: Viewport;
    private graphics: Graphics;
    private maskGraphics: Graphics;
    private maskManager: MaskManager;

    // lastDrawnBounds and lastScale are no longer used for optimization,
    // as the grid is now redrawn on every update via the ticker.
    private lastDrawnBounds: Rectangle = new Rectangle(0, 0, 0, 0);
    private lastScale: number = -1;

    constructor(viewport: Viewport, maskManager: MaskManager) {
        super();
        this.viewport = viewport;
        this.maskManager = maskManager;
        this.graphics = new Graphics();
        this.graphics.label = 'grid-graphics';
        this.addChild(this.graphics);

        this.maskGraphics = new Graphics();
        this.addChild(this.maskGraphics);
        this.mask = this.maskGraphics;

        this.maskManager.registerConsumer(this);
    }

    public onMaskUpdate(providers: MaskProvider[]) {
        this.updateMask(providers);
    }

    public updateMask(providers: MaskProvider[]) {
        this.maskGraphics.clear();

        // We want to draw the grid everywhere EXCEPT where the providers are.
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

        for (const provider of providers) {
            const globalBounds = provider.getMaskGlobalBounds();

            // Convert global bounds to Grid's local space to determine where to cut
            // This handles both moving nodes (siblings) and fixed UI (stage children) correctly
            const localTo = this.toLocal({ x: globalBounds.x, y: globalBounds.y });
            const localBottomRight = this.toLocal({ x: globalBounds.x + globalBounds.width, y: globalBounds.y + globalBounds.height });

            this.maskGraphics
                .rect(localTo.x, localTo.y, localBottomRight.x - localTo.x, localBottomRight.y - localTo.y)
                .cut();
        }
    }

    // This method is now called by an external ticker, ensuring it runs at a high priority.
    public update() {
        const bounds = this.viewport.getBounds();
        const currentScale = this.viewport.getScale();

        // 1. Check if we need to redraw the grid lines
        const scaleChanged = Math.abs(currentScale - this.lastScale) > 0.01 * currentScale;

        // Use a margin to avoid constant redraws while panning within a reasonable range
        const marginX = this.lastDrawnBounds.width * 0.1;
        const marginY = this.lastDrawnBounds.height * 0.1;

        const isInside = (
            bounds.left >= this.lastDrawnBounds.x + marginX &&
            bounds.right <= this.lastDrawnBounds.right - marginX &&
            bounds.top >= this.lastDrawnBounds.y + marginY &&
            bounds.bottom <= this.lastDrawnBounds.bottom - marginY
        );

        // If we haven't moved enough or changed scale significantly, skip the expensive redraw
        if (!scaleChanged && isInside && this.lastScale !== -1) {
            return;
        }

        const majorSize = 1000;
        // Calculate the visible area with extra padding
        const padding = majorSize * 2;

        const left = Math.floor((bounds.left - padding) / majorSize) * majorSize;
        const top = Math.floor((bounds.top - padding) / majorSize) * majorSize;
        const right = Math.ceil((bounds.right + padding) / majorSize) * majorSize;
        const bottom = Math.ceil((bounds.bottom + padding) / majorSize) * majorSize;

        this.lastDrawnBounds.x = left;
        this.lastDrawnBounds.y = top;
        this.lastDrawnBounds.width = right - left;
        this.lastDrawnBounds.height = bottom - top;
        this.lastScale = currentScale;

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
