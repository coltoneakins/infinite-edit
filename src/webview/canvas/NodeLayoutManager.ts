import { EditorNode } from '../nodes/EditorNode';

/**
 * Sizing configuration for editor nodes based on content
 */
export interface NodeSizingConfig {
    /** Minimum width in pixels */
    minWidth: number;
    /** Maximum width in pixels */
    maxWidth: number;
    /** Minimum height in pixels */
    minHeight: number;
    /** Maximum height in pixels */
    maxHeight: number;
    /** Base width for small files */
    baseWidth: number;
    /** Base height for small files */
    baseHeight: number;
    /** Height per line of content */
    heightPerLine: number;
    /** Width per max line length character */
    widthPerChar: number;
    /** Threshold for "long line" detection */
    longLineThreshold: number;
}

/**
 * Layout information for a node (used for tracking and persistence)
 */
export interface NodeLayoutInfo {
    filePath: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
}

/**
 * Result of size calculation
 */
export interface CalculatedSize {
    width: number;
    height: number;
}

/**
 * Result of position calculation
 */
export interface CalculatedPosition {
    x: number;
    y: number;
}

/**
 * NodeLayoutManager - Manages intelligent sizing and positioning of editor nodes.
 *
 * This manager is designed to be extensible for future persistence features.
 * It tracks all node layouts and provides utilities for calculating optimal
 * placements for new nodes.
 */
export class NodeLayoutManager {
    private static instance: NodeLayoutManager | null = null;

    /** Currently tracked nodes */
    private nodes: Map<string, EditorNode> = new Map();

    /** The currently focused/active node (used for relative positioning) */
    private focusedNodePath: string | null = null;

    /** Default sizing configuration */
    private sizingConfig: NodeSizingConfig = {
        minWidth: 300,
        maxWidth: 800,
        minHeight: 200,
        maxHeight: 900,
        baseWidth: 450,
        baseHeight: 400,
        heightPerLine: 18, // Approximate line height in Monaco
        widthPerChar: 8.5, // Approximate char width in Monaco (monospace)
        longLineThreshold: 80,
    };

    /** Spacing between nodes when positioning */
    private nodeSpacing: number = 40;

    private constructor() {}

    /**
     * Get the singleton instance of NodeLayoutManager
     */
    public static getInstance(): NodeLayoutManager {
        if (!NodeLayoutManager.instance) {
            NodeLayoutManager.instance = new NodeLayoutManager();
        }
        return NodeLayoutManager.instance;
    }

    /**
     * Register a node with the layout manager
     */
    public registerNode(filePath: string, node: EditorNode): void {
        this.nodes.set(filePath, node);
        // Auto-set as focused when registered (newest node gets focus)
        this.focusedNodePath = filePath;
    }

    /**
     * Unregister a node from the layout manager
     */
    public unregisterNode(filePath: string): void {
        this.nodes.delete(filePath);
        if (this.focusedNodePath === filePath) {
            // Set focus to another node if available
            const remaining = Array.from(this.nodes.keys());
            this.focusedNodePath = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
    }

    /**
     * Set the currently focused node
     */
    public setFocusedNode(filePath: string): void {
        if (this.nodes.has(filePath)) {
            this.focusedNodePath = filePath;
        }
    }

    /**
     * Get the currently focused node
     */
    public getFocusedNode(): EditorNode | null {
        if (this.focusedNodePath) {
            return this.nodes.get(this.focusedNodePath) || null;
        }
        return null;
    }

    /**
     * Get all registered nodes
     */
    public getNodes(): Map<string, EditorNode> {
        return this.nodes;
    }

    /**
     * Calculate intelligent size for a new editor based on file content
     */
    public calculateSizeForContent(content: string): CalculatedSize {
        const lines = content.split('\n');
        const lineCount = lines.length;

        // Find the max line length (for width calculation)
        let maxLineLength = 0;
        for (const line of lines) {
            if (line.length > maxLineLength) {
                maxLineLength = line.length;
            }
        }

        // Calculate height based on line count
        // Use a logarithmic scale for very large files to prevent overly tall editors
        let heightFactor: number;
        if (lineCount <= 20) {
            heightFactor = lineCount;
        } else if (lineCount <= 100) {
            // Linear growth but slower
            heightFactor = 20 + (lineCount - 20) * 0.7;
        } else if (lineCount <= 500) {
            // Even slower growth
            heightFactor = 20 + 80 * 0.7 + (lineCount - 100) * 0.4;
        } else {
            // Logarithmic for very large files
            heightFactor = 20 + 80 * 0.7 + 400 * 0.4 + Math.log10(lineCount - 500 + 1) * 50;
        }

        let calculatedHeight = this.sizingConfig.baseHeight + heightFactor * this.sizingConfig.heightPerLine;

        // Calculate width based on max line length
        let widthFactor: number;
        if (maxLineLength <= this.sizingConfig.longLineThreshold) {
            widthFactor = maxLineLength;
        } else {
            // Slower growth for very long lines
            widthFactor = this.sizingConfig.longLineThreshold +
                Math.log10(maxLineLength - this.sizingConfig.longLineThreshold + 1) * 30;
        }

        let calculatedWidth = this.sizingConfig.baseWidth +
            Math.max(0, widthFactor - 40) * this.sizingConfig.widthPerChar;

        // Clamp to min/max bounds
        calculatedWidth = Math.max(
            this.sizingConfig.minWidth,
            Math.min(this.sizingConfig.maxWidth, calculatedWidth)
        );
        calculatedHeight = Math.max(
            this.sizingConfig.minHeight,
            Math.min(this.sizingConfig.maxHeight, calculatedHeight)
        );

        return {
            width: Math.round(calculatedWidth),
            height: Math.round(calculatedHeight)
        };
    }

    /**
     * Calculate the optimal position for a new node.
     * By default, positions to the right of the currently focused node.
     */
    public calculatePositionForNewNode(
        newNodeSize: CalculatedSize,
        viewportCenter: { x: number; y: number }
    ): CalculatedPosition {
        const focusedNode = this.getFocusedNode();

        if (focusedNode) {
            // Position to the right of the focused node
            const focusedX = focusedNode.x;
            const focusedY = focusedNode.y;
            const focusedWidth = focusedNode.width;
            const focusedHeight = focusedNode.height;

            // Calculate new position: to the right of focused node, vertically centered
            const newX = focusedX + focusedWidth + this.nodeSpacing;

            // Vertically center the new node relative to the focused node's center
            const focusedCenterY = focusedY + focusedHeight / 2;
            const newY = focusedCenterY - newNodeSize.height / 2;

            // Check for collisions with existing nodes and adjust if needed
            return this.adjustPositionForCollisions(
                { x: newX, y: newY },
                newNodeSize
            );
        }

        // No focused node - center in viewport
        return {
            x: viewportCenter.x - newNodeSize.width / 2,
            y: viewportCenter.y - newNodeSize.height / 2
        };
    }

    /**
     * Adjust position to avoid collisions with existing nodes
     */
    private adjustPositionForCollisions(
        position: CalculatedPosition,
        size: CalculatedSize
    ): CalculatedPosition {
        let adjustedPos = { ...position };
        const maxAttempts = 10;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const collision = this.findCollision(adjustedPos, size);
            if (!collision) {
                break;
            }

            // Move to the right of the colliding node
            adjustedPos.x = collision.x + collision.width + this.nodeSpacing;
            attempts++;
        }

        return adjustedPos;
    }

    /**
     * Find if there's a collision with existing nodes
     */
    private findCollision(
        position: CalculatedPosition,
        size: CalculatedSize
    ): { x: number; y: number; width: number; height: number } | null {
        const newRect = {
            left: position.x,
            right: position.x + size.width,
            top: position.y,
            bottom: position.y + size.height
        };

        for (const [, node] of this.nodes) {
            const nodeRect = {
                left: node.x - this.nodeSpacing / 2,
                right: node.x + node.width + this.nodeSpacing / 2,
                top: node.y - this.nodeSpacing / 2,
                bottom: node.y + node.height + this.nodeSpacing / 2
            };

            // AABB collision detection
            if (
                newRect.left < nodeRect.right &&
                newRect.right > nodeRect.left &&
                newRect.top < nodeRect.bottom &&
                newRect.bottom > nodeRect.top
            ) {
                return {
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: node.height
                };
            }
        }

        return null;
    }

    /**
     * Get layout information for all nodes (for persistence)
     */
    public getAllLayoutInfo(): NodeLayoutInfo[] {
        const layouts: NodeLayoutInfo[] = [];

        for (const [filePath, node] of this.nodes) {
            layouts.push({
                filePath,
                position: { x: node.x, y: node.y },
                size: { width: node.width, height: node.height },
                zIndex: node.zIndex
            });
        }

        return layouts;
    }

    /**
     * Get layout info for a specific node
     */
    public getNodeLayoutInfo(filePath: string): NodeLayoutInfo | null {
        const node = this.nodes.get(filePath);
        if (!node) {
            return null;
        }

        return {
            filePath,
            position: { x: node.x, y: node.y },
            size: { width: node.width, height: node.height },
            zIndex: node.zIndex
        };
    }

    /**
     * Update sizing configuration
     */
    public updateSizingConfig(config: Partial<NodeSizingConfig>): void {
        this.sizingConfig = { ...this.sizingConfig, ...config };
    }

    /**
     * Get current sizing configuration
     */
    public getSizingConfig(): NodeSizingConfig {
        return { ...this.sizingConfig };
    }

    /**
     * Set node spacing
     */
    public setNodeSpacing(spacing: number): void {
        this.nodeSpacing = spacing;
    }

    /**
     * Clear all tracked nodes (useful for reset/reload)
     */
    public clear(): void {
        this.nodes.clear();
        this.focusedNodePath = null;
    }
}
