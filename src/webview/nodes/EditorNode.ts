import { Container, DOMContainer, Graphics, FederatedPointerEvent, HTMLText, HTMLTextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';
import { LanguageManager } from '../core/LanguageManager';
import { MessageClient } from '../core/MessageClient';

export class EditorNode extends DOMContainer {
    private wrapper: HTMLDivElement;
    private titleBarDivTextColor: string = '#ffffff';
    private titleBarDiv: HTMLDivElement;
    private monacoDiv: HTMLDivElement;
    private monacoInstance: monaco.editor.IStandaloneCodeEditor;
    private width_: number = 400;
    private height_: number = 600;
    private titleHeight: number = 30;
    private filePath: string;
    private borderThickness: number = 5;
    private messageClient: MessageClient;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

    constructor(file: string, content: string, messageClient: MessageClient) {
        super();
        this.messageClient = messageClient;
        this.filePath = file;
        this.isRenderGroup = true;
        this.eventMode = 'static';

        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.style.width = `${this.width_}px`;
        this.wrapper.style.height = `${this.height_}px`;
        this.wrapper.style.position = 'relative';
        this.wrapper.style.overflow = 'hidden';
        this.wrapper.style.backgroundColor = '#3c3c3c';
        this.wrapper.style.border = `${this.borderThickness}px solid #3c3c3c`;
        this.wrapper.style.borderRadius = '5px';

        this.element = this.wrapper;

        // Title Bar
        this.titleBarDiv = document.createElement('div');
        this.titleBarDiv.style.width = `${this.width_}px`;
        this.titleBarDiv.style.height = `${this.titleHeight}px`;
        this.titleBarDiv.style.backgroundColor = 'transparent';
        this.titleBarDiv.style.lineHeight = `${this.titleHeight}px`;
        this.titleBarDiv.style.overflow = 'hidden';
        this.titleBarDiv.style.whiteSpace = 'nowrap';
        this.titleBarDiv.style.textOverflow = 'ellipsis';
        this.titleBarDiv.style.color = this.titleBarDivTextColor;
        this.titleBarDiv.style.pointerEvents = 'auto';
        this.titleBarDiv.style.userSelect = 'none';
        this.titleBarDiv.style.cursor = 'grab';
        this.titleBarDiv.className = 'editor-title-bar';

        // Title Text - File Path
        const fileName = file.split('/').pop() || file;
        const dirName = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';
        const titleHtml = dirName
            ? `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dirName}<span style="font-weight: 700;">${fileName}</span></span>`
            : fileName;

        this.titleBarDiv.innerHTML = titleHtml;

        this.wrapper.appendChild(this.titleBarDiv);

        // Setup Monaco Editor
        this.monacoDiv = document.createElement('div');
        this.monacoDiv.style.width = `${this.width_}px`;
        this.monacoDiv.style.height = `${this.height_ - this.titleHeight}px`;
        this.monacoDiv.style.pointerEvents = 'auto'; // Re-enable for the editor itself

        // Setup Monaco Editor
        this.monacoInstance = monaco.editor.create(this.monacoDiv, {
            value: content,
            language: LanguageManager.prepareLanguageForFile(this.filePath),
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false }
        });

        this.wrapper.appendChild(this.monacoDiv);

        // Set up interaction
        this.titleBarDiv.addEventListener('pointerdown', this.onDragStart.bind(this));
        this.titleBarDiv.addEventListener('pointerup', this.onDragEnd.bind(this));
        this.titleBarDiv.addEventListener('pointermove', this.onDragMove.bind(this));


        // Add Save Command (Ctrl+S)
        this.monacoInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            this.save();
        });
    }

    private setAlpha(alpha: number) {
        this.alpha = alpha;
    }

    private onDragStart(e: PointerEvent) {
        this.isDragging = true;
        this.titleBarDiv.setPointerCapture(e.pointerId);
        this.titleBarDiv.style.cursor = 'grabbing';

        const globalPoint = { x: e.clientX, y: e.clientY };
        const localPoint = this.toLocal(globalPoint);
        this.dragOffset = { x: localPoint.x, y: localPoint.y };

        this.setAlpha(0.8);

        // Bring to front
        if (this.parent) {
            this.parent.addChild(this);
        }

        e.stopPropagation();
    }

    private onDragEnd(e: PointerEvent) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.titleBarDiv.releasePointerCapture(e.pointerId);
        this.titleBarDiv.style.cursor = 'grab';
        this.setAlpha(1);
    }

    private onDragMove(e: PointerEvent) {
        if (this.isDragging && this.parent) {
            const globalPoint = { x: e.clientX, y: e.clientY };
            const parentPoint = this.parent.toLocal(globalPoint);
            this.x = parentPoint.x - this.dragOffset.x;
            this.y = parentPoint.y - this.dragOffset.y;
        }
    }

    //     const localPos = this.toLocal(e.global);
    //     const direction = this.getResizeDirection(localPos.x, localPos.y);

    //     if (direction) {
    //         this.border.cursor = `${direction}-resize`;
    //     } else {
    //         this.border.cursor = 'default';
    //     }
    // }

    // private onBorderPointerDown(e: FederatedPointerEvent) {
    //     if (e.button !== 0) {
    //         return;
    //     }

    //     const localPos = this.toLocal(e.global);
    //     const direction = this.getResizeDirection(localPos.x, localPos.y);

    //     if (direction) {
    //         this.isResizing = true;
    //         this.resizeDirection = direction;
    //         this.startMousePosition = { x: e.global.x, y: e.global.y };
    //         this.startResizeBounds = {
    //             width: this.width_,
    //             height: this.height_,
    //             x: this.x,
    //             y: this.y
    //         };
    //         e.stopPropagation();
    //     }
    // }

    // private onGlobalPointerMove(e: FederatedPointerEvent) {
    //     if (!this.isResizing || !this.startResizeBounds || !this.startMousePosition || !this.resizeDirection || !this.parent) {
    //         return;
    //     }

    //     const currentGlob = e.global;
    //     // Calculate delta in parent space (assuming scaling is 1 for simplicity, or just use global delta)
    //     // Since we are changing width/height which are local properties, but dragging affects x/y too (for left/top resize).

    //     // We calculate delta in global space, then transform to local magnitudes? 
    //     // Or simpler: Transform start and current to parent space?
    //     // Parent space is best for updating this.x/this.y

    //     // Actually, easiest is:
    //     const currentLocalInParent = this.parent.toLocal(currentGlob); // Mouse in parent coords
    //     const startLocalInParent = this.parent.toLocal(new DOMPoint(this.startMousePosition.x, this.startMousePosition.y));

    //     const dx = currentLocalInParent.x - startLocalInParent.x;
    //     const dy = currentLocalInParent.y - startLocalInParent.y;

    //     let newX = this.startResizeBounds.x;
    //     let newY = this.startResizeBounds.y;
    //     let newW = this.startResizeBounds.width;
    //     let newH = this.startResizeBounds.height;

    //     const minW = 100;
    //     const minH = 200;

    //     if (this.resizeDirection.includes('e')) {
    //         newW = Math.max(minW, this.startResizeBounds.width + dx);
    //     }
    //     if (this.resizeDirection.includes('w')) {
    //         // Dragging left: width increases if dx is negative
    //         // x shifts by dx
    //         // But we must check min width constraint carefully

    //         // Proposed Width
    //         const proposedW = this.startResizeBounds.width - dx;
    //         if (proposedW >= minW) {
    //             newW = proposedW;
    //             newX = this.startResizeBounds.x + dx;
    //         } else {
    //             newW = minW;
    //             newX = this.startResizeBounds.x + (this.startResizeBounds.width - minW);
    //         }
    //     }

    //     if (this.resizeDirection.includes('s')) {
    //         newH = Math.max(minH, this.startResizeBounds.height + dy);
    //     }
    //     if (this.resizeDirection.includes('n')) {
    //         const proposedH = this.startResizeBounds.height - dy;
    //         if (proposedH >= minH) {
    //             newH = proposedH;
    //             newY = this.startResizeBounds.y + dy;
    //         } else {
    //             newH = minH;
    //             newY = this.startResizeBounds.y + (this.startResizeBounds.height - minH);
    //         }
    //     }

    //     this.x = newX;
    //     this.y = newY;
    //     this.resize(newW, newH);
    // }

    // private onBorderPointerUp(e: FederatedPointerEvent) {
    //     this.isResizing = false;
    //     this.resizeDirection = null;
    //     this.startResizeBounds = null;
    //     this.startMousePosition = null;
    // }

    // public resize(w: number, h: number) {
    //     this.width_ = w;
    //     this.height_ = h;

    //     // Update graphics
    //     this.border.clear();
    //     this.border.rect(0, 0, this.width_, this.height_)
    //         .fill(0x3c3c3c)
    //         .stroke({
    //             width: this.borderThickness,
    //             color: 0x3c3c3c,
    //             join: 'round',
    //             alignment: 0
    //         });
    //     this.border.hitArea = new Rectangle(-this.borderThickness - this.borderHitAreaBuffer, -this.borderThickness - this.borderHitAreaBuffer, this.width_ + this.borderThickness * 2 + this.borderHitAreaBuffer * 2, this.height_ + this.borderThickness * 2 + this.borderHitAreaBuffer * 2);

    //     // Update Title Bar
    //     this.titleBar.style.width = `${this.width_}px`;
    //     this.titleBarDOMContainer.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);

    //     // Update Title Bar Proxy
    //     this.titleBarProxy.clear();
    //     this.titleBarProxy.rect(0, 0, this.width_, this.titleHeight);
    //     this.titleBarProxy.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);

    //     // Update Editor
    //     this.editorDiv.style.width = `${this.width_}px`;
    //     this.editorDiv.style.height = `${this.height_ - this.titleHeight}px`;

    //     // Trigger Monaco Layout
    //     if (this.editorInstance) {
    //         this.editorInstance.layout();
    //     }
    // }


    private save() {
        const content = this.monacoInstance.getValue();
        this.messageClient.send('saveFile', {
            file: this.filePath,
            content: content
        });
    }

    public override destroy(options?: any) {
        super.destroy(options);
        if (this.monacoDiv && this.monacoDiv.parentNode) {
            this.monacoDiv.parentNode.removeChild(this.monacoDiv);
        }
        this.monacoInstance.dispose();
    }
}
