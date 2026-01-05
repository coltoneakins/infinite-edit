import { Container, DOMContainer, Rectangle } from 'pixi.js';
import { MessageClient } from '../core/MessageClient';
import { MaskManager, MaskProvider } from '../core/MaskManager';
import * as feather from 'feather-icons';

export class Toolbar extends Container implements MaskProvider {
    private messageClient: MessageClient;
    private element!: HTMLDivElement;
    private input!: HTMLInputElement;
    private resultsList!: HTMLUListElement;
    private domContainer!: DOMContainer;
    public readonly width_: number = 500;
    private maskManager: MaskManager;

    constructor(messageClient: MessageClient, maskManager: MaskManager) {
        super();
        this.messageClient = messageClient;
        this.maskManager = maskManager;
        this.init();

        // Register early
        this.maskManager.registerProvider(this);
    }

    public override destroy(options?: any) {
        this.maskManager.unregisterProvider(this);
        super.destroy(options);
    }

    public getMaskLocalBounds(): Rectangle {
        const w = this.element ? this.element.offsetWidth : this.width_;
        const h = this.element ? this.element.offsetHeight : 50;
        return new Rectangle(0, 0, w, h);
    }

    public getMaskGlobalBounds(): Rectangle {
        const w = this.element ? this.element.offsetWidth : this.width_;
        const h = this.element ? this.element.offsetHeight : 50;

        const tl = this.toGlobal({ x: 0, y: 0 });
        return new Rectangle(tl.x, tl.y, w, h);
    }

    private init() {
        this.zIndex = 1000;

        this.element = document.createElement('div');
        this.element.className = 'toolbar-container';
        this.element.style.width = `${this.width_}px`;

        // Input Container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'toolbar-input-wrapper';

        // Search Icon
        const searchIcon = document.createElement('div');
        searchIcon.className = 'toolbar-search-icon';
        searchIcon.innerHTML = feather.icons.search.toSvg({ width: 16, height: 16 });

        this.input = document.createElement('input');
        this.input.placeholder = 'Search files...';

        inputContainer.appendChild(searchIcon);
        inputContainer.appendChild(this.input);
        this.element.appendChild(inputContainer);

        // Results List
        this.resultsList = document.createElement('ul');
        this.resultsList.className = 'toolbar-results-list';

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
            this.maskManager.update();
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
                li.className = 'toolbar-result-item';

                li.innerHTML = `
                    <span class="result-label">${res.label}</span>
                    <span class="result-detail">${res.detail}</span>
                `;

                li.onclick = () => {
                    this.messageClient.send('requestOpenFile', { path: res.path });
                    this.input.value = '';
                    this.resultsList.style.display = 'none';
                    this.maskManager.update();
                };
                this.resultsList.appendChild(li);
            });
        } else {
            this.resultsList.style.display = 'none';
        }

        // Update masks since the toolbar size likely changed
        this.maskManager.update();
    }
}
