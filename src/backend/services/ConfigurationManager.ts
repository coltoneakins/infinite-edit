import * as vscode from 'vscode';

export interface InfiniteEditConfig {
    theme: string;
}

export class ConfigurationManager {
    private _config: InfiniteEditConfig;
    private _configurationChangeEmitter = new vscode.EventEmitter<InfiniteEditConfig>();
    public onDidChangeConfiguration = this._configurationChangeEmitter.event;
    private _disposables: vscode.Disposable[] = [];

    constructor() {
        this._config = this._readConfiguration();
        this._setupWatcher();
    }

    private _readConfiguration(): InfiniteEditConfig {
        const config = vscode.workspace.getConfiguration('infiniteEdit');
        return {
            theme: config.get('theme', 'vs-dark'),
        };
    }

    private _setupWatcher() {
        // Watch for configuration changes
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('infiniteEdit')) {
                this._config = this._readConfiguration();
                this._configurationChangeEmitter.fire(this._config);
            }
        });
        this._disposables.push(disposable);
    }

    /**
     * Get the current configuration
     */
    public getConfig(): InfiniteEditConfig {
        return { ...this._config };
    }

    /**
     * Get a specific configuration value
     */
    public get<K extends keyof InfiniteEditConfig>(key: K): InfiniteEditConfig[K] {
        return this._config[key];
    }

    /**
     * Set a specific configuration value globally
     */
    public async set<K extends keyof InfiniteEditConfig>(key: K, value: InfiniteEditConfig[K]): Promise<void> {
        const config = vscode.workspace.getConfiguration('infiniteEdit');
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    /**
     * Set a specific configuration value in workspace settings
     */
    public async setWorkspace<K extends keyof InfiniteEditConfig>(key: K, value: InfiniteEditConfig[K]): Promise<void> {
        const config = vscode.workspace.getConfiguration('infiniteEdit');
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * Set a specific configuration value in folder settings
     */
    public async setFolder<K extends keyof InfiniteEditConfig>(key: K, value: InfiniteEditConfig[K], folder?: vscode.WorkspaceFolder): Promise<void> {
        const config = vscode.workspace.getConfiguration('infiniteEdit');
        const targetFolder = folder || vscode.workspace.workspaceFolders?.[0];
        if (!targetFolder) {
            throw new Error('No workspace folder available for folder-level configuration');
        }
        await config.update(key, value, vscode.ConfigurationTarget.WorkspaceFolder, targetFolder);
    }

    /**
     * Dispose of all watchers
     */
    public dispose() {
        this._configurationChangeEmitter.dispose();
        this._disposables.forEach(d => d.dispose());
    }
}

