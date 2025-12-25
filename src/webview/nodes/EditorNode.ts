import { Container, Graphics, FederatedPointerEvent, HTMLText, HTMLTextStyle, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';

export class EditorNode extends Container {
    private background: Graphics;
    private titleBarContainer: Container;
    private titleBar: Graphics;
    private titleBarMask: Graphics;
    private titleText: HTMLText;
    private editorContainer: HTMLDivElement;
    private editorInstance: monaco.editor.IStandaloneCodeEditor;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } | null = null;
    private width_: number = 400;
    private height_: number = 600;
    private titleHeight: number = 30;
    private filePath: string;

    constructor(file: string, content: string) {
        super();
        this.filePath = file;
        this.isRenderGroup = true;
        this.cullable = true;

        // Background
        this.background = new Graphics();
        this.background.rect(0, 0, this.width_, this.height_);
        this.background.fill(0x252526); // VS Code editor background
        this.background.stroke({ width: 5, color: 0x454545 });
        this.addChild(this.background);

        // Title Bar
        this.titleBarContainer = new Container();
        this.titleBar = new Graphics();
        this.titleBar.eventMode = 'static';
        this.titleBar.cursor = 'move';
        this.titleBar.clear();
        this.titleBar.rect(0, 0, this.width_, this.titleHeight);
        this.titleBar.fill(0x3c3c3c);
        // Explicitly set hitArea to ensure it catches events
        this.titleBar.hitArea = new Rectangle(0, 0, this.width_, this.titleHeight);
        this.addChild(this.titleBar);

        // Create a mask for the title bar
        this.titleBarMask = new Graphics();
        this.titleBarMask.rect(0, 0, this.width_, this.titleHeight);
        this.titleBarMask.fill(0xffffff); // Fill is required for mask to work
        this.titleBar.addChild(this.titleBarMask);

        // Title Text
        const style = new HTMLTextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
            fill: '#cccccc',
            fontWeight: '400'
        });

        const fileName = file.split('/').pop() || file;
        const dirName = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';
        const titleHtml = dirName
            ? `<span>${dirName}</span><span style="font-weight: 700;">${fileName}`
            : fileName;

        this.titleText = new HTMLText({
            text: titleHtml,
            style,
            resolution: 10
        });
        this.titleBar.addChild(this.titleText);

        // Apply mask to text
        this.titleText.mask = this.titleBarMask;

        // Draw initial graphics
        this.updateTitleTextAlignment();

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

        // Sync editor DOM position with Pixi Container
        const updatePosition = () => {
            if (this.destroyed) {
                return;
            }
            this.updateDOMPosition();
            requestAnimationFrame(updatePosition);
        };
        updatePosition();
    }

    private updateTitleTextAlignment() {
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
        this.titleText.y = (this.titleHeight - this.titleText.height) / 2;
    }

    private setAlpha(alpha: number) {
        this.alpha = alpha;
        this.titleBarContainer.alpha = alpha;
        this.background.alpha = alpha;
        this.editorContainer.style.opacity = alpha.toString();
    }

    private onDragStart(e: FederatedPointerEvent) {
        this.isDragging = true;
        const localPos = this.toLocal(e.global);
        this.dragOffset = { x: localPos.x, y: localPos.y };
        this.setAlpha(0.5);
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
                file: this.filePath,
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
