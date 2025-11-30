import { Application, Container, Graphics, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import { EditorNode } from './EditorNode';

export class CanvasManager {
    private app: Application;
    private stage: Container;
    private contentContainer: Container;
    private isDragging: boolean = false;
    private lastPos: { x: number; y: number } | null = null;

    constructor(app: Application) {
        this.app = app;
        this.stage = app.stage;

        // Create a container for all content (nodes)
        this.contentContainer = new Container();
        this.stage.addChild(this.contentContainer);

        // Enable interactivity on the stage for panning
        this.stage.eventMode = 'static';
        this.stage.hitArea = this.app.screen;

        this.stage.on('pointerdown', this.onPointerDown.bind(this));
        this.stage.on('pointerup', this.onPointerUp.bind(this));
        this.stage.on('pointerupoutside', this.onPointerUp.bind(this));
        this.stage.on('pointermove', this.onPointerMove.bind(this));
        this.stage.on('wheel', this.onWheel.bind(this));
    }

    public onResize() {
        this.stage.hitArea = this.app.screen;
    }

    public addEditor(file: string, content: string) {
        const editor = new EditorNode(file, content);
        this.contentContainer.addChild(editor);
        editor.x = (this.app.screen.width / 2 - editor.width / 2 - this.contentContainer.x) / this.contentContainer.scale.x;
        editor.y = (this.app.screen.height / 2 - editor.height / 2 - this.contentContainer.y) / this.contentContainer.scale.y;
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
        }
    }

    private onWheel(e: FederatedWheelEvent) {
        console.log('CanvasManager: onWheel');
        const wheelEvent = e.nativeEvent as WheelEvent;
        const zoomFactor = 1.1;
        const direction = wheelEvent.deltaY > 0 ? 1 / zoomFactor : zoomFactor;

        const localPos = this.contentContainer.toLocal({ x: e.global.x, y: e.global.y });

        this.contentContainer.scale.x *= direction;
        this.contentContainer.scale.y *= direction;

        const newGlobalPos = this.contentContainer.toGlobal(localPos);
        this.contentContainer.x += e.global.x - newGlobalPos.x;
        this.contentContainer.y += e.global.y - newGlobalPos.y;
    }
}
