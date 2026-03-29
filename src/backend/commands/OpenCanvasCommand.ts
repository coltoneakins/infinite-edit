import { InfiniteEditPanel } from "../panels/InfiniteEditPanel";
import * as vscode from 'vscode';
import { InfiniteFileSystemProvider } from "../providers/FileSystemProvider";
import { ConfigurationManager } from "../services/ConfigurationManager";

export const openCanvasCommand = (extensionUri: vscode.Uri, fileSystemProvider: InfiniteFileSystemProvider, configManager: ConfigurationManager, context: vscode.ExtensionContext) => {
    return async () => {
        InfiniteEditPanel.createOrShow(extensionUri, fileSystemProvider, configManager, context);
    };
};
