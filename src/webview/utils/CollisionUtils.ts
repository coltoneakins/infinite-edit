import { Container, Rectangle } from 'pixi.js';

/**
 * Checks if a given rectangle intersects with the bounds of any of the candidate containers.
 * @param rect - The rectangle to check for overlaps (x, y, width, height).
 * @param candidates - The list of containers to check against.
 * @param ignore - Optional container to ignore (e.g., the node itself being dragged).
 * @returns An array of containers that overlap.
 */
export function getOverlappingNodes(rect: Rectangle, candidates: Container[], ignore?: Container): { node: Container, zIndex: number }[] {
    const overlaps: { node: Container, zIndex: number }[] = [];

    for (const node of candidates) {
        if (node === ignore) {
            continue;
        }
        if (!node.visible || !node.renderable) {
            continue;
        }

        const nodeX = node.x;
        const nodeY = node.y;
        const nodeW = node.width;
        const nodeH = node.height;

        if (
            rect.x < nodeX + nodeW &&
            rect.x + rect.width > nodeX &&
            rect.y < nodeY + nodeH &&
            rect.y + rect.height > nodeY
        ) {
            overlaps.push({ node, zIndex: node.zIndex });
        }
    }

    // Sort by zIndex
    overlaps.sort((a, b) => b.zIndex - a.zIndex);
    return overlaps;
}
