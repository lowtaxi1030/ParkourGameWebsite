export function worldToScreen(position, camera) {
    return { x: position.x - camera.x, y: position.y - camera.y };
}

export function screenToWorld(position, camera) {
    return { x: position.x + camera.x, y: position.y + camera.y };
}

export function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}
