import { Application, Container, Graphics, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import { EditorNode } from '../nodes/EditorNode';
import { Grid } from './Grid';
import { Viewport } from './Viewport';
import { Toolbar } from '../ui/Toolbar';
import { MessageClient } from '../core/MessageClient';

import { MaskManager, MaskedHitArea } from '../core/MaskManager';

export class CanvasManager {
    private app: Application;
    private stage: Container;
    private contentContainer: Container;
    private viewport: Viewport;
    private grid: Grid;
    private maskManager: MaskManager; // Centralized mask manager
    private zoomLevel: number = 0;
    private readonly ZOOM_SENSITIVITY: number = 0.004;
    private readonly ZOOM_BASE: number = 1.1;
    private isDragging: boolean = false;
    private lastPos: { x: number; y: number } | null = null;

    private messageClient: MessageClient | null = null;
    private toolbar: Toolbar | null = null;
    private nodes: EditorNode[] = [];

    constructor(app: Application, messageClient: MessageClient) {
        this.messageClient = messageClient;
        this.app = app;
        this.stage = app.stage;
        this.maskManager = new MaskManager();

        // Create a container for all content (nodes)
        this.contentContainer = new Container();
        this.stage.addChild(this.contentContainer);

        // Initialize Viewport
        this.viewport = new Viewport(this.app, this.contentContainer);

        // Initialize Grid
        this.grid = new Grid(this.viewport, this.maskManager);
        this.contentContainer.addChild(this.grid);
        this.grid.update();

        // Initialize Toolbar
        this.createToolbar();

        // Enable interactivity on the stage for panning
        this.stage.eventMode = 'static';
        // Use MaskedHitArea so the stage respects the holes defined by providers (EditorNodes)
        this.stage.hitArea = new MaskedHitArea(this.maskManager, this.app.screen);

        this.stage.on('pointerdown', this.onPointerDown.bind(this));
        this.stage.on('pointerup', this.onPointerUp.bind(this));
        this.stage.on('pointerupoutside', this.onPointerUp.bind(this));
        this.stage.on('pointermove', this.onPointerMove.bind(this));
        this.stage.on('wheel', this.onWheel.bind(this));

        // Initialize zoomLevel based on initial scale
        this.zoomLevel = Math.log(this.contentContainer.scale.x) / Math.log(this.ZOOM_BASE);

        // Update grid and mask relative to everything else. Priority 50 (INTERACTION) ensures it runs before most other things.
        this.app.ticker.add(() => {
            const isAnyInteracting = this.nodes.some(n => n.isInteracting);
            if (isAnyInteracting) {
                // Skip masking during interaction to save compute, only update the grid lines
                this.grid.update();
            } else {
                this.updateGrid();
            }
        }, this, 50);

        // Make a test bezier curve with a mouseover console log message
        const testCurve = new Graphics()
            .moveTo(100, 100)
            .bezierCurveTo(200, 200, 300, 300, 400, 400)
            .stroke({
                width: 10, color: 0xff0000
            });
        testCurve.eventMode = 'static';
        testCurve.interactive = true;
        testCurve.on('pointerdown', () => console.log('Mouse down on test curve'));
        this.contentContainer.addChild(testCurve);
    }

    private createToolbar() {
        this.toolbar = new Toolbar(this.messageClient!, this.maskManager);
        this.stage.addChild(this.toolbar);
        // The toolbar might also want to register as a mask provider if it blocks clicks 
        // that shouldn't pan the canvas. For now, we assume it sits on top.
        this.updateToolbarPosition();
    }

    private updateToolbarPosition() {
        if (this.toolbar) {
            this.toolbar.x = (this.app.screen.width - this.toolbar.width_) / 2;
            this.toolbar.y = 20;
        }
    }

    public onResize() {
        // Update the stage hit area to match new screen size
        if (this.stage.hitArea instanceof MaskedHitArea) {
            this.stage.hitArea.updateBaseArea(this.app.screen);
        } else {
            this.stage.hitArea = this.app.screen;
        }

        this.updateGrid();
        this.updateToolbarPosition();
    }

    public addEditor(file: string, content: string) {
        const editor = new EditorNode(file, content, this.messageClient!, this.maskManager);
        this.contentContainer.addChild(editor);
        editor.x = (this.app.screen.width / 2 - editor.width / 2 - this.contentContainer.x) / this.contentContainer.scale.x;
        editor.y = (this.app.screen.height / 2 - editor.height / 2 - this.contentContainer.y) / this.contentContainer.scale.y;

        this.nodes.push(editor);

        // MaskManager updates automatically or via Ticker
        this.maskManager.update();
    }

    public removeEditor(editor: EditorNode) {
        const index = this.nodes.indexOf(editor);
        if (index !== -1) {
            this.nodes.splice(index, 1);
            this.contentContainer.removeChild(editor);
            editor.destroy();
            this.updateGrid();
        }
    }

    private onPointerDown(e: FederatedPointerEvent) {
        console.log('CanvasManager: onPointerDown', e.global);
        if (e.target !== this.stage) {
            console.log('CanvasManager: Clicked on something else:', e.target.constructor.name);
            return; // Only drag if clicking on background
        }
        this.isDragging = true;
        this.lastPos = { x: e.global.x, y: e.global.y };
    }

    private onPointerUp() {
        console.log('CanvasManager: onPointerUp');
        this.isDragging = false;
        this.lastPos = null;
    }

    private onPointerMove(e: FederatedPointerEvent) {
        if (this.isDragging && this.lastPos) {
            // console.log('CanvasManager: onPointerMove', e.global); // Too spammy
            const newPos = { x: e.global.x, y: e.global.y };
            const dx = newPos.x - this.lastPos.x;
            const dy = newPos.y - this.lastPos.y;

            this.contentContainer.x += dx;
            this.contentContainer.y += dy;

            this.lastPos = newPos;
            this.updateGrid();
        }
    }

    private onWheel(e: FederatedWheelEvent) {
        // Get the mouse position in world coordinates before zoom
        const worldPos = this.contentContainer.toLocal(e.global);

        // Update zoom level
        const delta = -e.deltaY * this.ZOOM_SENSITIVITY;
        this.zoomLevel += delta;

        // Clamp zoom level to reasonable bounds
        this.zoomLevel = Math.max(-30, Math.min(this.zoomLevel, 10));

        const newScale = Math.pow(this.ZOOM_BASE, this.zoomLevel);

        // Apply new scale
        this.contentContainer.scale.set(newScale);

        // Adjust position so the mouse cursor stays over the same world position
        this.contentContainer.x = e.global.x - worldPos.x * newScale;
        this.contentContainer.y = e.global.y - worldPos.y * newScale;

        this.updateGrid();
    }

    private updateGrid() {
        this.grid.update();
        // Centralized update triggers consumers (Grid) to redraw masks
        this.maskManager.update();
    }
}
