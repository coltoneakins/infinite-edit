import * as vscode from 'vscode';

export class LSPProvider {
    public static register(context: vscode.ExtensionContext) {
        const selector = { scheme: 'infinite' };

        context.subscriptions.push(
            vscode.languages.registerDefinitionProvider(selector, {
                provideDefinition: (document, position, token) => {
                    return this.delegate('vscode.executeDefinitionProvider', document, position) as Thenable<vscode.Definition | vscode.LocationLink[]>;
                }
            }),
            vscode.languages.registerHoverProvider(selector, {
                provideHover: async (document, position, token) => {
                    const result = await this.delegate('vscode.executeHoverProvider', document, position) as vscode.Hover[];
                    return result && result.length > 0 ? result[0] : undefined;
                }
            }),
            vscode.languages.registerCompletionItemProvider(selector, {
                provideCompletionItems: (document, position, token, context) => {
                    return this.delegate('vscode.executeCompletionItemProvider', document, position) as Thenable<vscode.CompletionList>;
                }
            }),
            vscode.languages.registerReferenceProvider(selector, {
                provideReferences: (document, position, context, token) => {
                    return this.delegate('vscode.executeReferenceProvider', document, position) as Thenable<vscode.Location[]>;
                }
            }),
            vscode.languages.registerDocumentSymbolProvider(selector, {
                provideDocumentSymbols: (document, token) => {
                    const realUri = this.mapToRealUri(document.uri);
                    return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', realUri) as Thenable<vscode.DocumentSymbol[]>;
                }
            })
        );
    }

    private static async delegate(command: string, document: vscode.TextDocument, position: vscode.Position) {
        const realUri = this.mapToRealUri(document.uri);
        try {
            return await vscode.commands.executeCommand(command, realUri, position);
        } catch (e) {
            console.error(`LSPProvider: Failed to delegate ${command}:`, e);
            return null;
        }
    }

    private static mapToRealUri(uri: vscode.Uri): vscode.Uri {
        return vscode.Uri.file(uri.path);
    }
}
