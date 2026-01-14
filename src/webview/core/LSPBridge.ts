import * as monaco from 'monaco-editor';
import { MessageClient } from './MessageClient';

export class LSPBridge {
    private messageClient: MessageClient;

    constructor(messageClient: MessageClient) {
        this.messageClient = messageClient;
        this.registerProviders();
    }

    private registerProviders() {
        // Definition Provider
        monaco.languages.registerDefinitionProvider('*', {
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

                if (!result) {
                    return null;
                }

                // Transform VS Code Location to Monaco Location
                if (Array.isArray(result)) {
                    return result.map(loc => this.transformLocation(loc));
                }
                return this.transformLocation(result);
            }
        });

        // Hover Provider
        monaco.languages.registerHoverProvider('*', {
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
                    range: result.range
                };
            }
        });

        // Completion Provider
        monaco.languages.registerCompletionItemProvider('*', {
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

                // result is vscode.CompletionList or vscode.CompletionItem[]
                const items = Array.isArray(result) ? result : result.items;

                return {
                    suggestions: items.map((item: any) => ({
                        label: typeof item.label === 'string' ? item.label : item.label.label,
                        kind: item.kind,
                        detail: item.detail,
                        documentation: item.documentation,
                        insertText: (typeof item.insertText === 'string' ? item.insertText : item.insertText?.value) || (typeof item.label === 'string' ? item.label : item.label.label),
                        range: item.range ? {
                            startLineNumber: item.range.start.line + 1,
                            startColumn: item.range.start.character + 1,
                            endLineNumber: item.range.end.line + 1,
                            endColumn: item.range.end.character + 1
                        } : undefined
                    })) as monaco.languages.CompletionItem[]
                };
            }
        });
    }

    private transformLocation(loc: any): monaco.languages.Location {
        // VS Code Location has uri and range
        // Monaco Location has uri and range
        return {
            uri: monaco.Uri.parse(loc.uri.external || loc.uri),
            range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1
            }
        };
    }
}
