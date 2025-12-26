/**
 * Shared configuration for Monaco Editor workers and language mappings.
 * This is used by both the backend (to provide URIs) and the frontend (to load workers).
 */

export const MONACO_WORKER_FILES = {
    json: 'json.worker.js',
    css: 'css.worker.js',
    html: 'html.worker.js',
    typescript: 'ts.worker.js',
    editor: 'editor.worker.js'
} as const;

export type MonacoWorkerKey = keyof typeof MONACO_WORKER_FILES;

/**
 * Maps Monaco language labels to their corresponding worker keys.
 * Languages not listed here will default to the 'editor' worker.
 */
export const LANGUAGE_WORKER_MAP: Record<string, MonacoWorkerKey> = {
    json: 'json',
    css: 'css',
    scss: 'css',
    less: 'css',
    html: 'html',
    handlebars: 'html',
    razor: 'html',
    typescript: 'typescript',
    javascript: 'typescript',
};

/**
 * Maps common file extensions to Monaco language IDs.
 */
export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
    // TypeScript / JavaScript
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Web
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'json',

    // Markdown / Docs
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',

    // Languages (Basic support via editor worker)
    py: 'python',
    rb: 'ruby',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rs: 'rust',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
};

/**
 * Gets the Monaco language ID for a given file name or path.
 */
export function getLanguageForFile(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_LANGUAGE_MAP[extension] || 'plaintext';
}

/**
 * Checks if a language requires a specific worker.
 * Returns the worker key if a specific worker is needed, or 'editor' otherwise.
 */
export function getWorkerKeyForLanguage(languageId: string): MonacoWorkerKey {
    return LANGUAGE_WORKER_MAP[languageId] || 'editor';
}
