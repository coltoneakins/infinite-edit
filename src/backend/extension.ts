import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { InfiniteEditPanel } from './panels/InfiniteEditPanel';
import { SidebarProvider } from './providers/SidebarProvider';
import { openCanvasCommand } from './commands/OpenCanvasCommand';
import { openFileCommand } from './commands/OpenFileCommand';
import { InfiniteFileSystemProvider } from './providers/FileSystemProvider';
import { LSPProvider } from './providers/LSPProvider';
import { ConfigurationManager } from './services/ConfigurationManager';

// Enable Hot Reload in development mode
if (process.env.NODE_ENV === "development") {
    try {
        const { enableHotReload } = require("@hediet/node-reload/node");

        if (module && typeof module.filename === 'string' && module.filename.length > 0) {
            enableHotReload({ entryModule: module });
        } else {
            console.warn('Infinite Edit: node-reload entry module path unavailable, skipping hot reload.');
        }
    } catch (error) {
        console.warn('Infinite Edit: failed to initialize hot reload', error);
    }
}



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const envPath = path.join(context.extensionUri.fsPath, '.env');
    dotenv.config({ path: envPath });

    console.log('Infinite Edit: Activated', {
        nodeEnv: process.env.NODE_ENV,
        devServerUrl: process.env.DEV_SERVER_URL || 'http://localhost:3000'
    });

    // Initialize configuration manager
    const configManager = new ConfigurationManager();
    context.subscriptions.push(configManager);

    // Register the infinite file system provider
    const fileSystemProvider = new InfiniteFileSystemProvider();
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider('infinite', fileSystemProvider, { isCaseSensitive: true })
    );

    // Register commands for VS Code's command palette
    const openCanvasDisposable = vscode.commands.registerCommand('infinite-edit.openCanvas', openCanvasCommand(context.extensionUri, fileSystemProvider, configManager));
    const openFileDisposable = vscode.commands.registerCommand('infinite-edit.openFile', openFileCommand(context.extensionUri, fileSystemProvider, configManager));
    context.subscriptions.push(openCanvasDisposable, openFileDisposable);

    // Register LSP bridge providers
    LSPProvider.register(context);

    // Register the sidebar provider
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

}

// This method is called when your extension is deactivated
export function deactivate() { }

