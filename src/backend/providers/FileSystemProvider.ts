import * as vscode from 'vscode';

export class InfiniteFileSystemProvider implements vscode.FileSystemProvider {
    private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;

    watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): vscode.Disposable {
        // Implement watcher if needed
        return new vscode.Disposable(() => { });
    }

    stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        // For now, let's assume all infinite:/// files are just proxies for real files
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.stat(realUri);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.readDirectory(realUri);
    }

    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.createDirectory(realUri);
    }

    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.readFile(realUri);
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }): void | Thenable<void> {
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.writeFile(realUri, content).then(() => {
            this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        });
    }

    delete(uri: vscode.Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
        const realUri = this.mapToRealUri(uri);
        return vscode.workspace.fs.delete(realUri, options);
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
        const oldRealUri = this.mapToRealUri(oldUri);
        const newRealUri = this.mapToRealUri(newUri);
        return vscode.workspace.fs.rename(oldRealUri, newRealUri, options);
    }

    private mapToRealUri(uri: vscode.Uri): vscode.Uri {
        // This is a simple mapping. In a more complex extension, you'd have a more robust way
        // to map infinite:///path/to/file to file:///real/path/to/file
        // For now, let's assume the path is the same but with 'file' scheme.
        // If it's an absolute path, we can just replace the scheme.
        return vscode.Uri.file(uri.path);
    }

    public static getUri(realPath: string): vscode.Uri {
        return vscode.Uri.parse(`infinite:${realPath}`);
    }

    public notifyFileChanged(uri: vscode.Uri) {
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }
}
