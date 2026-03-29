export interface Message {
    command: string;
    payload?: any;
}

/**
 * Layout hint attached to an `openFile` message when restoring a node from
 * a persisted session.  When present, CanvasManager uses these values instead
 * of calculating a new position/size.
 */
export interface PersistedLayoutHint {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
}
