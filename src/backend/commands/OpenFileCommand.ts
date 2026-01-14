import * as vscode from 'vscode';
import { InfiniteEditPanel } from "../panels/InfiniteEditPanel";
import { InfiniteFileSystemProvider } from '../providers/FileSystemProvider';

export const openFileCommand = (extensionUri: vscode.Uri, fileSystemProvider: InfiniteFileSystemProvider) => {
    return async () => {
        if (!InfiniteEditPanel.currentPanel) {
            InfiniteEditPanel.createOrShow(extensionUri, fileSystemProvider);
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            InfiniteEditPanel.currentPanel?.openFile(editor.document);
        } else {
            vscode.window.showErrorMessage('Infinite Edit: No active editor found.', 'Open File').then(async (selection) => {
                if (selection === 'Open File') {
                    const files = await vscode.workspace.findFiles('**/*');
                    const items = files.map(file => ({ label: vscode.workspace.asRelativePath(file), uri: file }));
                    const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a file to open in Infinite Edit' });

                    if (selected) {
                        const document = await vscode.workspace.openTextDocument(selected.uri);
                        InfiniteEditPanel.currentPanel?.openFile(document);
                    }
                }
            });
        }
    };
};