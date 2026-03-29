import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { PersistedAppState, DEFAULT_APP_STATE } from '../../shared/types/appState';

/**
 * Persists and restores the full application state as JSON using lowdb.
 * Uses VS Code's `ExtensionContext.storageUri` for workspace-scoped storage.
 *
 * To store a new state category, update `PersistedAppState` in
 * `src/shared/types/appState.ts` — no changes needed here.
 *
 * If no workspace is open (`storageUri` is undefined), persistence is silently
 * skipped.
 */
export class AppPersistenceService {
    private db: Low<PersistedAppState> | null = null;
    private dbReady: Promise<Low<PersistedAppState> | null> | null = null;
    private readonly storageUri: vscode.Uri | undefined;

    constructor(storageUri: vscode.Uri | undefined) {
        this.storageUri = storageUri;
    }

    private initDb(): Promise<Low<PersistedAppState> | null> {
        if (this.dbReady) { return this.dbReady; }
        this.dbReady = (async () => {
            if (!this.storageUri) {
                console.warn('AppPersistenceService: No storageUri — persistence disabled.');
                return null;
            }
            const dir = this.storageUri.fsPath;
            await fs.promises.mkdir(dir, { recursive: true });
            const filePath = path.join(dir, 'app-state.json');
            const adapter = new JSONFile<PersistedAppState>(filePath);
            const db = new Low(adapter, structuredClone(DEFAULT_APP_STATE));
            await db.read();
            this.db = db;
            return db;
        })();
        return this.dbReady;
    }

    /**
     * Returns the last saved application state, or `null` if no prior session
     * exists (i.e. the canvas has never had any open editors).
     */
    public async load(): Promise<PersistedAppState | null> {
        const db = await this.initDb();
        if (!db || !db.data) { return null; }
        // Treat as "no prior session" when the canvas is empty.  Update this
        // check to also include other categories once they exist.
        if (db.data.canvas.nodes.length === 0) { return null; }
        return db.data;
    }

    /** Atomically persists the full application state to disk. */
    public async save(state: PersistedAppState): Promise<void> {
        const db = await this.initDb();
        if (!db) { return; }
        db.data = state;
        await db.write();
    }

    /** Resets persisted state to the default (blank slate). */
    public async clear(): Promise<void> {
        await this.save(structuredClone(DEFAULT_APP_STATE));
    }
}
