
import * as vscode from 'vscode';

export type MessageHandler = (message: any) => Promise<any> | any;

export class MessageBus {
    private handlers: Map<string, MessageHandler> = new Map();
    private webview: vscode.Webview | undefined;

    constructor() { }

    public setWebview(webview: vscode.Webview) {
        this.webview = webview;
    }

    public register(command: string, handler: MessageHandler) {
        this.handlers.set(command, handler);
    }

    public async handleMessage(message: any) {
        const handler = this.handlers.get(message.command);
        if (handler) {
            try {
                const result = await handler(message);
                if (message.requestId && this.webview) {
                    this.webview.postMessage({
                        command: 'response',
                        requestId: message.requestId,
                        body: result
                    });
                }
            } catch (error: any) {
                if (message.requestId && this.webview) {
                    this.webview.postMessage({
                        command: 'error',
                        requestId: message.requestId,
                        message: error.message || String(error)
                    });
                }
                console.error(`Error handling message ${message.command}:`, error);
            }
        } else {
            console.warn(`No handler for command: ${message.command}`);
        }
    }

    public send(command: string, body?: any) {
        if (this.webview) {
            this.webview.postMessage({ command, ...body });
        }
    }
}
