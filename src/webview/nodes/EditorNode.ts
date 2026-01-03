import { Container, DOMContainer, Graphics, FederatedPointerEvent, HTMLText, HTMLTextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';
import { LanguageManager } from '../core/LanguageManager';
import { MessageClient } from '../core/MessageClient';

import { MaskManager, MaskProvider } from '../core/MaskManager';

export class EditorNode extends DOMContainer implements MaskProvider {
    private wrapper: HTMLDivElement;
    private titleBarDivTextColor: string = '#ffffff';
    private titleBarDiv: HTMLDivElement;
    private monacoDiv: HTMLDivElement;
    private monacoInstance: monaco.editor.IStandaloneCodeEditor;
    private borderThickness: number = 5;
    private width_: number = 400;
    private height_: number = 600;
    private titleHeight: number = 30;
    private filePath: string;
    private messageClient: MessageClient;
    private maskManager: MaskManager;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
    private isResizing: boolean = false;
    private resizeDirection: string | null = null;
    private startMousePosition: { x: number; y: number } | null = null;
    private startResizeBounds: { x: number; y: number; width: number; height: number } | null = null;
    private boundOnGlobalPointerMove = this.onGlobalPointerMove.bind(this);
    private boundOnGlobalPointerUp = this.onGlobalPointerUp.bind(this);

    constructor(file: string, content: string, messageClient: MessageClient, maskManager: MaskManager) {
        super();
        this.messageClient = messageClient;
        this.maskManager = maskManager;
        this.filePath = file;
        this.eventMode = 'static';

        // Register as a provider of mask regions (holes)
        this.maskManager.registerProvider(this);

        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.style.width = `${this.width_}px`;
        this.wrapper.style.height = `${this.height_}px`;
        this.wrapper.style.position = 'relative';
        this.wrapper.style.overflow = 'hidden';
        this.wrapper.style.backgroundColor = '#3c3c3c';
        this.wrapper.style.border = `${this.borderThickness}px solid #3c3c3c`;
        this.wrapper.style.borderRadius = '5px';
        this.wrapper.style.boxSizing = 'border-box';

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

        // Resize listeners on wrapper
        this.wrapper.addEventListener('pointermove', this.onWrapperPointerMove.bind(this));
        this.wrapper.addEventListener('pointerdown', this.onWrapperPointerDown.bind(this));
        // Use window for move/up to catch events outside the wrapper
        window.addEventListener('pointermove', this.boundOnGlobalPointerMove);
        window.addEventListener('pointerup', this.boundOnGlobalPointerUp);


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
        if (!this.isDragging) {
            return;
        }

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
            this.emit('moved');
        }
    }

    private getResizeDirection(x: number, y: number): string | null {
        const threshold = this.borderThickness + 5; // Slightly larger hit area for ease of use
        const w = this.width_;
        const h = this.height_;

        let v_dir = '';
        let h_dir = '';

        if (y < threshold) {
            v_dir = 'n';
        } else if (y > h - threshold) {
            v_dir = 's';
        }

        if (x < threshold) {
            h_dir = 'w';
        } else if (x > w - threshold) {
            h_dir = 'e';
        }

        return (v_dir || h_dir) ? v_dir + h_dir : null;
    }

    private onWrapperPointerMove(e: PointerEvent) {
        if (this.isResizing || this.isDragging) {
            return;
        }

        const rect = this.wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const direction = this.getResizeDirection(x, y);

        if (direction) {
            this.wrapper.style.cursor = `${direction}-resize`;
        } else {
            this.wrapper.style.cursor = 'default';
        }
    }

    private onWrapperPointerDown(e: PointerEvent) {
        if (this.isDragging) {
            return;
        }

        const rect = this.wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const direction = this.getResizeDirection(x, y);

        if (direction) {
            this.isResizing = true;
            this.resizeDirection = direction;
            this.startMousePosition = { x: e.clientX, y: e.clientY };
            this.startResizeBounds = {
                width: this.width_,
                height: this.height_,
                x: this.x,
                y: this.y
            };
            this.wrapper.setPointerCapture(e.pointerId);

            // Bring to front
            if (this.parent) {
                this.parent.addChild(this);
            }

            e.stopPropagation();
        }
    }

    private onGlobalPointerMove(e: PointerEvent) {
        if (!this.isResizing || !this.startResizeBounds || !this.startMousePosition || !this.resizeDirection || !this.parent) {
            return;
        }

        const dx = (e.clientX - this.startMousePosition.x) / this.parent.scale.x;
        const dy = (e.clientY - this.startMousePosition.y) / this.parent.scale.y;

        let newX = this.startResizeBounds.x;
        let newY = this.startResizeBounds.y;
        let newW = this.startResizeBounds.width;
        let newH = this.startResizeBounds.height;

        const minW = 200;
        const minH = 100;

        if (this.resizeDirection.includes('e')) {
            newW = Math.max(minW, this.startResizeBounds.width + dx);
        }
        if (this.resizeDirection.includes('w')) {
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
        this.emit('moved'); // Positional change during resize
    }

    private onGlobalPointerUp(e: PointerEvent) {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeDirection = null;
            this.startResizeBounds = null;
            this.startMousePosition = null;
            this.wrapper.releasePointerCapture(e.pointerId);
            this.wrapper.style.cursor = 'default';
        }
    }

    public resize(w: number, h: number) {
        this.width_ = w;
        this.height_ = h;

        this.wrapper.style.width = `${this.width_}px`;
        this.wrapper.style.height = `${this.height_}px`;

        this.titleBarDiv.style.width = `${this.width_}px`;

        this.monacoDiv.style.width = `${this.width_}px`;
        this.monacoDiv.style.height = `${this.height_ - this.titleHeight}px`;

        if (this.monacoInstance) {
            this.monacoInstance.layout();
        }
        this.emit('resized');
    }

    public setZIndex(z: number) {
        this.zIndex = z;
        this.wrapper.style.zIndex = z.toString();
    }

    private save() {
        const content = this.monacoInstance.getValue();
        this.messageClient.send('saveFile', {
            file: this.filePath,
            content: content
        });
    }

    public getMaskBounds(): Rectangle {
        return new Rectangle(this.x, this.y, this.width_, this.height_);
    }

    public get isInteracting(): boolean {
        return this.isDragging || this.isResizing;
    }

    public override destroy(options?: any) {
        this.maskManager.unregisterProvider(this);
        window.removeEventListener('pointermove', this.boundOnGlobalPointerMove);
        window.removeEventListener('pointerup', this.boundOnGlobalPointerUp);

        super.destroy(options);
        if (this.monacoDiv && this.monacoDiv.parentNode) {
            this.monacoDiv.parentNode.removeChild(this.monacoDiv);
        }
        this.monacoInstance.dispose();
    }
}
