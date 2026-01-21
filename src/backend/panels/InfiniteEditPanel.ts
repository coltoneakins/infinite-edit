import * as vscode from 'vscode';
import { MessageBus } from '../services/MessageBus';
import { MONACO_WORKER_FILES } from '../../shared/MonacoConfig';
import { InfiniteFileSystemProvider } from '../providers/FileSystemProvider';

export class InfiniteEditPanel {
    public static currentPanel: InfiniteEditPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _fileSystemProvider: InfiniteFileSystemProvider;
    private _disposables: vscode.Disposable[] = [];
    private _isReady: boolean = false;
    private _pendingMessages: any[] = [];

    private readonly _messageBus: MessageBus = new MessageBus();

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileSystemProvider: InfiniteFileSystemProvider) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._fileSystemProvider = fileSystemProvider;
        this._messageBus.setWebview(this._panel.webview);

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Register Message Handlers
        this.registerMessageHandlers();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => this._messageBus.handleMessage(message),
            null,
            this._disposables
        );
    }

    private registerMessageHandlers() {
        this._messageBus.register('alert', (message) => {
            vscode.window.showErrorMessage(message.text);
        });

        this._messageBus.register('ready', () => {
            this._isReady = true;
            this._pendingMessages.forEach(msg => this._panel.webview.postMessage(msg));
            this._pendingMessages = [];
        });

        this._messageBus.register('saveFile', async (message) => {
            try {
                const uri = vscode.Uri.file(message.file);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(message.content));
                vscode.window.showInformationMessage(`Saved ${message.file}`);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to save ${message.file}: ${e}`);
            }
        });

        this._messageBus.register('findFiles', async (message) => {
            const query = message.query;
            if (!query) { return []; }

            // Search for files matching the query
            // We use a glob pattern that matches the query anywhere in the path
            const pattern = `**/*${query.split('').join('*')}*`; // poor man's fuzzy search, or just `**/*${query}*`
            // Let's stick to a simpler inclusion for now to avoid performance issues with massive expansion
            // const glob = `**/*${query}*`; 
            // VS Code "Quick Open" is sophisticated. Let's do a simple glob search for now 
            // and maybe filter manually if needed.
            // Actually, findFiles takes (include, exclude, maxResults).
            // Let's use `**/${query}*` matches filenames starting with query in any dir? 
            // or `**/*${query}*` for substring.

            const results = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
            return results.map(uri => ({
                label: uri.path.split('/').pop(),
                detail: vscode.workspace.asRelativePath(uri),
                path: uri.fsPath
            }));
        });

        this._messageBus.register('requestOpenFile', async (message) => {
            try {
                const uri = vscode.Uri.file(message.path);
                const document = await vscode.workspace.openTextDocument(uri);
                this.openFile(document);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to open file: ${message.path}`);
            }
        });

        // Handle text changes from the webview
        this._messageBus.register('updateFile', async (message) => {
            const { file, content } = message;
            // Use the REAL file URI to apply edits, so it shows up in the standard editor
            // and doesn't create a duplicate tab for the 'infinite' scheme.
            const uri = vscode.Uri.file(file);
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                edit.replace(uri, fullRange, content);
                await vscode.workspace.applyEdit(edit);
            } catch (e) {
                console.error('Failed to update file:', e);
            }
        });

        this._messageBus.register('provideDefinition', async (message) => {
            const { file, position } = message;
            const uri = vscode.Uri.file(file);
            const pos = new vscode.Position(position.lineNumber - 1, position.column - 1);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeDefinitionProvider',
                    uri,
                    pos
                );
                return result;
            } catch (e) {
                console.error('Failed to provide definition:', e);
                return null;
            }
        });

        this._messageBus.register('provideHover', async (message) => {
            const { file, position } = message;
            const uri = vscode.Uri.file(file);
            const pos = new vscode.Position(position.lineNumber - 1, position.column - 1);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeHoverProvider',
                    uri,
                    pos
                );
                // executeHoverProvider returns vscode.Hover[]
                return (result && result.length > 0) ? result[0] : null;
            } catch (e) {
                console.error('Failed to provide hover:', e);
                return null;
            }
        });

        this._messageBus.register('provideCompletions', async (message) => {
            const { file, position } = message;
            const uri = vscode.Uri.file(file);
            const pos = new vscode.Position(position.lineNumber - 1, position.column - 1);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeCompletionItemProvider',
                    uri,
                    pos
                );
                // executeCompletionItemProvider returns vscode.CompletionList | vscode.CompletionItem[]
                // In executeCommand it usually returns a single merged result but can be an array in some VS Code versions
                return result;
            } catch (e) {
                console.error('Failed to provide completions:', e);
                return null;
            }
        });

        this._messageBus.register('provideInlayHints', async (message) => {
            const { file, range } = message;
            const uri = vscode.Uri.file(file);
            const vsRange = new vscode.Range(
                new vscode.Position(range.startLineNumber - 1, range.startColumn - 1),
                new vscode.Position(range.endLineNumber - 1, range.endColumn - 1)
            );
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeInlayHintProvider',
                    uri,
                    vsRange
                );
                return result;
            } catch (e) {
                console.error('Failed to provide inlay hints:', e);
                return null;
            }
        });

        this._messageBus.register('provideSignatureHelp', async (message) => {
            const { file, position } = message;
            const uri = vscode.Uri.file(file);
            const pos = new vscode.Position(position.lineNumber - 1, position.column - 1);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeSignatureHelpProvider',
                    uri,
                    pos
                );
                return result;
            } catch (e) {
                console.error('Failed to provide signature help:', e);
                return null;
            }
        });

        this._messageBus.register('provideReferences', async (message) => {
            const { file, position, context } = message;
            const uri = vscode.Uri.file(file);
            const pos = new vscode.Position(position.lineNumber - 1, position.column - 1);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeReferenceProvider',
                    uri,
                    pos
                );
                return result;
            } catch (e) {
                console.error('Failed to provide references:', e);
                return null;
            }
        });

        this._messageBus.register('provideDocumentSymbols', async (message) => {
            const { file } = message;
            const uri = vscode.Uri.file(file);
            try {
                const result = await vscode.commands.executeCommand<any>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );
                return result;
            } catch (e) {
                console.error('Failed to provide document symbols:', e);
                return null;
            }
        });

        this._messageBus.register('toggleBreakpoint', async (message) => {
            const { file, line } = message;
            // Use the REAL file URI for breakpoints so they appear in both native and infinite editors
            const uri = vscode.Uri.file(file);
            const breakpoint = vscode.debug.breakpoints.find(b =>
                b instanceof vscode.SourceBreakpoint &&
                b.location.uri.toString() === uri.toString() &&
                b.location.range.start.line === line - 1
            );

            if (breakpoint) {
                vscode.debug.removeBreakpoints([breakpoint]);
            } else {
                const newBreakpoint = new vscode.SourceBreakpoint(
                    new vscode.Location(uri, new vscode.Position(line - 1, 0))
                );
                vscode.debug.addBreakpoints([newBreakpoint]);
            }
        });

        this._messageBus.register('openInNativeEditor', async (message) => {
            const { file } = message;
            const uri = vscode.Uri.file(file);
            await vscode.window.showTextDocument(uri, { preview: false });
        });

        // Forward VS Code document changes to the webview
        vscode.workspace.onDidChangeTextDocument(e => {
            const scheme = e.document.uri.scheme;
            if (scheme === 'infinite' || scheme === 'file') {
                const filePath = scheme === 'file' ? e.document.uri.fsPath : e.document.uri.path;
                this._panel.webview.postMessage({
                    command: 'didChangeTextDocument',
                    file: filePath,
                    content: e.document.getText()
                });

                // If a real file changed, notify the provider to update virtual documents
                if (scheme === 'file') {
                    this._fileSystemProvider.notifyFileChanged(InfiniteFileSystemProvider.getUri(filePath));
                }
            }
        }, null, this._disposables);

        // Forward diagnostics (errors/warnings) to the webview
        vscode.languages.onDidChangeDiagnostics(e => {
            for (const uri of e.uris) {
                const scheme = uri.scheme;
                if (scheme === 'infinite' || scheme === 'file') {
                    const filePath = scheme === 'file' ? uri.fsPath : uri.path;
                    const diagnostics = vscode.languages.getDiagnostics(uri);
                    this._panel.webview.postMessage({
                        command: 'setDiagnostics',
                        file: filePath,
                        diagnostics: diagnostics.map(d => ({
                            message: d.message,
                            severity: this._mapSeverity(d.severity),
                            startLineNumber: d.range.start.line + 1,
                            startColumn: d.range.start.character + 1,
                            endLineNumber: d.range.end.line + 1,
                            endColumn: d.range.end.character + 1
                        }))
                    });
                }
            }
        }, null, this._disposables);

        // Forward breakpoint changes
        vscode.debug.onDidChangeBreakpoints(e => {
            const affectedFiles = new Set<string>();
            [...e.added, ...e.removed, ...e.changed].forEach(b => {
                if (b instanceof vscode.SourceBreakpoint) {
                    const scheme = b.location.uri.scheme;
                    if (scheme === 'infinite' || scheme === 'file') {
                        const filePath = scheme === 'file' ? b.location.uri.fsPath : b.location.uri.path;
                        affectedFiles.add(filePath);
                    }
                }
            });

            for (const filePath of affectedFiles) {
                // Find breakpoints for BOTH URIs (real and virtual) and combine them
                const realUri = vscode.Uri.file(filePath);
                const virtUri = InfiniteFileSystemProvider.getUri(filePath);

                const fileBreakpoints = vscode.debug.breakpoints.filter(b =>
                    b instanceof vscode.SourceBreakpoint &&
                    (b.location.uri.toString() === realUri.toString() ||
                        b.location.uri.toString() === virtUri.toString())
                ).map(b => (b as vscode.SourceBreakpoint).location.range.start.line + 1);

                // Use a Set to unique lines in case there are identical breakpoints on both URIs
                const uniqueLines = Array.from(new Set(fileBreakpoints));

                this._panel.webview.postMessage({
                    command: 'setBreakpoints',
                    file: filePath,
                    breakpoints: uniqueLines
                });
            }
        }, null, this._disposables);
    }

    private _mapSeverity(severity: vscode.DiagnosticSeverity): number {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error: return 8; // monaco.MarkerSeverity.Error
            case vscode.DiagnosticSeverity.Warning: return 4; // monaco.MarkerSeverity.Warning
            case vscode.DiagnosticSeverity.Information: return 2; // monaco.MarkerSeverity.Info
            case vscode.DiagnosticSeverity.Hint: return 1; // monaco.MarkerSeverity.Hint
            default: return 1;
        }
    }


    private _getHtmlForWebview(webview: vscode.Webview) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const devServerUrl = 'http://localhost:3000';

        // Helper to get local path to a script or worker
        const getResourceUri = (fileName: string) => isDevelopment
            ? `${devServerUrl}/${fileName}`
            : webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', fileName)).toString();

        const scriptUri = getResourceUri('webview.js');
        const styleUri = getResourceUri('main.css');

        // Generate worker URIs from shared config
        const workerUris: Record<string, string> = {};
        for (const [key, fileName] of Object.entries(MONACO_WORKER_FILES)) {
            workerUris[key] = getResourceUri(fileName);
        }

        // SECURITY: Use a nonce to only allow scripts from this extension to be run.
        const nonce = this._getNonce();
        // Monaco Editor requires 'unsafe-inline' for dynamic styles, data: for fonts, and blob: for workers
        // In development, we also need to allow the dev server
        const cspSource = `default-src 'none'; 
            script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource} ${isDevelopment ? devServerUrl : ''}; 
            style-src ${webview.cspSource} 'unsafe-inline' ${isDevelopment ? devServerUrl : ''}; 
            img-src ${webview.cspSource} data: ${isDevelopment ? devServerUrl : ''}; 
            font-src ${webview.cspSource} data: ${isDevelopment ? devServerUrl : ''};
            connect-src ${isDevelopment ? `${devServerUrl} ws://${devServerUrl.replace('http://', '')} blob:` : 'blob:'};
            worker-src blob: ${isDevelopment ? devServerUrl : ''};`.replace(/\s+/g, ' ').trim();

        return `<!DOCTYPE html>
			<html lang="en">
			    <head>
				    <meta charset="UTF-8">
				    <meta name="viewport" content="width=device-width, initial-scale=1.0">
				    <meta http-equiv="Content-Security-Policy" content="${cspSource}">
				    <title>Infinite Edit</title>
				    <link rel="icon" type="image/png" href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png'))}" />
                    <link rel="stylesheet" type="text/css" href="${styleUri}">
			    </head>
			    <body>
			    <div id="canvas-container"></div>
                    <script nonce="${nonce}">
                        window.MONACO_WORKERS = ${JSON.stringify(workerUris)};
                    </script>
				    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
			    </body>
			</html>`;
    }


    public static createOrShow(extensionUri: vscode.Uri, fileSystemProvider: InfiniteFileSystemProvider) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (InfiniteEditPanel.currentPanel) {
            InfiniteEditPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        console.log('Creating new panel');
        const panel = vscode.window.createWebviewPanel(
            'infiniteEdit',
            'Infinite Edit',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'assets')
                ],
                retainContextWhenHidden: true
            }
        );

        // Set the icon for the editor tab
        panel.iconPath = vscode.Uri.joinPath(extensionUri, 'assets', 'icon.png');

        InfiniteEditPanel.currentPanel = new InfiniteEditPanel(panel, extensionUri, fileSystemProvider);

        // Pin the panel (do this after creating the panel instance and setting HTML)
        vscode.commands.executeCommand('workbench.action.pinEditor', panel);
    }

    public openFile(document: vscode.TextDocument) {
        const infiniteUri = InfiniteFileSystemProvider.getUri(document.fileName);
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const message = {
            command: 'openFile',
            file: document.fileName,
            uri: infiniteUri.toString(),
            content: document.getText(),
            diagnostics: diagnostics.map(d => ({
                message: d.message,
                severity: this._mapSeverity(d.severity),
                startLineNumber: d.range.start.line + 1,
                startColumn: d.range.start.character + 1,
                endLineNumber: d.range.end.line + 1,
                endColumn: d.range.end.character + 1
            }))
        };

        if (this._isReady) {
            this._panel.webview.postMessage(message);
        } else {
            this._pendingMessages.push(message);
        }

        // Reveal the panel if it's hidden
        this._panel.reveal();
    }

    public dispose() {
        InfiniteEditPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

