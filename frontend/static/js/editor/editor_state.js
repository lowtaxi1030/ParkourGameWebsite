export function createEditorState(level) {
    return {
        level,
        selectedObjectIds: [],
        activeTool: "select",
        showGrid: true,
        snapToGrid: true,
        gridSize: 32,
        camera: { x: 0, y: 0 },
    };
}
