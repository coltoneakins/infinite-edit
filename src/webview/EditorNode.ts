import { Container, Graphics, FederatedPointerEvent, Text, TextStyle, Rectangle } from 'pixi.js';
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { keymap } from "@codemirror/view";

export class EditorNode extends Container {
    private background: Graphics;
    private titleBar: Graphics;
    private titleText: Text;
    private editorContainer: HTMLDivElement;
    private editorView: EditorView;
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

        // Setup CodeMirror
        this.editorContainer = document.createElement('div');
        this.editorContainer.style.position = 'absolute';
        this.editorContainer.style.width = `${this.width_}px`;
        this.editorContainer.style.height = `${this.height_ - this.titleHeight}px`;
        this.editorContainer.style.overflow = 'auto';
        this.editorContainer.style.pointerEvents = 'auto'; // Allow interaction
        document.body.appendChild(this.editorContainer);

        this.editorView = new EditorView({
            doc: content,
            extensions: [
                basicSetup,
                javascript(),
                keymap.of([
                    {
                        key: "Mod-s",
                        run: () => {
                            this.save();
                            return true;
                        }
                    }
                ])
            ],
            parent: this.editorContainer
        });

        // Sync DOM position with Pixi Container
        // We need to do this on every frame or when the container moves
        // For now, let's hook into the ticker or update loop if we had one.
        // Since we don't have a global update loop easily accessible here without passing 'app',
        // we can use a requestAnimationFrame loop or similar.
        // A better way in Pixi is to use a ticker.
        // For simplicity, let's just update it when we move.
        // BUT, the parent container (Canvas) might move/zoom too.
        // So we really need a ticker.

        // Hack: Add a ticker to the global window for now or just use requestAnimationFrame
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
        // Note: This assumes the canvas is fullscreen
        this.editorContainer.style.left = `${globalPos.x}px`;
        this.editorContainer.style.top = `${globalPos.y + this.titleHeight * this.worldTransform.d}px`; // Offset by title bar, scaled

        // Handle scaling
        // CodeMirror doesn't scale natively with CSS transform well for interaction, 
        // but for visual consistency we might need to.
        // However, scaling the DOM element might blur text.
        // For now, let's just handle position and maybe simple scaling.

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
        const content = this.editorView.state.doc.toString();
        // We need to send this back to the main thread.
        // Since we don't have direct access to the vscode api here (it's in main.ts),
        // we should dispatch a custom event or use a callback.
        // For simplicity, let's dispatch an event on the window.
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
        this.editorView.destroy();
    }
}
