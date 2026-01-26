import { Container, DOMContainer, Graphics, FederatedPointerEvent, Rectangle } from 'pixi.js';
import * as monaco from 'monaco-editor';
import { MessageClient } from '../core/MessageClient';
import { MaskManager, MaskProvider } from '../core/MaskManager';
import { ModelManager, IModelReference } from '../core/ModelManager';

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
    private uri: string;
    private isUpdatingFromBackend: boolean = false;
    private filePath: string;
    private messageClient: MessageClient;
    private maskManager: MaskManager;
    private modelRef: IModelReference;
    private isDragging: boolean = false;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
    private isResizing: boolean = false;
    private resizeDirection: string | null = null;
    private startMousePosition: { x: number; y: number } | null = null;
    private startResizeBounds: { x: number; y: number; width: number; height: number } | null = null;
    private static globalMaxZIndex: number = 10;
    private boundOnGlobalPointerMove = this.onGlobalPointerMove.bind(this);
    private boundOnGlobalPointerUp = this.onGlobalPointerUp.bind(this);
    private static lastContextMenuTriggeredNode: EditorNode | null = null;

    constructor(file: string, content: string, uri: string, messageClient: MessageClient, maskManager: MaskManager, initialDiagnostics: any[] = [], initialSelection?: any) {
        super();
        this.messageClient = messageClient;
        this.maskManager = maskManager;
        this.filePath = file;
        this.uri = uri;
        this.eventMode = 'static';

        // Register as a provider of mask regions (holes)
        this.maskManager.registerProvider(this);

        // Wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'editor-node'; // IMPORTANT: This must match the class in the SCSS file
        this.wrapper.style.width = `${this.width_}px`;
        this.wrapper.style.height = `${this.height_}px`;
        this.wrapper.style.borderWidth = `${this.borderThickness}px`;

        this.element = this.wrapper;

        // Title Bar
        this.titleBarDiv = document.createElement('div');
        this.titleBarDiv.className = 'editor-title-bar'; // IMPORTANT: This must match the class in the SCSS file
        this.titleBarDiv.style.marginTop = `-${this.borderThickness / 2}px`; // Offset by half the border thickness to make titlebar align with border
        this.titleBarDiv.style.width = `${this.width_ - this.borderThickness * 2}px`;
        this.titleBarDiv.style.height = `${this.titleHeight}px`;
        this.titleBarDiv.style.lineHeight = `${this.titleHeight}px`;
        this.titleBarDiv.style.color = this.titleBarDivTextColor;

        // Title Text - File Path
        const fileName = file.split('/').pop() || file;
        const dirName = file.includes('/') ? file.substring(0, file.lastIndexOf('/') + 1) : '';
        const titleHtml = `<div class="editor-title-bar-title" title="${dirName}${fileName}">${fileName}</div>`;

        // Codicon Buttons
        const titlebarButtonsHtml = `<div class="editor-title-bar-buttons">
            <button class="editor-title-bar-button editor-title-bar-native-button" title="Open in Native Editor">
                <i class="codicon codicon-go-to-file"></i>
            </button>
            <button class="editor-title-bar-button editor-title-bar-close-button" title="Close">
                <i class="codicon codicon-close"></i>
            </button>
        </div>`;

        // File Icon using local seti-ui assets
        const fileIconHtml = `<div class="editor-title-bar-icon icon" data-name="${fileName}"></div>`;

        this.titleBarDiv.innerHTML = fileIconHtml + titleHtml + titlebarButtonsHtml;

        // Add button event listeners
        const titlebarNativeButton = this.titleBarDiv.querySelector('.editor-title-bar-native-button');
        titlebarNativeButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openInNativeEditor();
        });
        titlebarNativeButton?.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        const titlebarCloseButton = this.titleBarDiv.querySelector('.editor-title-bar-close-button');
        titlebarCloseButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onClose();
        });
        // Also stop pointerdown to prevent dragging when clicking the close button
        titlebarCloseButton?.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        this.wrapper.appendChild(this.titleBarDiv);

        // Setup Monaco Editor
        this.monacoDiv = document.createElement('div');
        this.monacoDiv.style.width = `${this.width_ - this.borderThickness * 2}px`;
        this.monacoDiv.style.height = `${this.height_ - this.titleHeight - this.borderThickness * 2 + this.borderThickness / 2}px`; // Offset by half the border thickness to make editor align with border
        this.monacoDiv.style.pointerEvents = 'auto'; // Re-enable for the editor itself

        // Get or create model reference through ModelManager
        const modelManager = ModelManager.getInstance();
        this.modelRef = modelManager.getOrCreateModelReference(uri, content, this.filePath);

        // Setup Monaco Editor with custom editorService to handle "Go to Definition"
        this.monacoInstance = monaco.editor.create(this.monacoDiv, {
            model: this.modelRef.model,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            glyphMargin: true,
        }, {
            editorService: {
                openCodeEditor: async (input: any, source: any, sideBySide: any) => {
                    const resource = input.resource;
                    const selection = input.options ? input.options.selection : null;

                    // If it's the current file, just navigate within the same editor
                    if (resource.toString() === this.uri || resource.path === this.filePath) {
                        if (selection) {
                            this.monacoInstance.revealRangeInCenter(selection);
                            this.monacoInstance.setPosition({
                                lineNumber: selection.startLineNumber,
                                column: selection.startColumn
                            });
                            this.monacoInstance.focus();
                        }
                        return this.monacoInstance;
                    }

                    // For a different file, request the backend to open it
                    // This will trigger the 'openFile' message in the webview
                    this.messageClient.send('requestOpenFile', {
                        path: resource.path,
                        selection: selection
                    });

                    return null; // The file will be opened in a new EditorNode
                }
            } as any
        });
        this.wrapper.appendChild(this.monacoDiv);

        // Listen for changes and send to backend
        this.monacoInstance.onDidChangeModelContent(() => {
            if (this.isUpdatingFromBackend) {
                return;
            }
            this.onContentChanged();
        });

        // Toggle breakpoints on gutter click
        this.monacoInstance.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber) {
                    this.toggleBreakpoint(lineNumber);
                }
            }
        });

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

        // Set up context menu tracking
        this.monacoInstance.onContextMenu(() => {
            EditorNode.lastContextMenuTriggeredNode = this;
        });

        // Raise to front on mouse up
        this.monacoInstance.onDidFocusEditorText(() => {
            this.bringToFront();
        });

        this.bringToFront();

        if (initialDiagnostics && initialDiagnostics.length > 0) {
            this.setDiagnostics(initialDiagnostics);
        }

        if (initialSelection) {
            this.setSelection(initialSelection);
        }
    }

    private contentChangeTimeout: any = null;
    private onContentChanged() {
        if (this.contentChangeTimeout) {
            clearTimeout(this.contentChangeTimeout);
        }

        this.contentChangeTimeout = setTimeout(() => {
            const content = this.monacoInstance.getValue();
            this.messageClient.send('updateFile', {
                file: this.filePath,
                content: content
            });
            this.contentChangeTimeout = null;
        }, 300); // 300ms debounce
    }

    public updateContent(content: string) {
        if (this.monacoInstance.getValue() === content) {
            return;
        }
        this.isUpdatingFromBackend = true;
        this.monacoInstance.setValue(content);
        this.isUpdatingFromBackend = false;
    }

    public setDiagnostics(diagnostics: any[]) {
        const model = this.monacoInstance.getModel();
        if (model) {
            monaco.editor.setModelMarkers(model, 'vscode', diagnostics);
        }
    }

    public setSelection(selection: any) {
        if (selection) {
            const range = new monaco.Range(
                selection.startLineNumber,
                selection.startColumn,
                selection.endLineNumber,
                selection.endColumn
            );
            this.monacoInstance.revealRangeInCenter(range);
            this.monacoInstance.setPosition({
                lineNumber: selection.startLineNumber,
                column: selection.startColumn
            });
            this.monacoInstance.focus();
        }
    }

    private breakpointDecorations: string[] = [];
    public setBreakpoints(breakpoints: number[]) {
        const model = this.monacoInstance.getModel();
        if (!model) {
            return;
        }

        const newDecorations: monaco.editor.IModelDeltaDecoration[] = breakpoints.map(line => ({
            range: new monaco.Range(line, 1, line, 1),
            options: {
                isFullWidth: true,
                glyphMarginClassName: 'editor-breakpoint-glyph', // Need to add CSS for this
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
        }));

        this.breakpointDecorations = this.monacoInstance.deltaDecorations(this.breakpointDecorations, newDecorations);
    }

    private toggleBreakpoint(lineNumber: number) {
        this.messageClient.send('toggleBreakpoint', {
            file: this.filePath,
            line: lineNumber
        });
    }

    private openInNativeEditor() {
        this.messageClient.send('openInNativeEditor', {
            file: this.filePath
        });
    }

    public getFilePath(): string {
        return this.filePath;
    }

    private setAlpha(alpha: number) {
        this.alpha = alpha;
    }

    private onDragStart(e: PointerEvent) {
        if (e.button !== 0) {
            return; // Only drag with left mouse button
        }
        this.isDragging = true;
        this.titleBarDiv.setPointerCapture(e.pointerId);
        this.titleBarDiv.style.cursor = 'grabbing';

        const globalPoint = { x: e.clientX, y: e.clientY };
        const localPoint = this.toLocal(globalPoint);
        this.dragOffset = { x: localPoint.x, y: localPoint.y };

        this.setAlpha(0.8);

        // Bring to front
        this.bringToFront();

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
        // thresholdOutside: how many screen pixels OUTSIDE the box to detect
        // thresholdInside: how many world pixels INSIDE the box to detect (the border itself)
        const thresholdOutsideScreen = 15;
        const worldScale = this.worldTransform.a || 1;
        const thresholdOutside = thresholdOutsideScreen / worldScale;
        const thresholdInside = this.borderThickness;

        const w = this.width_;
        const h = this.height_;

        let v_dir = '';
        let h_dir = '';

        // Check if we are altogether too far from the node
        if (x < -thresholdOutside || x > w + thresholdOutside || y < -thresholdOutside || y > h + thresholdOutside) {
            return null;
        }

        // Vertical directions: Top edge (-thresholdOutside to border) or Bottom edge (h - border to h + thresholdOutside)
        if (y >= -thresholdOutside && y <= thresholdInside) {
            v_dir = 'n';
        } else if (y >= h - thresholdInside && y <= h + thresholdOutside) {
            v_dir = 's';
        }

        // Horizontal directions: Left edge (-thresholdOutside to border) or Right edge (w - border to w + thresholdOutside)
        if (x >= -thresholdOutside && x <= thresholdInside) {
            h_dir = 'w';
        } else if (x >= w - thresholdInside && x <= w + thresholdOutside) {
            h_dir = 'e';
        }

        return (v_dir || h_dir) ? v_dir + h_dir : null;
    }


    private onWrapperPointerMove(e: PointerEvent) {
        if (this.isResizing || this.isDragging) {
            return;
        }

        const localPoint = this.toLocal({ x: e.clientX, y: e.clientY });
        const x = localPoint.x;
        const y = localPoint.y;
        const direction = this.getResizeDirection(x, y);

        if (direction) {
            this.wrapper.style.cursor = `${direction}-resize`;
        } else {
            this.wrapper.style.cursor = 'default';
        }
    }

    private onWrapperPointerDown(e: PointerEvent) {
        if (this.isDragging || e.button !== 0) {
            return; // Only resize with left mouse button
        }

        const localPoint = this.toLocal({ x: e.clientX, y: e.clientY });
        const x = localPoint.x;
        const y = localPoint.y;
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
            this.bringToFront();

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

        this.titleBarDiv.style.width = `${this.width_ - this.borderThickness * 2}px`;

        this.monacoDiv.style.width = `${this.width_ - this.borderThickness * 2}px`;
        this.monacoDiv.style.height = `${this.height_ - this.titleHeight - this.borderThickness * 2 + this.borderThickness / 2}px`; // Offset by half the border thickness to make editor align with border

        if (this.monacoInstance) {
            this.monacoInstance.layout();
        }
        this.emit('resized');
    }

    public setZIndex(z: number) {
        this.zIndex = z;
        this.wrapper.style.zIndex = z.toString();
    }

    public bringToFront() {
        EditorNode.globalMaxZIndex++;
        this.setZIndex(EditorNode.globalMaxZIndex);
        if (this.parent) {
            this.parent.addChild(this);
        }
    }

    private async save() {
        try {
            await this.modelRef.save();
        } catch (e) {
            console.error('Failed to save file:', e);
            this.messageClient.send('alert', {
                message: `Failed to save ${this.filePath}: ${e}`
            });
        }
    }

    private onClose() {
        this.emit('close');
    }

    public getMaskLocalBounds(): Rectangle {
        return new Rectangle(this.x, this.y, this.width_, this.height_);
    }

    public getMaskGlobalBounds(): Rectangle[] {
        return this.getGlobalBoundsList(0);
    }

    public getInteractionGlobalBounds(): Rectangle[] {
        // Use an 15px buffer for interaction to allow for resizing just outside the node
        // as defined in our getResizeDirection logic.
        return this.getGlobalBoundsList(15);
    }

    private getGlobalBoundsList(nodeBuffer: number): Rectangle[] {
        const worldScale = this.worldTransform.a || 1;
        // The buffer is in screen pixels, so we convert it to world space for local toGlobal calls
        const localBuffer = nodeBuffer / worldScale;

        // Since we are using PixiJS, toGlobal handles the parent transforms (like zoom/pan)
        // for us. We calculate the Top-Left and Bottom-Right corners in global space.

        // We use (0,0) as local top-left, offset by buffer
        const topLeft = this.toGlobal({ x: -localBuffer, y: -localBuffer });

        // And (width, height) as local bottom-right, offset by buffer
        const bottomRight = this.toGlobal({ x: this.width_ + localBuffer, y: this.height_ + localBuffer });

        // Note: toGlobal accounts for rotation too, but assuming axis-aligned for now since
        // rectangles are axis-aligned. If rotated, we'd need min/max of 4 corners.
        // EditorNodes are not rotated in this app.

        const regions: Rectangle[] = [
            new Rectangle(
                Math.min(topLeft.x, bottomRight.x),
                Math.min(topLeft.y, bottomRight.y),
                Math.abs(bottomRight.x - topLeft.x),
                Math.abs(bottomRight.y - topLeft.y)
            )
        ];

        // We look for common Monaco widget classes.
        const widgetSelectors = '.monaco-menu-container, .monaco-menu, .context-view, .monaco-hover, .monaco-editor-hover, .suggest-widget';

        // 1. Check for any children of the wrapper that are not the title bar or the editor div.
        // These are typically Monaco overflow widgets (suggestions, hovers, etc.) 
        // that we forced to be children of this.wrapper via overflowWidgetsDomNode.
        const overflowWidgets = this.findWidgets(this.wrapper, widgetSelectors);
        overflowWidgets.forEach(element => {
            const rect = element.getBoundingClientRect();
            // Ensure the child is actually visible/has dimensions
            if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(element);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    regions.push(new Rectangle(rect.left, rect.top, rect.width, rect.height));
                }
            }
        });

        // 2. Check for any global context menus or hovers that might belong to this editor session.
        // Even with overflowWidgetsDomNode, some widgets might still be appended to body in certain versions/configs.
        // We only check these if this node was the last one to trigger a context menu.
        if (EditorNode.lastContextMenuTriggeredNode === this) {
            const globalWidgets = this.findWidgets(document.body, widgetSelectors);
            globalWidgets.forEach(element => {
                // If it's already in our wrapper (handled above), we skip it to avoid duplicates
                if (this.wrapper.contains(element)) {
                    return;
                }

                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const style = window.getComputedStyle(element);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        regions.push(new Rectangle(rect.left, rect.top, rect.width, rect.height));
                    }
                }
            });
        }

        return regions;
    }

    /**
     * Finds elements matching the selector within the root and any nested shadow roots.
     * This is necessary because Monaco often uses Shadow DOM for its widgets.
     */
    private findWidgets(root: HTMLElement | Document, selector: string): HTMLElement[] {
        const results: HTMLElement[] = [];

        // Find matches in the current root
        root.querySelectorAll(selector).forEach(el => results.push(el as HTMLElement));

        // Find matches in all nested shadow roots
        const allElements = root.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll(selector).forEach(match => {
                    results.push(match as HTMLElement);
                });
            }
        });

        return results;
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
        // Release our reference to the model - it will be disposed if no other editors use it
        this.modelRef.dispose();
    }
}
