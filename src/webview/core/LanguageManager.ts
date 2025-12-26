import * as monaco from 'monaco-editor';
import {
    getLanguageForFile,
    getWorkerKeyForLanguage,
    LANGUAGE_WORKER_MAP,
    MonacoWorkerKey
} from '../../shared/MonacoConfig';

/**
 * Utility to manage Monaco language detection and worker configuration.
 */
export class LanguageManager {

    /**
     * Look up the language for a file and ensure the worker configuration is ready.
     * 
     * @param filePath The path or name of the file being opened.
     * @returns The detected Monaco language ID.
     */
    public static prepareLanguageForFile(filePath: string): string {
        const languageId = getLanguageForFile(filePath);
        const workerKey = getWorkerKeyForLanguage(languageId);

        // Ensure the mapping exists in the runtime config if it's missing
        // This addresses the "add it to the config" requirement.
        if (!LANGUAGE_WORKER_MAP[languageId]) {
            console.log(`[LanguageManager] Registering dynamic worker mapping: ${languageId} -> ${workerKey}`);
            LANGUAGE_WORKER_MAP[languageId] = workerKey;
        }

        return languageId;
    }

    /**
     * Helper to set a model's language while ensuring workers are configured.
     */
    public static setModelLanguageAndWorker(model: monaco.editor.ITextModel, filePath: string): void {
        const languageId = this.prepareLanguageForFile(filePath);
        monaco.editor.setModelLanguage(model, languageId);
    }
}
