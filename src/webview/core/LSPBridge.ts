import * as monaco from 'monaco-editor';
import { MessageClient } from './MessageClient';
import { ModelManager } from './ModelManager';

export class LSPBridge {
    private messageClient: MessageClient;

    constructor(messageClient: MessageClient) {
        this.messageClient = messageClient;
        this.registerProviders();
        this.registerEditorOpener();
    }

    /**
     * Register a global editor opener to handle "Go to Definition" and similar navigation.
     * This is the correct way to intercept editor open operations in standalone Monaco.
     * The editorService.openCodeEditor approach doesn't work reliably in standalone mode.
     */
    private registerEditorOpener() {
        monaco.editor.registerEditorOpener({
            openCodeEditor: (source, resource, selectionOrPosition) => {
                // Get the source editor's model URI to check if it's the same file
                const sourceModel = source.getModel();
                if (sourceModel && sourceModel.uri.toString() === resource.toString()) {
                    // Same file - let Monaco handle internal navigation
                    return false;
                }

                // Different file - request backend to open it
                let selection: any = undefined;
                if (selectionOrPosition) {
                    if ('startLineNumber' in selectionOrPosition) {
                        // It's a range
                        selection = selectionOrPosition;
                    } else if ('lineNumber' in selectionOrPosition) {
                        // It's a position - convert to range
                        selection = {
                            startLineNumber: selectionOrPosition.lineNumber,
                            startColumn: selectionOrPosition.column,
                            endLineNumber: selectionOrPosition.lineNumber,
                            endColumn: selectionOrPosition.column
                        };
                    }
                }

                this.messageClient.send('requestOpenFile', {
                    path: resource.path,
                    selection: selection
                });

                return true; // We handled the request
            }
        });
    }

    private registerProviders() {
        // Disable built-in Monaco providers for languages we are bridging
        // This prevents duplicate results (e.g., from the TS worker and VS Code host)
        this.disableBuiltinProviders();

        const selector = '*';

        // Definition Provider
        monaco.languages.registerDefinitionProvider(selector, {
            provideDefinition: async (model, position) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideDefinition', {
                    file: model.uri.path,
                    position: {
                        lineNumber: position.lineNumber,
                        column: position.column
                    }
                });

                if (!result) return null;

                const locations = Array.isArray(result)
                    ? result.map(loc => this.transformLocation(loc))
                    : [this.transformLocation(result)];

                // Ensure models exist so Monaco can navigate to them
                await this.ensureModelsForLocations(locations);

                return Array.isArray(result) ? locations : locations[0];
            }
        });

        // Hover Provider
        monaco.languages.registerHoverProvider(selector, {
            provideHover: async (model, position) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideHover', {
                    file: model.uri.path,
                    position: {
                        lineNumber: position.lineNumber,
                        column: position.column
                    }
                });

                if (!result) {
                    return null;
                }

                return {
                    contents: result.contents.map((c: any) => ({ value: typeof c === 'string' ? c : c.value })),
                    range: result.range ? this.transformRange(result.range) : undefined
                };
            }
        });

        // Completion Provider
        monaco.languages.registerCompletionItemProvider(selector, {
            provideCompletionItems: async (model, position) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideCompletions', {
                    file: model.uri.path,
                    position: {
                        lineNumber: position.lineNumber,
                        column: position.column
                    }
                });

                if (!result) {
                    return null;
                }

                let items: any[] = [];
                if (Array.isArray(result)) {
                    if (result.length > 0 && (result[0].items || result[0].suggestions)) {
                        result.forEach(list => {
                            items = items.concat(list.items || list.suggestions || []);
                        });
                    } else {
                        items = result;
                    }
                } else if (result.items) {
                    items = result.items;
                } else if (result.suggestions) {
                    items = result.suggestions;
                }

                return {
                    suggestions: items.map((item: any) => ({
                        label: typeof item.label === 'string' ? item.label : item.label.label,
                        kind: item.kind,
                        detail: item.detail,
                        documentation: item.documentation,
                        insertText: item.insertText?.value || item.insertText || (typeof item.label === 'string' ? item.label : item.label.label),
                        range: item.range ? this.transformRange(item.range) : undefined,
                        sortText: item.sortText,
                        filterText: item.filterText,
                        insertTextRules: item.insertTextRules,
                        additionalTextEdits: item.additionalTextEdits?.map((e: any) => ({
                            range: this.transformRange(e.range),
                            text: e.newText || e.text
                        }))
                    })) as monaco.languages.CompletionItem[]
                };
            }
        });

        // Inlay Hints Provider
        monaco.languages.registerInlayHintsProvider(selector, {
            provideInlayHints: async (model, range) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideInlayHints', {
                    file: model.uri.path,
                    range: {
                        startLineNumber: range.startLineNumber,
                        startColumn: range.startColumn,
                        endLineNumber: range.endLineNumber,
                        endColumn: range.endColumn
                    }
                });

                if (!result || !Array.isArray(result)) {
                    return null;
                }

                return {
                    hints: result.map((hint: any) => ({
                        label: hint.label,
                        position: {
                            lineNumber: (hint.position.line ?? hint.position.lineNumber ?? 0) + 1,
                            column: (hint.position.character ?? hint.position.column ?? 0) + 1
                        },
                        kind: hint.kind,
                        paddingLeft: hint.paddingLeft,
                        paddingRight: hint.paddingRight
                    })),
                    dispose: () => { }
                };
            }
        });

        // Signature Help Provider
        monaco.languages.registerSignatureHelpProvider(selector, {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: async (model, position) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideSignatureHelp', {
                    file: model.uri.path,
                    position: {
                        lineNumber: position.lineNumber,
                        column: position.column
                    }
                });

                if (!result) {
                    return null;
                }

                return {
                    value: {
                        signatures: result.signatures.map((sig: any) => ({
                            label: sig.label,
                            documentation: sig.documentation,
                            parameters: sig.parameters.map((p: any) => ({
                                label: p.label,
                                documentation: p.documentation
                            }))
                        })),
                        activeSignature: result.activeSignature,
                        activeParameter: result.activeParameter
                    },
                    dispose: () => { }
                };
            }
        });

        // Reference Provider
        monaco.languages.registerReferenceProvider(selector, {
            provideReferences: async (model, position, context) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideReferences', {
                    file: model.uri.path,
                    position: {
                        lineNumber: position.lineNumber,
                        column: position.column
                    },
                    context
                });

                if (!result || !Array.isArray(result)) {
                    return null;
                }

                // Transform locations and ensure models exist for all referenced files
                const locations = result.map((loc: any) => this.transformLocation(loc));

                // Create models for any files that don't have them yet
                // This is needed for Monaco's peek view to display references
                await this.ensureModelsForLocations(locations);

                return locations;
            }
        });

        // Document Symbol Provider
        monaco.languages.registerDocumentSymbolProvider(selector, {
            provideDocumentSymbols: async (model) => {
                if (model.uri.scheme !== 'infinite') {
                    return null;
                }

                const result = await this.messageClient.sendRequest('provideDocumentSymbols', {
                    file: model.uri.path
                });

                if (!result || !Array.isArray(result)) {
                    return null;
                }

                return result.map((sym: any) => this.transformSymbol(sym));
            }
        });
    }

    private disableBuiltinProviders() {
        const disableOptions = {
            definitions: false,
            references: false,
            hovers: false,
            documentSymbols: false,
            completions: false,
            diagnostics: false,
            format: false,
            signatureHelp: false,
            inlayHints: false
        };

        // Smarter way to find all language defaults and disable them
        const langs = monaco.languages as any;
        for (const key in langs) {
            const ext = langs[key];
            if (ext && typeof ext === 'object') {
                for (const subKey in ext) {
                    if (subKey.endsWith('Defaults') && ext[subKey] && typeof ext[subKey].setModeConfiguration === 'function') {
                        try {
                            ext[subKey].setModeConfiguration(disableOptions);
                        } catch (e) {
                            console.warn(`Failed to set mode configuration for ${key}.${subKey}:`, e);
                        }
                    }
                }
            }
        }
    }

    private transformSymbol(sym: any): monaco.languages.DocumentSymbol {
        return {
            name: sym.name,
            detail: sym.detail,
            kind: sym.kind,
            tags: sym.tags || [],
            range: this.transformRange(sym.range),
            selectionRange: this.transformRange(sym.selectionRange),
            children: sym.children ? sym.children.map((c: any) => this.transformSymbol(c)) : undefined
        };
    }

    private transformRange(range: any): monaco.IRange {
        if (!range) {
            return { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 };
        }

        // Handle Monaco Range if already transformed
        if (range.startLineNumber !== undefined) {
            return range;
        }

        // Handle VS Code Range (start/end)
        const start = range.start || range[0] || {};
        const end = range.end || range[1] || {};

        return {
            startLineNumber: (start.line ?? start.lineNumber ?? 0) + 1,
            startColumn: (start.character ?? start.column ?? 0) + 1,
            endLineNumber: (end.line ?? end.lineNumber ?? 0) + 1,
            endColumn: (end.character ?? end.column ?? 0) + 1
        };
    }

    private transformLocation(loc: any): monaco.languages.Location {
        // VS Code Location has uri and range. LocationLink has targetUri and targetRange.
        const uri = loc.uri || loc.targetUri;
        const range = loc.range || loc.targetRange || loc.targetSelectionRange;

        let monacoUri: monaco.Uri;

        if (uri instanceof monaco.Uri) {
            monacoUri = uri;
        } else if (typeof uri === 'string') {
            monacoUri = monaco.Uri.parse(uri);
        } else if (uri && typeof uri === 'object') {
            // Handle serialized VS Code Uri objects
            // These have scheme, path, query, etc. but no methods
            try {
                monacoUri = monaco.Uri.from({
                    scheme: uri.scheme || 'file',
                    authority: uri.authority || '',
                    path: uri.path || '',
                    query: uri.query || '',
                    fragment: uri.fragment || ''
                });
            } catch (e) {
                console.error('Failed to reconstruct URI from object:', uri, e);
                monacoUri = monaco.Uri.parse('');
            }
        } else {
            monacoUri = monaco.Uri.parse('');
        }

        return {
            uri: monacoUri,
            range: this.transformRange(range)
        };
    }


    /**
     * Ensures that Monaco models exist for all files referenced in the locations.
     * This is necessary for Monaco's peek view to display references from other files.
     * Uses ModelManager to create temporary models with automatic cleanup.
     */
    private async ensureModelsForLocations(locations: monaco.languages.Location[]): Promise<void> {
        const modelManager = ModelManager.getInstance();
        await modelManager.ensureModelsForLocations(locations);
    }
}
