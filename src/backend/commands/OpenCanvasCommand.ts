import { InfiniteEditPanel } from "../panels/InfiniteEditPanel";
import * as vscode from 'vscode';

export const openCanvasCommand = (extensionUri: vscode.Uri) => {
    return async () => {
        InfiniteEditPanel.createOrShow(extensionUri);
    };
};
