// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { InfiniteEditPanel } from './InfiniteEditPanel';
import { SidebarProvider } from './SidebarProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "infinite-edit" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const openCanvasDisposable = vscode.commands.registerCommand('infinite-edit.openCanvas', () => {
		InfiniteEditPanel.createOrShow(context.extensionUri);
	});

	const openFileDisposable = vscode.commands.registerCommand('infinite-edit.openFile', () => {
		if (!InfiniteEditPanel.currentPanel) {
			InfiniteEditPanel.createOrShow(context.extensionUri);
		}

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			InfiniteEditPanel.currentPanel?.openFile(editor.document);
		}
	});

	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
	);

	context.subscriptions.push(openCanvasDisposable, openFileDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
