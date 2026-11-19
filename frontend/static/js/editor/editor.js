import { createEmptyLevel } from "../shared/level.js";
import { drawEditor } from "./editor_renderer.js";

const canvas = document.querySelector("#editor-canvas");
const showGridInput = document.querySelector("#show-grid");
const snapGridInput = document.querySelector("#snap-grid");
const gridSizeInput = document.querySelector("#grid-size");

const editorState = {
    level: createEmptyLevel(),
    camera: { x: 0, y: 0 },
    showGrid: true,
    snapToGrid: true,
    gridSize: 32,
};

function updateAndDraw() {
    editorState.showGrid = showGridInput.checked;
    editorState.snapToGrid = snapGridInput.checked;
    editorState.gridSize = Math.max(8, Math.min(128, Number(gridSizeInput.value) || 32));
    drawEditor(canvas, editorState);
}

showGridInput.addEventListener("change", updateAndDraw);
snapGridInput.addEventListener("change", updateAndDraw);
gridSizeInput.addEventListener("change", updateAndDraw);

updateAndDraw();
