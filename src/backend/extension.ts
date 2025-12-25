import * as vscode from 'vscode';
import { InfiniteEditPanel } from './panels/InfiniteEditPanel';
import { SidebarProvider } from './providers/SidebarProvider';
import { openCanvasCommand } from './commands/OpenCanvasCommand';
import { openFileCommand } from './commands/OpenFileCommand';
// Enable Hot Reload in development mode
if (process.env.NODE_ENV === "development") {
    const { enableHotReload } = require("@hediet/node-reload/node");
    enableHotReload({ entryModule: module });
}



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('Infinite Edit: Activated');

    // Register commands for VS Code's command palette
    const openCanvasDisposable = vscode.commands.registerCommand('infinite-edit.openCanvas', openCanvasCommand(context.extensionUri));
    const openFileDisposable = vscode.commands.registerCommand('infinite-edit.openFile', openFileCommand(context.extensionUri));
    context.subscriptions.push(openCanvasDisposable, openFileDisposable);

    // Register the sidebar provider
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );
}

// This method is called when your extension is deactivated
export function deactivate() { }

