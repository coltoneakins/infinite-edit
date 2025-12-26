import * as vscode from 'vscode';
import { MessageBus } from '../services/MessageBus';
import { MONACO_WORKER_FILES } from '../../shared/MonacoConfig';

export class InfiniteEditPanel {
    public static currentPanel: InfiniteEditPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _isReady: boolean = false;
    private _pendingMessages: any[] = [];

    private readonly _messageBus: MessageBus = new MessageBus();

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
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
    }


    private _getHtmlForWebview(webview: vscode.Webview) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const devServerUrl = 'http://localhost:3000';

        // Helper to get local path to a script or worker
        const getResourceUri = (fileName: string) => isDevelopment
            ? `${devServerUrl}/${fileName}`
            : webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', fileName)).toString();

        const scriptUri = getResourceUri('webview.js');

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
            connect-src ${isDevelopment ? `${devServerUrl} ws://${devServerUrl.replace('http://', '')}` : ''};
            worker-src blob: ${isDevelopment ? devServerUrl : ''};`.replace(/\s+/g, ' ').trim();

        return `<!DOCTYPE html>
			<html lang="en">
			    <head>
				    <meta charset="UTF-8">
				    <meta name="viewport" content="width=device-width, initial-scale=1.0">
				    <meta http-equiv="Content-Security-Policy" content="${cspSource}">
				    <title>Infinite Edit</title>
				    <link rel="icon" type="image/png" href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png'))}" />
				    <style>
                        body { margin: 0; padding: 0; overflow: hidden; background-color: #1e1e1e; }
                        #canvas-container { width: 100vw; height: 100vh; }
                        .editor-title-bar { pointer-events: none !important; }
				    </style>
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


    public static createOrShow(extensionUri: vscode.Uri) {
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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
                retainContextWhenHidden: true
            }
        );

        // Set the icon for the editor tab
        panel.iconPath = vscode.Uri.joinPath(extensionUri, 'assets', 'icon.png');

        InfiniteEditPanel.currentPanel = new InfiniteEditPanel(panel, extensionUri);
    }

    public openFile(document: vscode.TextDocument) {
        const message = {
            command: 'openFile',
            file: document.fileName,
            content: document.getText()
        };

        if (this._isReady) {
            this._panel.webview.postMessage(message);
        } else {
            this._pendingMessages.push(message);
        }
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

