import { Application, Container, Point } from 'pixi.js';

export interface ViewportBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

/**
 * Viewport utility to bridge screen space and world space.
 * It tracks the relationship between the PixiJS Application screen 
 * and the world Container's transform.
 */
export class Viewport {
    private app: Application;
    private world: Container;

    constructor(app: Application, world: Container) {
        this.app = app;
        this.world = world;
    }

    /**
     * Returns the current visible bounds in world coordinates.
     */
    public getBounds(): ViewportBounds {
        const tl = this.world.toLocal({ x: 0, y: 0 });
        const br = this.world.toLocal({ x: this.app.screen.width, y: this.app.screen.height });

        return {
            left: tl.x,
            top: tl.y,
            right: br.x,
            bottom: br.y,
            width: br.x - tl.x,
            height: br.y - tl.y
        };
    }

    /**
     * Returns the world coordinates of the center of the screen.
     */
    public getCenter(): Point {
        return this.world.toLocal({
            x: this.app.screen.width / 2,
            y: this.app.screen.height / 2
        }) as Point;
    }

    /**
     * Returns how far the viewport center is from the world origin (0,0).
     */
    public getDistanceFromOrigin(): number {
        const center = this.getCenter();
        return Math.sqrt(center.x * center.x + center.y * center.y);
    }

    /**
     * Checks if a rectangle (in world coordinates) is visible within the current viewport.
     */
    public isVisible(x: number, y: number, width: number, height: number, padding: number = 0): boolean {
        const bounds = this.getBounds();
        return (
            x + width >= bounds.left - padding &&
            x <= bounds.right + padding &&
            y + height >= bounds.top - padding &&
            y <= bounds.bottom + padding
        );
    }

    /**
     * Gets the current zoom scale of the world.
     */
    public getScale(): number {
        return this.world.scale.x;
    }

    /**
     * Returns the raw position of the world container relative to the stage origin.
     * This represents the 'pan' offset in screen pixels.
     */
    public getPanOffset(): { x: number, y: number } {
        return { x: this.world.x, y: this.world.y };
    }
}
