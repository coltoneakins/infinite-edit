import { Container, DOMContainer, Graphics, FederatedPointerEvent, HTMLText, HTMLTextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';

export class EditorNode extends Container {
    private titleBarDOMContainer: DOMContainer;
    private titleBar: HTMLDivElement;
    private titleBarProxy: Graphics;
    private editorDOMContainer: DOMContainer;
    private editorDiv: HTMLDivElement;
    private editorInstance: monaco.editor.IStandaloneCodeEditor;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } | null = null;
    private width_: number = 400;
    private height_: number = 600;
    private titleHeight: number = 30;
    private filePath: string;
    private borderThickness: number = 5;
    private border: Graphics;
    private isResizing: boolean = false;
    private resizeDirection: string | null = null;
    private startResizeBounds: { width: number; height: number; x: number; y: number } | null = null;
    private startMousePosition: { x: number; y: number } | null = null;

    constructor(file: string, content: string) {
        super();
        this.filePath = file;
        this.isRenderGroup = true;
        this.cullable = true;
        this.eventMode = 'passive';

        // Create a border
        this.border = new Graphics();
        this.border.rect(0, 0, this.width_, this.height_)
            .fill(0x3c3c3c) // match the border and title bar color to prevent issues with z-fighting
            .stroke({
                width: this.borderThickness,
                color: 0x3c3c3c,
                join: 'round',
                alignment: 0
            });
        this.border.hitArea = new Rectangle(-this.borderThickness, -this.borderThickness, this.width_ + this.borderThickness * 2, this.height_ + this.borderThickness * 2);
        this.border.eventMode = 'static';
        this.addChild(this.border);

        // NOTE: We use DOMContainers for children even though they are experimental.
        // This is because text rendering is better in DOMContainers versus HTMLText.

        // Title Bar
        this.titleBar = document.createElement('div');
        this.titleBar.style.width = `${this.width_}px`;
        this.titleBar.style.height = `${this.titleHeight}px`;
        this.titleBar.style.backgroundColor = '#3c3c3c';
        this.titleBar.style.lineHeight = `${this.titleHeight}px`;
        this.titleBar.style.overflow = 'hidden';
        this.titleBar.style.whiteSpace = 'nowrap';
        this.titleBar.style.textOverflow = 'ellipsis';
        // TODO: This is another bug with Pixi.js where Pixi.js doesn't respect pointerEvents set on DOM elements.
        // This is a workaround. It is being set via CSS in the webview HTML.
        this.titleBar.className = 'editor-title-bar';
        this.titleBar.style.pointerEvents = 'none'; // Let events through to Pixi

        // Title Text
        const fileName = file.split('/').pop() || file;
        const dirName = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';
        const titleHtml = dirName
            ? `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dirName}<span style="font-weight: 700;">${fileName}</span></span>`
            : fileName;

        this.titleBar.innerHTML = titleHtml;
        this.titleBarDOMContainer = new DOMContainer({
            element: this.titleBar,
        });
        this.titleBarDOMContainer.eventMode = 'static';
        this.titleBarDOMContainer.cursor = 'move';
        this.titleBarDOMContainer.interactiveChildren = false;
        this.titleBarDOMContainer.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);
        this.titleBarDOMContainer.zIndex = 10;
        // TODO: Remove this once bug is fixed: https://github.com/pixijs/pixijs/issues/11690. And, once DOMContainer is no longer experimental.
        // This is because of a bug in Pixi.js where DOM containers added as children in HTML are offset by the parent container's position.
        // There is also a bug with how events fire on DOMContainer parents with DOMContainer as children.
        //this.element.appendChild(this.titleBarDOMContainer.element);
        this.addChild(this.titleBarDOMContainer);
        this.setChildIndex(this.titleBarDOMContainer, 0);

        // Create a proxy object which overlays the title bar
        this.titleBarProxy = new Graphics();
        this.titleBarProxy.rect(0, 0, this.width_, this.titleHeight);
        this.titleBarProxy.eventMode = 'static';
        this.titleBarProxy.cursor = 'move';
        this.titleBarProxy.hitArea = this.titleBarDOMContainer.hitArea;
        this.titleBarProxy.zIndex = 10;
        this.addChild(this.titleBarProxy);
        this.setChildIndex(this.titleBarProxy, 1);

        // Add resizing
        this.border.on('pointermove', this.onBorderPointerMove, this);
        this.border.on('pointerdown', this.onBorderPointerDown, this);
        this.border.on('pointerup', this.onBorderPointerUp, this);
        this.border.on('pointerupoutside', this.onBorderPointerUp, this);
        this.border.on('globalpointermove', this.onGlobalPointerMove, this);

        // Setup Dragging
        this.titleBarProxy.on('pointerdown', this.onDragStart, this);
        this.titleBarProxy.on('pointermove', this.onDragMove, this);
        this.titleBarProxy.on('pointerup', this.onDragEnd, this);
        this.titleBarProxy.on('pointerupoutside', this.onDragEnd, this);

        // Setup Monaco Editor
        this.editorDiv = document.createElement('div');
        this.editorDiv.style.width = `${this.width_}px`;
        this.editorDiv.style.height = `${this.height_ - this.titleHeight}px`;
        this.editorDiv.style.overflow = 'hidden'; // Monaco handles scrolling
        this.editorDiv.style.pointerEvents = 'auto'; // Re-enable for the editor itself
        this.editorDOMContainer = new DOMContainer({
            element: this.editorDiv,
        });
        this.editorDOMContainer.eventMode = 'static';

        // Offset by title bar height
        this.editorDOMContainer.y = this.titleHeight;
        // TODO: Remove this once bug is fixed: https://github.com/pixijs/pixijs/issues/11690. And, once DOMContainer is no longer experimental.
        // This is because of a bug in Pixi.js where DOM containers added as children in HTML are offset by the parent container's position.
        // There is also a bug with how events fire on DOMContainer parents with DOMContainer as children.
        //this.element.appendChild(this.editorDOMContainer.element);
        this.addChild(this.editorDOMContainer);

        this.editorInstance = monaco.editor.create(this.editorDiv, {
            value: content,
            language: 'javascript', // TODO: Detect language from file extension
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });

        // Add Save Command (Ctrl+S)
        this.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            this.save();
        });

    }

    private setAlpha(alpha: number) {
        this.alpha = alpha;
        this.titleBarDOMContainer.alpha = alpha;
        this.editorDOMContainer.alpha = alpha;
    }

    private onDragStart(e: FederatedPointerEvent) {
        this.isDragging = true;
        this.dragOffset = this.toLocal(e.global);
        this.setAlpha(0.5);
        // Prevent event from bubbling to canvas (panning)
        e.stopPropagation();
    }

    private onDragEnd() {
        this.isDragging = false;
        this.dragOffset = null;
        this.setAlpha(1);
    }

    private onDragMove(e: FederatedPointerEvent) {
        if (this.isDragging && this.dragOffset && this.parent) {
            const newPos = this.parent.toLocal(e.global);
            this.x = newPos.x - this.dragOffset.x;
            this.y = newPos.y - this.dragOffset.y;
        }
    }

    private getResizeDirection(x: number, y: number): string | null {
        const threshold = this.borderThickness;
        const w = this.width_;
        const h = this.height_;

        // Check if outside or on the edge
        // Hit area is larger, so we can use 0 and w/h as boundaries
        // We consider "edge" effectively anything < threshold distance from boundary, or outside

        // Coordinates are local to the EditorNode (0,0 is top-left of content)

        let v = '';
        let h_dir = '';

        if (y < threshold) {
            v = 'n';
        } else if (y > h - threshold) {
            v = 's';
        }

        if (x < threshold) {
            h_dir = 'w';
        } else if (x > w - threshold) {
            h_dir = 'e';
        }

        if (v || h_dir) {
            return v + h_dir;
        }

        return null;
    }

    private onBorderPointerMove(e: FederatedPointerEvent) {
        if (this.isResizing) {
            return; // Handled by global move
        }

        const localPos = this.toLocal(e.global);
        const direction = this.getResizeDirection(localPos.x, localPos.y);

        if (direction) {
            this.border.cursor = `${direction}-resize`;
        } else {
            this.border.cursor = 'default';
        }
    }

    private onBorderPointerDown(e: FederatedPointerEvent) {
        if (e.button !== 0) {
            return;
        }

        const localPos = this.toLocal(e.global);
        const direction = this.getResizeDirection(localPos.x, localPos.y);

        if (direction) {
            this.isResizing = true;
            this.resizeDirection = direction;
            this.startMousePosition = { x: e.global.x, y: e.global.y };
            this.startResizeBounds = {
                width: this.width_,
                height: this.height_,
                x: this.x,
                y: this.y
            };
            e.stopPropagation();
        }
    }

    private onGlobalPointerMove(e: FederatedPointerEvent) {
        if (!this.isResizing || !this.startResizeBounds || !this.startMousePosition || !this.resizeDirection || !this.parent) {
            return;
        }

        const currentGlob = e.global;
        // Calculate delta in parent space (assuming scaling is 1 for simplicity, or just use global delta)
        // Since we are changing width/height which are local properties, but dragging affects x/y too (for left/top resize).

        // We calculate delta in global space, then transform to local magnitudes? 
        // Or simpler: Transform start and current to parent space?
        // Parent space is best for updating this.x/this.y

        // Actually, easiest is:
        const currentLocalInParent = this.parent.toLocal(currentGlob); // Mouse in parent coords
        const startLocalInParent = this.parent.toLocal(new DOMPoint(this.startMousePosition.x, this.startMousePosition.y));

        const dx = currentLocalInParent.x - startLocalInParent.x;
        const dy = currentLocalInParent.y - startLocalInParent.y;

        let newX = this.startResizeBounds.x;
        let newY = this.startResizeBounds.y;
        let newW = this.startResizeBounds.width;
        let newH = this.startResizeBounds.height;

        const minW = 100;
        const minH = 200;

        if (this.resizeDirection.includes('e')) {
            newW = Math.max(minW, this.startResizeBounds.width + dx);
        }
        if (this.resizeDirection.includes('w')) {
            // Dragging left: width increases if dx is negative
            // x shifts by dx
            // But we must check min width constraint carefully

            // Proposed Width
            const proposedW = this.startResizeBounds.width - dx;
            if (proposedW >= minW) {
                newW = proposedW;
                newX = this.startResizeBounds.x + dx;
            } else {
                newW = minW;
                newX = this.startResizeBounds.x + (this.startResizeBounds.width - minW);
            }
        }

        if (this.resizeDirection.includes('s')) {
            newH = Math.max(minH, this.startResizeBounds.height + dy);
        }
        if (this.resizeDirection.includes('n')) {
            const proposedH = this.startResizeBounds.height - dy;
            if (proposedH >= minH) {
                newH = proposedH;
                newY = this.startResizeBounds.y + dy;
            } else {
                newH = minH;
                newY = this.startResizeBounds.y + (this.startResizeBounds.height - minH);
            }
        }

        this.x = newX;
        this.y = newY;
        this.resize(newW, newH);
    }

    private onBorderPointerUp(e: FederatedPointerEvent) {
        this.isResizing = false;
        this.resizeDirection = null;
        this.startResizeBounds = null;
        this.startMousePosition = null;
    }

    public resize(w: number, h: number) {
        this.width_ = w;
        this.height_ = h;

        // Update graphics
        this.border.clear();
        this.border.rect(0, 0, this.width_, this.height_)
            .fill(0x000000)
            .stroke({
                width: this.borderThickness,
                color: 0x3c3c3c,
                join: 'round',
                alignment: 0
            });
        this.border.hitArea = new Rectangle(-this.borderThickness, -this.borderThickness, this.width_ + this.borderThickness * 2, this.height_ + this.borderThickness * 2);

        // Update Title Bar
        this.titleBar.style.width = `${this.width_}px`;
        this.titleBarDOMContainer.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);

        // Update Title Bar Proxy
        this.titleBarProxy.clear();
        this.titleBarProxy.rect(0, 0, this.width_, this.titleHeight);
        this.titleBarProxy.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);

        // Update Editor
        this.editorDiv.style.width = `${this.width_}px`;
        this.editorDiv.style.height = `${this.height_ - this.titleHeight}px`;

        // Trigger Monaco Layout
        if (this.editorInstance) {
            this.editorInstance.layout();
        }
    }

    private save() {
        const content = this.editorInstance.getValue();
        window.dispatchEvent(new CustomEvent('save-file', {
            detail: {
                file: this.filePath,
                content: content
            }
        }));
    }

    public override destroy(options?: any) {
        super.destroy(options);
        if (this.editorDiv && this.editorDiv.parentNode) {
            this.editorDiv.parentNode.removeChild(this.editorDiv);
        }
        this.editorInstance.dispose();
    }
}
