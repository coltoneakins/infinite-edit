import { createTravels } from 'travels';
import { MessageClient } from './MessageClient';
import { PersistedAppState, DEFAULT_APP_STATE } from '../../shared/types/appState';
import { PersistedNodeState, PersistedViewportState } from '../../shared/types/canvasState';

/**
 * Manages the in-memory application state using Travels for efficient
 * patch-based change tracking, and automatically persists to the backend
 * via MessageClient.
 *
 * Travels state root is `PersistedAppState`.  Each top-level key is a state
 * category (canvas, media, strokes, …).  To add a new category:
 *   1. Add it to `PersistedAppState` in `src/shared/types/appState.ts`.
 *   2. Add scoped methods below following the canvas pattern.
 *
 * Consumer usage:
 *   appStateManager.addNode(node);            // canvas category
 *   appStateManager.updateNode(path, partial);
 *   appStateManager.removeNode(path);
 *   appStateManager.updateViewport(v);
 */
export class AppStateManager {
    private readonly travels = createTravels<PersistedAppState>(
        structuredClone(DEFAULT_APP_STATE)
    );
    private readonly messageClient: MessageClient;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly DEBOUNCE_MS = 500;

    constructor(messageClient: MessageClient) {
        this.messageClient = messageClient;
        this.travels.subscribe(() => this.scheduleSave());
    }

    private scheduleSave(): void {
        if (this.saveTimer) { clearTimeout(this.saveTimer); }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.messageClient.send('saveAppState', { state: this.travels.getState() });
        }, AppStateManager.DEBOUNCE_MS);
    }

    /** Returns the current application state snapshot. */
    public getState(): PersistedAppState {
        return this.travels.getState();
    }

    // -------------------------------------------------------------------------
    // Canvas — node operations
    // -------------------------------------------------------------------------

    /** Registers a new canvas node, or replaces an existing one by filePath. */
    public addNode(node: PersistedNodeState): void {
        this.travels.setState(draft => {
            const idx = draft.canvas.nodes.findIndex(n => n.filePath === node.filePath);
            if (idx >= 0) {
                draft.canvas.nodes[idx] = node;
            } else {
                draft.canvas.nodes.push(node);
            }
        });
    }

    /** Partially updates an existing canvas node (position, size, zIndex). */
    public updateNode(
        filePath: string,
        partial: Partial<Omit<PersistedNodeState, 'filePath' | 'uri'>>
    ): void {
        this.travels.setState(draft => {
            const node = draft.canvas.nodes.find(n => n.filePath === filePath);
            if (node) { Object.assign(node, partial); }
        });
    }

    /** Removes a canvas node by filePath. */
    public removeNode(filePath: string): void {
        this.travels.setState(draft => {
            const idx = draft.canvas.nodes.findIndex(n => n.filePath === filePath);
            if (idx !== -1) { draft.canvas.nodes.splice(idx, 1); }
        });
    }

    // -------------------------------------------------------------------------
    // Canvas — viewport
    // -------------------------------------------------------------------------

    /** Updates the persisted viewport pan/zoom state. */
    public updateViewport(viewport: PersistedViewportState): void {
        this.travels.setState(draft => {
            draft.canvas.viewport = viewport;
        });
    }
}
