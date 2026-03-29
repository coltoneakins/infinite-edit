/**
 * Persisted state for a single editor node on the canvas.
 * To add new node types, extend PersistedNodeState or create a union type
 * and add a corresponding array to PersistedCanvasState.
 */
export interface PersistedNodeState {
    filePath: string;
    uri: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
}

/** Persisted viewport (pan/zoom) state. */
export interface PersistedViewportState {
    panX: number;
    panY: number;
    /** Zoom level in Travels' exponential scale (not raw CSS scale). */
    zoom: number;
}

/** State for the canvas layer — nodes and viewport. */
export interface PersistedCanvasState {
    nodes: PersistedNodeState[];
    viewport: PersistedViewportState;
}

export const DEFAULT_CANVAS_STATE: PersistedCanvasState = {
    nodes: [],
    viewport: { panX: 0, panY: 0, zoom: 0 }
};
