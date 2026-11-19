import { snapToGrid } from "../../shared/coordinate.js";

export function applySnapping(position, gridSize, enabled) {
    if (!enabled) return { ...position };
    return {
        x: snapToGrid(position.x, gridSize),
        y: snapToGrid(position.y, gridSize),
    };
}
