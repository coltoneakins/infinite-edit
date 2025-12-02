import * as vscode from 'vscode';

export class InfiniteEditPanel {
    public static currentPanel: InfiniteEditPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

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
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
            }
        );

        InfiniteEditPanel.currentPanel = new InfiniteEditPanel(panel, extensionUri);
    }

    private _isReady: boolean = false;
    private _pendingMessages: any[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'ready':
                        this._isReady = true;
                        this._pendingMessages.forEach(msg => this._panel.webview.postMessage(msg));
                        this._pendingMessages = [];
                        return;
                    case 'saveFile':
                        // Save the file to disk
                        // We need the URI. For now, let's assume the file path is the URI fsPath
                        // In a real app, we should pass the URI string.
                        try {
                            const uri = vscode.Uri.file(message.file);
                            await vscode.workspace.fs.writeFile(uri, Buffer.from(message.content));
                            vscode.window.showInformationMessage(`Saved ${message.file}`);
                        } catch (e) {
                            vscode.window.showErrorMessage(`Failed to save ${message.file}: ${e}`);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
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

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Infinite Edit</title>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; background-color: #1e1e1e; }
          #canvas-container { width: 100vw; height: 100vh; }
        </style>
			</head>
			<body>
        <div id="canvas-container"></div>
				<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
