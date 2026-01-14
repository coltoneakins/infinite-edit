declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

export class MessageClient {
    private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
    private requestIdCounter: number = 0;

    constructor() {
        this.init();
    }

    private init() {
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;

            if (message.command === 'response') {
                const req = this.pendingRequests.get(message.requestId);
                if (req) {
                    req.resolve(message.body);
                    this.pendingRequests.delete(message.requestId);
                }
                return;
            } else if (message.command === 'error') {
                const req = this.pendingRequests.get(message.requestId);
                if (req) {
                    req.reject(message.message);
                    this.pendingRequests.delete(message.requestId);
                }
                return;
            }
        });
    }

    public sendRequest(command: string, body: any = {}): Promise<any> {
        const requestId = (this.requestIdCounter++).toString();
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            vscode.postMessage({ command, requestId, ...body });
        });
    }

    public send(command: string, body: any = {}) {
        vscode.postMessage({ command, ...body });
    }
}

export default MessageClient;
