import * as vscode from 'vscode';
import { InfiniteEditPanel } from './panels/InfiniteEditPanel';
import { SidebarProvider } from './providers/SidebarProvider';
import { openCanvasCommand } from './commands/OpenCanvasCommand';
import { openFileCommand } from './commands/OpenFileCommand';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('Infinite Edit: Activated');

    // Register commands for VS Code's command palette
    const openCanvasDisposable = vscode.commands.registerCommand('infinite-edit.openCanvas', openCanvasCommand(context.extensionUri));
    const openFileDisposable = vscode.commands.registerCommand('infinite-edit.openFile', openFileCommand(context.extensionUri));
    context.subscriptions.push(openCanvasDisposable, openFileDisposable);

    // Register the sidebar provider
    // This creates a new webview that is displayed in the sidebar that is paired with the InfiniteEditPanel
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

}

// This method is called when your extension is deactivated
export function deactivate() { }
