import { InfiniteEditPanel } from "../panels/InfiniteEditPanel";
import * as vscode from 'vscode';
import { InfiniteFileSystemProvider } from "../providers/FileSystemProvider";

export const openCanvasCommand = (extensionUri: vscode.Uri, fileSystemProvider: InfiniteFileSystemProvider) => {
    return async () => {
        InfiniteEditPanel.createOrShow(extensionUri, fileSystemProvider);
    };
};
