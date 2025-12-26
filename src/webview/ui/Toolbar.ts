import { Container, DOMContainer } from 'pixi.js';
import { MessageClient } from '../core/MessageClient';

export class Toolbar extends Container {
    private messageClient: MessageClient;
    private element!: HTMLDivElement;
    private input!: HTMLInputElement;
    private resultsList!: HTMLUListElement;
    private domContainer!: DOMContainer;
    public readonly width_: number = 500;

    constructor(messageClient: MessageClient) {
        super();
        this.messageClient = messageClient;
        this.init();
    }

    private init() {
        this.element = document.createElement('div');
        this.element.style.width = `${this.width_}px`;
        // Glassmorphism and premium aesthetics
        this.element.style.backgroundColor = 'rgba(30, 30, 30, 0.85)';
        this.element.style.backdropFilter = 'blur(10px)';
        (this.element.style as any).webkitBackdropFilter = 'blur(10px)';
        this.element.style.padding = '6px';
        this.element.style.borderRadius = '12px';
        this.element.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.border = '1px solid rgba(255, 255, 255, 0.1)';

        // Input Container
        const inputContainer = document.createElement('div');
        inputContainer.style.position = 'relative';
        inputContainer.style.display = 'flex';
        inputContainer.style.alignItems = 'center';

        this.input = document.createElement('input');
        Object.assign(this.input.style, {
            width: '100%',
            padding: '6px 6px',
            boxSizing: 'border-box',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#e0e0e0',
            borderRadius: '6px',
            outline: 'none',
            fontSize: '14px',
            fontFamily: '"Segoe UI", sans-serif',
            transition: 'border-color 0.2s ease, background 0.2s ease'
        });
        this.input.placeholder = 'Search files...';

        this.input.onfocus = () => {
            this.input.style.borderColor = '#007fd4';
            this.input.style.background = 'rgba(0, 0, 0, 0.4)';
        };
        this.input.onblur = () => {
            this.input.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            this.input.style.background = 'rgba(0, 0, 0, 0.2)';
        };

        inputContainer.appendChild(this.input);
        this.element.appendChild(inputContainer);

        // Results List
        this.resultsList = document.createElement('ul');
        Object.assign(this.resultsList.style, {
            listStyle: 'none',
            padding: '0',
            margin: '8px 0 0 0',
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'none', // Hidden by default
            flexDirection: 'column',
            gap: '4px'
        });

        // Custom Scrollbar
        const style = document.createElement('style');
        style.textContent = `
            ul::-webkit-scrollbar { width: 8px; }
            ul::-webkit-scrollbar-track { background: transparent; }
            ul::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
            ul::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        `;
        this.element.appendChild(style);

        this.element.appendChild(this.resultsList);

        this.domContainer = new DOMContainer({
            element: this.element
        });
        this.domContainer.eventMode = 'static';

        this.addChild(this.domContainer);

        // Events
        this.input.addEventListener('input', this.onInput.bind(this));

        // Prevent Pixi drag/pan interaction when interacting with the toolbar
        this.element.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.element.addEventListener('wheel', (e) => e.stopPropagation());
    }

    private async onInput(e: Event) {
        const query = (e.target as HTMLInputElement).value;
        if (query.length < 1) {
            this.resultsList.style.display = 'none';
            this.resultsList.innerHTML = '';
            return;
        }

        try {
            const results = await this.messageClient.request('findFiles', { query });
            this.renderResults(results);
        } catch (err) {
            console.error('Find files failed:', err);
        }
    }

    private renderResults(results: any[]) {
        this.resultsList.innerHTML = '';
        if (results && results.length > 0) {
            this.resultsList.style.display = 'flex';
            results.forEach(res => {
                const li = document.createElement('li');
                Object.assign(li.style, {
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    color: '#cccccc',
                    display: 'flex',
                    flexDirection: 'column',
                    fontSize: '13px',
                    fontFamily: '"Segoe UI", sans-serif',
                    transition: 'background-color 0.1s ease'
                });

                li.onmouseover = () => li.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                li.onmouseout = () => li.style.backgroundColor = 'transparent';

                li.innerHTML = `
                    <span style="font-weight: 600; color: #ffffff; margin-bottom: 2px;">${res.label}</span>
                    <span style="font-size: 11px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${res.detail}</span>
                `;

                li.onclick = () => {
                    this.messageClient.send('requestOpenFile', { path: res.path });
                    this.input.value = '';
                    this.resultsList.style.display = 'none';
                };
                this.resultsList.appendChild(li);
            });
        } else {
            this.resultsList.style.display = 'none';
        }
    }
}
