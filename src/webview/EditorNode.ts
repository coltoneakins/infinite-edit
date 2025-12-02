import { Container, Graphics, FederatedPointerEvent, Text, TextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';

export class EditorNode extends Container {
    private background: Graphics;
    private titleBar: Graphics;
    private titleText: Text;
    private editorContainer: HTMLDivElement;
    private editorInstance: monaco.editor.IStandaloneCodeEditor;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } | null = null;
    private width_: number = 400;
    private height_: number = 300;
    private titleHeight: number = 30;

    constructor(file: string, content: string) {
        super();

        // Background
        this.background = new Graphics();
        this.addChild(this.background);

        // Title Bar
        this.titleBar = new Graphics();
        this.titleBar.eventMode = 'static';
        this.titleBar.cursor = 'move';
        this.addChild(this.titleBar);

        // Title Text
        const style = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 14,
            fill: '#ffffff',
            whiteSpace: 'pre-line'
        });
        this.titleText = new Text({ text: file, style, textureStyle: { scaleMode: 'linear' } });
        this.titleText.x = 10;
        this.titleText.y = 5;
        this.addChild(this.titleText);

        // Draw initial graphics
        this.draw();

        // Setup Dragging
        this.titleBar.on('pointerdown', this.onDragStart.bind(this));
        this.titleBar.on('pointerup', this.onDragEnd.bind(this));
        this.titleBar.on('pointerupoutside', this.onDragEnd.bind(this));
        this.titleBar.on('pointermove', this.onDragMove.bind(this));

        // Setup Monaco Editor
        this.editorContainer = document.createElement('div');
        this.editorContainer.style.position = 'absolute';
        this.editorContainer.style.width = `${this.width_}px`;
        this.editorContainer.style.height = `${this.height_ - this.titleHeight}px`;
        this.editorContainer.style.overflow = 'hidden'; // Monaco handles scrolling
        this.editorContainer.style.pointerEvents = 'auto'; // Allow interaction
        document.body.appendChild(this.editorContainer);

        this.editorInstance = monaco.editor.create(this.editorContainer, {
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

        // Sync DOM position with Pixi Container
        const updatePosition = () => {
            if (this.destroyed) {
                return;
            }
            this.updateDOMPosition();
            requestAnimationFrame(updatePosition);
        };
        updatePosition();
    }

    private draw() {
        this.background.clear();
        this.background.rect(0, 0, this.width_, this.height_);
        this.background.fill(0x252526); // VS Code editor background
        this.background.stroke({ width: 1, color: 0x454545 });

        this.titleBar.clear();
        this.titleBar.rect(0, 0, this.width_, this.titleHeight);
        this.titleBar.fill(0x3c3c3c);
        // Explicitly set hitArea to ensure it catches events
        this.titleBar.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);

        // Update mask
        this.titleBarMask.clear();
        this.titleBarMask.fill(0xffffff);
        this.titleBarMask.rect(0, 0, this.width_, this.titleHeight);

        // Update Text Alignment
        const padding = 10;
        const availableWidth = this.width_ - (padding * 2);

        if (this.titleText.width > availableWidth) {
            // Right align if overflows (show the end of the filename)
            this.titleText.x = this.width_ - this.titleText.width - padding;
        } else {
            // Left align if fits
            this.titleText.x = padding;
        }
        this.titleText.y = this.titleHeight / 2 - this.titleText.height / 2;
    }

    private onDragStart(e: FederatedPointerEvent) {
        console.log('EditorNode: onDragStart');
        this.isDragging = true;
        const localPos = this.toLocal(e.global);
        this.dragOffset = { x: localPos.x, y: localPos.y };
        this.alpha = 0.8;
    }

    private onDragEnd() {
        console.log('EditorNode: onDragEnd');
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

    private updateDOMPosition() {
        // Calculate global position
        const globalPos = this.getGlobalPosition();

        // Apply to DOM element
        this.editorContainer.style.left = `${globalPos.x}px`;
        this.editorContainer.style.top = `${globalPos.y + this.titleHeight * this.worldTransform.d}px`; // Offset by title bar, scaled

        const scaleX = this.worldTransform.a;
        const scaleY = this.worldTransform.d;

        this.editorContainer.style.transformOrigin = 'top left';
        this.editorContainer.style.transform = `scale(${scaleX}, ${scaleY})`;

        // Visibility check
        if (!this.visible || this.alpha <= 0) {
            this.editorContainer.style.display = 'none';
        } else {
            this.editorContainer.style.display = 'block';
        }
    }

    private save() {
        const content = this.editorInstance.getValue();
        window.dispatchEvent(new CustomEvent('save-file', {
            detail: {
                file: this.titleText.text,
                content: content
            }
        }));
    }

    public override destroy(options?: any) {
        super.destroy(options);
        if (this.editorContainer && this.editorContainer.parentNode) {
            this.editorContainer.parentNode.removeChild(this.editorContainer);
        }
        this.editorInstance.dispose();
    }
}
