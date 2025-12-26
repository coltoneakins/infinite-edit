import { Container, Rectangle } from 'pixi.js';

/**
 * Checks if a given rectangle intersects with the bounds of any of the candidate containers.
 * @param rect - The rectangle to check for overlaps (x, y, width, height).
 * @param candidates - The list of containers to check against.
 * @param ignore - Optional container to ignore (e.g., the node itself being dragged).
 * @returns An array of containers that overlap.
 */
export function getOverlappingNodes(rect: Rectangle, candidates: Container[], ignore?: Container): Container[] {
    const overlaps: Container[] = [];

    for (const node of candidates) {
        if (node === ignore) {
            continue;
        }
        if (!node.visible || !node.renderable) {
            continue;
        }

        // Use getBounds() to get the global or parent-relative bounds
        // Assuming rect is in the same coordinate space as node.getBounds() or node properties
        // Usually safe to compare if they are siblings in the same parent.
        // However, node.getBounds() returns global bounds by default in Pixi.

        // If we are passing a rect that is local to the parent (contentContainer),
        // we should compare against node properties (x, y, width, height) if no rotation/skew.
        // Or strictly convert to global.

        // Let's assume 'rect' is in the PARENT coordinate space (siblings' parent).
        // node.x, node.y, node.width, node.height are in PARENT space (mostly).
        // Pixi Container width/height are calculated bounds.

        // Safe approach: Simple AABB check using node position and size
        // Note: node.width/height is expensive as it calculates bounds.
        // But EditorNode has fixed size properties if we could access them.
        // We will trust node.getBounds() or direct standard properties?
        // Let's use simple x/y/width/height properties for now as EditorNodes are rects.

        const nodeX = node.x;
        const nodeY = node.y;
        // Accessing width/height on Container can be expensive, but EditorNode sets them?
        // EditorNode is a Container.
        const nodeW = node.width;
        const nodeH = node.height;

        if (
            rect.x < nodeX + nodeW &&
            rect.x + rect.width > nodeX &&
            rect.y < nodeY + nodeH &&
            rect.y + rect.height > nodeY
        ) {
            overlaps.push(node);
        }
    }

    return overlaps;
}
