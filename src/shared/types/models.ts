export interface NodeData {
    id: string;
    type: 'editor' | 'note' | 'media';
    x: number;
    y: number;
    width: number;
    height: number;
    content: any;
}

/**
 * Layout information for persisting/restoring node arrangements
 */
export interface NodeLayoutInfo {
    filePath: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
}

/**
 * Complete canvas state for persistence
 */
export interface CanvasLayoutState {
    nodes: NodeLayoutInfo[];
    viewport: {
        panX: number;
        panY: number;
        zoom: number;
    };
    version: number;
}
