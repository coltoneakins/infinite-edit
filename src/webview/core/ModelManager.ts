import * as monaco from 'monaco-editor';
import { LanguageManager } from './LanguageManager';
import { MessageClient } from './MessageClient';

/**
 * Represents a reference to a Monaco model with lifecycle management.
 * Disposing the reference decrements the reference count.
 * The underlying model is disposed when all references are released.
 */
export interface IModelReference {
    /** The underlying Monaco text model */
    readonly model: monaco.editor.ITextModel;
    /** The URI of the model */
    readonly uri: monaco.Uri;
    /** Whether the model has unsaved changes */
    readonly isDirty: boolean;
    /** Save the model content to the backend */
    save(): Promise<void>;
    /** Dispose this reference (decrements ref count) */
    dispose(): void;
}

/**
 * Internal tracking data for a managed model.
 */
interface ManagedModel {
    model: monaco.editor.ITextModel;
    uri: monaco.Uri;
    refCount: number;
    isDirty: boolean;
    originalContent: string;
    disposables: monaco.IDisposable[];
    /** Whether this is a temporary model (e.g., for peek view) that should auto-dispose faster */
    isTemporary: boolean;
    /** Timeout handle for temporary model cleanup */
    cleanupTimeout?: ReturnType<typeof setTimeout>;
}

/**
 * ModelManager provides centralized management of Monaco editor models with:
 * - Reference counting for proper lifecycle management
 * - Dirty state tracking
 * - Coordinated saves across multiple editors viewing the same file
 * - Automatic disposal when no references remain
 * - Support for temporary models (e.g., for peek views)
 */
export class ModelManager {
    private static instance: ModelManager | null = null;
    private models: Map<string, ManagedModel> = new Map();
    private messageClient: MessageClient;

    /** Time in ms before temporary models are cleaned up after last reference is released */
    private static readonly TEMP_MODEL_CLEANUP_DELAY = 30000; // 30 seconds

    private constructor(messageClient: MessageClient) {
        this.messageClient = messageClient;
    }

    /**
     * Initialize the ModelManager singleton.
     * Must be called once before using getInstance().
     */
    public static initialize(messageClient: MessageClient): ModelManager {
        if (ModelManager.instance) {
            console.warn('ModelManager already initialized');
            return ModelManager.instance;
        }
        ModelManager.instance = new ModelManager(messageClient);
        return ModelManager.instance;
    }

    /**
     * Get the ModelManager singleton instance.
     * @throws Error if not initialized
     */
    public static getInstance(): ModelManager {
        if (!ModelManager.instance) {
            throw new Error('ModelManager not initialized. Call ModelManager.initialize() first.');
        }
        return ModelManager.instance;
    }

    /**
     * Get or create a model reference for the given URI.
     * If the model doesn't exist, it will be created with the provided content.
     * If it exists, a new reference to the existing model is returned.
     *
     * @param uri The URI for the model (should use infinite:// scheme)
     * @param content The initial content (only used if model doesn't exist)
     * @param filePath The file path for language detection
     * @returns A model reference that must be disposed when no longer needed
     */
    public getOrCreateModelReference(
        uri: string | monaco.Uri,
        content: string,
        filePath: string
    ): IModelReference {
        const monacoUri = typeof uri === 'string' ? monaco.Uri.parse(uri) : uri;
        const key = monacoUri.toString();

        let managed = this.models.get(key);

        if (managed) {
            // Clear any pending cleanup timeout
            if (managed.cleanupTimeout) {
                clearTimeout(managed.cleanupTimeout);
                managed.cleanupTimeout = undefined;
            }
            // Mark as non-temporary if being used by an editor
            managed.isTemporary = false;
            managed.refCount++;
        } else {
            // Check if Monaco already has this model (from previous session or LSPBridge)
            let model = monaco.editor.getModel(monacoUri);

            if (!model) {
                const language = LanguageManager.prepareLanguageForFile(filePath);
                model = monaco.editor.createModel(content, language, monacoUri);
            }

            const disposables: monaco.IDisposable[] = [];

            managed = {
                model,
                uri: monacoUri,
                refCount: 1,
                isDirty: false,
                originalContent: content,
                disposables,
                isTemporary: false
            };

            // Track content changes for dirty state
            disposables.push(
                model.onDidChangeContent(() => {
                    const currentContent = model!.getValue();
                    managed!.isDirty = currentContent !== managed!.originalContent;
                    this.emitDirtyStateChanged(key, managed!.isDirty);
                })
            );

            this.models.set(key, managed);
        }

        return this.createReference(managed);
    }

    /**
     * Get or create a temporary model reference for peek views, references, etc.
     * Temporary models are automatically cleaned up after a delay when all references are released.
     *
     * @param uri The URI for the model
     * @param filePath The file path for language detection and content fetching
     * @returns A model reference, or null if content couldn't be fetched
     */
    public async getOrCreateTemporaryModelReference(
        uri: string | monaco.Uri,
        filePath: string
    ): Promise<IModelReference | null> {
        const monacoUri = typeof uri === 'string' ? monaco.Uri.parse(uri) : uri;
        const key = monacoUri.toString();

        let managed = this.models.get(key);

        if (managed) {
            // Clear any pending cleanup timeout
            if (managed.cleanupTimeout) {
                clearTimeout(managed.cleanupTimeout);
                managed.cleanupTimeout = undefined;
            }
            managed.refCount++;
            return this.createReference(managed);
        }

        // Check if Monaco already has this model
        let model = monaco.editor.getModel(monacoUri);

        if (!model) {
            // Fetch content from backend
            try {
                const content = await this.messageClient.sendRequest('getFileContent', {
                    file: filePath
                });

                if (content === null || content === undefined) {
                    return null;
                }

                const language = LanguageManager.prepareLanguageForFile(filePath);
                model = monaco.editor.createModel(content, language, monacoUri);
            } catch (e) {
                console.warn(`Failed to create temporary model for ${filePath}:`, e);
                return null;
            }
        }

        const disposables: monaco.IDisposable[] = [];

        managed = {
            model,
            uri: monacoUri,
            refCount: 1,
            isDirty: false,
            originalContent: model.getValue(),
            disposables,
            isTemporary: true
        };

        // Track content changes for dirty state (even temporary models can be edited in peek view)
        disposables.push(
            model.onDidChangeContent(() => {
                const currentContent = model!.getValue();
                managed!.isDirty = currentContent !== managed!.originalContent;
            })
        );

        this.models.set(key, managed);
        return this.createReference(managed);
    }

    /**
     * Ensure models exist for a list of locations (used by LSPBridge for peek views).
     * Creates temporary model references that will be cleaned up automatically.
     *
     * @param locations Array of locations that need models
     */
    public async ensureModelsForLocations(locations: monaco.languages.Location[]): Promise<void> {
        const uniqueUris = new Map<string, monaco.Uri>();

        for (const loc of locations) {
            const uriStr = loc.uri.toString();
            if (!uniqueUris.has(uriStr) && !this.models.has(uriStr) && !monaco.editor.getModel(loc.uri)) {
                uniqueUris.set(uriStr, loc.uri);
            }
        }

        const promises: Promise<void>[] = [];

        for (const [, uri] of uniqueUris) {
            promises.push(
                this.getOrCreateTemporaryModelReference(uri, uri.path).then(ref => {
                    // Immediately release the reference - the model will persist
                    // due to the cleanup delay, allowing Monaco to use it for peek views
                    if (ref) {
                        ref.dispose();
                    }
                })
            );
        }

        await Promise.all(promises);
    }

    /**
     * Update the content of a model from an external source (e.g., file watcher).
     * This resets the dirty state if the new content matches the original.
     *
     * @param uri The model URI
     * @param content The new content
     */
    public updateModelContent(uri: string | monaco.Uri | undefined, content: string): void {
        if (!uri) {
            console.warn('updateModelContent called with undefined uri');
            return;
        }
        const monacoUri = typeof uri === 'string' ? monaco.Uri.parse(uri) : uri;
        const key = monacoUri.toString();
        const managed = this.models.get(key);

        if (managed) {
            const currentValue = managed.model.getValue();
            if (currentValue !== content) {
                // Use pushEditOperations to preserve undo stack where possible
                managed.model.setValue(content);
            }
            // Update original content since this came from the backend
            managed.originalContent = content;
            managed.isDirty = false;
            this.emitDirtyStateChanged(key, false);
        }
    }

    /**
     * Mark a model as saved (resets dirty state and updates original content).
     * Called after a successful save operation.
     *
     * @param uri The model URI
     */
    public markModelSaved(uri: string | monaco.Uri): void {
        const monacoUri = typeof uri === 'string' ? monaco.Uri.parse(uri) : uri;
        const key = monacoUri.toString();
        const managed = this.models.get(key);

        if (managed) {
            managed.originalContent = managed.model.getValue();
            managed.isDirty = false;
            this.emitDirtyStateChanged(key, false);
        }
    }

    /**
     * Get the current dirty state for a model.
     *
     * @param uri The model URI
     * @returns true if dirty, false if clean or model not found
     */
    public isDirty(uri: string | monaco.Uri): boolean {
        const monacoUri = typeof uri === 'string' ? monaco.Uri.parse(uri) : uri;
        const key = monacoUri.toString();
        const managed = this.models.get(key);
        return managed?.isDirty ?? false;
    }

    /**
     * Get all dirty models.
     *
     * @returns Array of URIs for models with unsaved changes
     */
    public getDirtyModels(): monaco.Uri[] {
        const dirty: monaco.Uri[] = [];
        for (const managed of this.models.values()) {
            if (managed.isDirty && !managed.isTemporary) {
                dirty.push(managed.uri);
            }
        }
        return dirty;
    }

    /**
     * Check if any models have unsaved changes.
     */
    public hasUnsavedChanges(): boolean {
        for (const managed of this.models.values()) {
            if (managed.isDirty && !managed.isTemporary) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get statistics about managed models.
     */
    public getStats(): { total: number; temporary: number; dirty: number; totalRefs: number } {
        let temporary = 0;
        let dirty = 0;
        let totalRefs = 0;

        for (const managed of this.models.values()) {
            if (managed.isTemporary) temporary++;
            if (managed.isDirty) dirty++;
            totalRefs += managed.refCount;
        }

        return {
            total: this.models.size,
            temporary,
            dirty,
            totalRefs
        };
    }

    /**
     * Create a reference wrapper for a managed model.
     */
    private createReference(managed: ManagedModel): IModelReference {
        let disposed = false;

        const ref: IModelReference = {
            get model() {
                if (disposed) {
                    throw new Error('ModelReference has been disposed');
                }
                return managed.model;
            },
            get uri() {
                return managed.uri;
            },
            get isDirty() {
                return managed.isDirty;
            },
            save: async () => {
                if (disposed) {
                    throw new Error('ModelReference has been disposed');
                }
                await this.saveModel(managed);
            },
            dispose: () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                this.releaseReference(managed);
            }
        };

        return ref;
    }

    /**
     * Save a model's content to the backend.
     */
    private async saveModel(managed: ManagedModel): Promise<void> {
        const content = managed.model.getValue();
        const filePath = managed.uri.path;

        await this.messageClient.sendRequest('saveFile', {
            file: filePath,
            content: content
        });

        // Mark as saved
        managed.originalContent = content;
        managed.isDirty = false;
        this.emitDirtyStateChanged(managed.uri.toString(), false);
    }

    /**
     * Release a reference to a managed model.
     * Disposes the model if no references remain.
     */
    private releaseReference(managed: ManagedModel): void {
        managed.refCount--;

        if (managed.refCount <= 0) {
            const key = managed.uri.toString();

            if (managed.isTemporary) {
                // Schedule cleanup for temporary models
                managed.cleanupTimeout = setTimeout(() => {
                    this.disposeModel(key);
                }, ModelManager.TEMP_MODEL_CLEANUP_DELAY);
            } else {
                // Non-temporary models are disposed immediately when refCount hits 0
                this.disposeModel(key);
            }
        }
    }

    /**
     * Dispose a model and clean up resources.
     */
    private disposeModel(key: string): void {
        const managed = this.models.get(key);
        if (!managed) {
            return;
        }

        // Clear any pending cleanup timeout
        if (managed.cleanupTimeout) {
            clearTimeout(managed.cleanupTimeout);
        }

        // Dispose all subscriptions
        for (const disposable of managed.disposables) {
            disposable.dispose();
        }

        // Dispose the model
        managed.model.dispose();

        // Remove from tracking
        this.models.delete(key);
    }

    /**
     * Force dispose all models (e.g., on shutdown).
     */
    public disposeAll(): void {
        for (const key of this.models.keys()) {
            this.disposeModel(key);
        }
    }

    // Event handling for dirty state changes
    private dirtyStateListeners: ((uri: string, isDirty: boolean) => void)[] = [];

    /**
     * Subscribe to dirty state changes.
     *
     * @param listener Callback when dirty state changes
     * @returns Disposable to unsubscribe
     */
    public onDirtyStateChanged(listener: (uri: string, isDirty: boolean) => void): monaco.IDisposable {
        this.dirtyStateListeners.push(listener);
        return {
            dispose: () => {
                const index = this.dirtyStateListeners.indexOf(listener);
                if (index !== -1) {
                    this.dirtyStateListeners.splice(index, 1);
                }
            }
        };
    }

    private emitDirtyStateChanged(uri: string, isDirty: boolean): void {
        for (const listener of this.dirtyStateListeners) {
            try {
                listener(uri, isDirty);
            } catch (e) {
                console.error('Error in dirty state listener:', e);
            }
        }
    }
}
