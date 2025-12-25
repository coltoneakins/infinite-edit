import { Container, DOMContainer, Graphics, FederatedPointerEvent, HTMLText, HTMLTextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';

export class EditorNode extends DOMContainer {
    private titleBarDOMContainer: DOMContainer;
    private titleBar: HTMLDivElement;
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

    constructor(file: string, content: string) {
        super();
        this.filePath = file;
        this.isRenderGroup = true;
        this.cullable = true;
        this.cullableChildren = true;

        // Create DOM element for this node
        this.element = document.createElement('div');
        this.element.className = 'editor-node';
        this.element.style.position = 'absolute';
        this.element.style.width = `${this.width_}px`;
        this.element.style.height = `${this.height_}px`;
        this.element.style.backgroundColor = '#252526';
        this.element.style.border = `${this.borderThickness}px solid #3c3c3c`;
        this.element.style.overflow = 'hidden';

        // Title Bar
        this.titleBar = document.createElement('div');
        this.titleBar.style.position = 'absolute';
        this.titleBar.style.width = `${this.width_}px`;
        this.titleBar.style.height = `${this.titleHeight}px`;
        this.titleBar.style.backgroundColor = '#3c3c3c';
        this.titleBar.style.lineHeight = `${this.titleHeight}px`;
        this.titleBar.style.cursor = 'move';

        // Title Text
        const fileName = file.split('/').pop() || file;
        const dirName = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';
        const titleHtml = dirName
            ? `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dirName}<span style="font-weight: 700;">${fileName}</span></span>`
            : fileName;

        this.titleBar.innerHTML = titleHtml;
        this.titleBarDOMContainer = new DOMContainer({
            element: this.titleBar,
            interactive: true
        });
        this.element.appendChild(this.titleBar);

        // Setup Dragging
        this.titleBarDOMContainer.on('pointerdown', this.onDragStart.bind(this));
        this.titleBarDOMContainer.on('pointerup', this.onDragEnd.bind(this));
        this.titleBarDOMContainer.on('pointerupoutside', this.onDragEnd.bind(this));
        this.titleBarDOMContainer.on('pointermove', this.onDragMove.bind(this));

        // Setup Monaco Editor
        this.editorDiv = document.createElement('div');
        this.editorDiv.style.position = 'absolute';
        this.editorDiv.style.top = `${this.titleHeight}px`;
        this.editorDiv.style.width = `${this.width_}px`;
        this.editorDiv.style.height = `${this.height_ - this.titleHeight}px`;
        this.editorDiv.style.overflow = 'hidden'; // Monaco handles scrolling
        this.editorDiv.style.pointerEvents = 'auto'; // Allow interaction
        this.editorDOMContainer = new DOMContainer({
            element: this.editorDiv,
            interactive: true
        });
        this.element.appendChild(this.editorDiv);

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

    private onDragStart(e: FederatedPointerEvent) {
        this.isDragging = true;
        const localPos = this.toLocal(e.global);
        this.dragOffset = { x: localPos.x, y: localPos.y };
        this.alpha = 0.5;
    }

    private onDragEnd() {
        this.isDragging = false;
        this.dragOffset = null;
        this.alpha = 1;
    }

    private onDragMove(e: FederatedPointerEvent) {
        if (this.isDragging && this.dragOffset && this.parent) {
            const newPos = this.parent.toLocal(e.global);
            this.x = newPos.x - this.dragOffset.x;
            this.y = newPos.y - this.dragOffset.y;
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
