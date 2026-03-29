import { PersistedCanvasState, DEFAULT_CANVAS_STATE } from './canvasState';

/**
 * Root persisted application state.
 *
 * Each feature area owns one top-level key.  To add a new category:
 *   1. Define a `PersistedXxxState` interface (and DEFAULT) in a new
 *      `src/shared/types/xxxState.ts` file.
 *   2. Import it here and add `xxx: PersistedXxxState`.
 *   3. Add it to `DEFAULT_APP_STATE`.
 *   4. Add scoped helper methods to `AppStateManager` in
 *      `src/webview/core/AppStateManager.ts`.
 *
 * Increment `version` when the schema changes to allow forward-migration.
 */
export interface PersistedAppState {
    version: number;
    canvas: PersistedCanvasState;
    // Future categories — uncomment / add as the app grows:
    // media: PersistedMediaState;
    // strokes: PersistedStrokesState;
    // notes: PersistedNotesState;
}

export const DEFAULT_APP_STATE: PersistedAppState = {
    version: 1,
    canvas: structuredClone(DEFAULT_CANVAS_STATE)
};
