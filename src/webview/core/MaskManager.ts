import { Rectangle, IHitArea } from 'pixi.js';

export interface MaskProvider {
    getMaskLocalBounds(): Rectangle;
    getMaskGlobalBounds(): Rectangle;
}

export interface MaskConsumer {
    onMaskUpdate(providers: MaskProvider[]): void;
}

export class MaskManager {
    private providers: MaskProvider[] = [];
    private consumers: MaskConsumer[] = [];

    public registerProvider(provider: MaskProvider) {
        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
        }
    }

    public unregisterProvider(provider: MaskProvider) {
        const index = this.providers.indexOf(provider);
        if (index !== -1) {
            this.providers.splice(index, 1);
        }
    }

    public registerConsumer(consumer: MaskConsumer) {
        if (!this.consumers.includes(consumer)) {
            this.consumers.push(consumer);
        }
    }

    public unregisterConsumer(consumer: MaskConsumer) {
        const index = this.consumers.indexOf(consumer);
        if (index !== -1) {
            this.consumers.splice(index, 1);
        }
    }

    public update() {
        for (const consumer of this.consumers) {
            consumer.onMaskUpdate(this.providers);
        }
    }

    public getProviders(): MaskProvider[] {
        return this.providers;
    }
}

export class MaskedHitArea implements IHitArea {
    constructor(private maskManager: MaskManager, private baseArea: Rectangle) { }

    contains(x: number, y: number): boolean {
        // Must be within the base screen area
        if (!this.baseArea.contains(x, y)) {
            return false;
        }

        // Must NOT be within any masked region (hole)
        for (const provider of this.maskManager.getProviders()) {
            // Use GLOBAL bounds for hit testing because x,y are global (screen) coordinates
            const bounds = provider.getMaskGlobalBounds();
            if (bounds.contains(x, y)) {
                return false;
            }
        }

        return true;
    }

    public updateBaseArea(newArea: Rectangle) {
        this.baseArea = newArea;
    }
}
