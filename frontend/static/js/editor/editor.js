import { createEmptyLevel } from "../shared/level.js";
import { getLevel, saveLevel } from "../api.js";
import { drawEditor } from "./editor_renderer.js";
import { getScreenPoint, panCamera, screenToWorld, zoomAt } from "./editor_camera.js";
import { applySnapping } from "./grid/snapping.js";

const canvas = document.querySelector("#editor-canvas");
const showGridInput = document.querySelector("#show-grid");
const snapGridInput = document.querySelector("#snap-grid");
const gridSizeInput = document.querySelector("#grid-size");
const activeToolInput = document.querySelector("#active-tool");
const levelNameInput = document.querySelector("#level-name");
const saveButton = document.querySelector("#save-level");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const deleteButton = document.querySelector("#delete-selected");
const status = document.querySelector("#editor-status");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const resetCameraButton = document.querySelector("#reset-camera");
const zoomValue = document.querySelector("#zoom-value");

const editorState = {
    level: createEmptyLevel(),
    camera: { x: 0, y: 0, zoom: 1 },
    showGrid: true,
    snapToGrid: true,
    gridSize: 32,
    activeTool: "select",
    selectedObjectIds: [],
};

const history = [];
const future = [];
let drag = null;
let hoverHandle = null;
let panDrag = null;
let spacePressed = false;

const HANDLE_SIZE = 12;
const MIN_OBJECT_SIZE = 8;

function getResizeHandle(point) {
    if (editorState.selectedObjectIds.length !== 1) return null;
    const object = editorState.level.objects.find(
        (item) => item.id === editorState.selectedObjectIds[0]
    );
    if (!object) return null;

    const half = HANDLE_SIZE / (2 * editorState.camera.zoom);
    const handles = {
        nw: { x: object.x, y: object.y },
        ne: { x: object.x + object.width, y: object.y },
        sw: { x: object.x, y: object.y + object.height },
        se: { x: object.x + object.width, y: object.y + object.height },
        n: { x: object.x + object.width / 2, y: object.y },
        s: { x: object.x + object.width / 2, y: object.y + object.height },
        w: { x: object.x, y: object.y + object.height / 2 },
        e: { x: object.x + object.width, y: object.y + object.height / 2 },
    };

    for (const [name, position] of Object.entries(handles)) {
        if (
            point.x >= position.x - half &&
            point.x <= position.x + half &&
            point.y >= position.y - half &&
            point.y <= position.y + half
        ) return name;
    }
    return null;
}

function snapshot() {
    return JSON.stringify(editorState.level);
}

function restore(serialized) {
    editorState.level = JSON.parse(serialized);
    editorState.selectedObjectIds = [];
    levelNameInput.value = editorState.level.metadata.name;
    updateAndDraw();
}

function recordChange() {
    history.push(snapshot());
    if (history.length > 100) history.shift();
    future.length = 0;
}

function cloneObject(object) {
    return JSON.parse(JSON.stringify(object));
}

function getObjectSize(type) {
    if (type === "platform") return { width: 128, height: 32 };
    if (type === "spike") return { width: 32, height: 32 };
    return { width: 32, height: 64 };
}

function createObject(type, x, y) {
    const size = getObjectSize(type);
    return {
        id: `${type}_${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
        type,
        x,
        y,
        ...size,
    };
}

function canvasPoint(event) {
    const screenPoint = getScreenPoint(canvas, event);
    return screenToWorld(screenPoint, editorState.camera);
}

function hitObject(point) {
    for (let index = editorState.level.objects.length - 1; index >= 0; index -= 1) {
        const object = editorState.level.objects[index];
        if (
            point.x >= object.x && point.x <= object.x + object.width &&
            point.y >= object.y && point.y <= object.y + object.height
        ) return object;
    }
    return null;
}

function updateAndDraw() {
    editorState.showGrid = showGridInput.checked;
    editorState.snapToGrid = snapGridInput.checked;
    editorState.gridSize = Math.max(8, Math.min(128, Number(gridSizeInput.value) || 32));
    editorState.activeTool = activeToolInput.value;
    if (zoomValue) zoomValue.textContent = `${Math.round(editorState.camera.zoom * 100)}%`;
    drawEditor(canvas, editorState);
}

function startPan(event) {
    panDrag = {
        screenPoint: getScreenPoint(canvas, event),
        camera: { ...editorState.camera },
    };
    canvas.style.cursor = "grabbing";
}

showGridInput.addEventListener("change", updateAndDraw);
snapGridInput.addEventListener("change", updateAndDraw);
gridSizeInput.addEventListener("change", updateAndDraw);
activeToolInput.addEventListener("change", updateAndDraw);

function zoomFromCenter(factor) {
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    editorState.camera = zoomAt(
        editorState.camera,
        center,
        editorState.camera.zoom * factor
    );
    updateAndDraw();
}

zoomInButton?.addEventListener("click", () => zoomFromCenter(1.2));
zoomOutButton?.addEventListener("click", () => zoomFromCenter(0.8));
resetCameraButton?.addEventListener("click", () => {
    editorState.camera = { x: 0, y: 0, zoom: 1 };
    status.textContent = "已重置檢視位置。";
    updateAndDraw();
});

canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    if (event.button === 1 || event.button === 2 || spacePressed) {
        startPan(event);
        event.preventDefault();
        return;
    }
    const point = canvasPoint(event);
    const tool = editorState.activeTool;
    if (tool === "erase") {
        const object = hitObject(point);
        if (object) {
            recordChange();
            editorState.level.objects = editorState.level.objects.filter((item) => item.id !== object.id);
            updateAndDraw();
        }
        return;
    }
    if (tool !== "select") {
        recordChange();
        const placement = applySnapping(
            point,
            editorState.gridSize,
            editorState.snapToGrid
        );
        const object = createObject(tool, placement.x, placement.y);
        editorState.level.objects.push(object);
        editorState.selectedObjectIds = [object.id];
        status.textContent = `已放置 ${tool}物件。`;
        updateAndDraw();
        return;
    }
    const resizeHandle = getResizeHandle(point);
    if (resizeHandle) {
        const selectedObject = editorState.level.objects.find(
            (item) => item.id === editorState.selectedObjectIds[0]
        );
        if (selectedObject) {
            drag = {
                object: cloneObject(selectedObject),
                mode: "resize",
                handle: resizeHandle,
                changed: false,
            };
            updateAndDraw();
            return;
        }
    }
    const object = hitObject(point);
    if (!object) {
        editorState.selectedObjectIds = [];
        startPan(event);
        updateAndDraw();
        return;
    }
    editorState.selectedObjectIds = [object.id];
    drag = {
        object: cloneObject(object),
        mode: "move",
        offsetX: point.x - object.x,
        offsetY: point.y - object.y,
        changed: false,
    };
    updateAndDraw();
});

canvas.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    if (panDrag) {
        editorState.camera = panCamera(
            panDrag.camera,
            panDrag.screenPoint,
            getScreenPoint(canvas, event)
        );
        updateAndDraw();
        return;
    }
    if (!drag) {
        hoverHandle = getResizeHandle(point);
        if (hoverHandle) {
            const vertical = hoverHandle.includes("n") || hoverHandle.includes("s");
            const horizontal = hoverHandle.includes("e") || hoverHandle.includes("w");
            if (vertical && horizontal) {
                canvas.style.cursor = (hoverHandle === "nw" || hoverHandle === "se")
                    ? "nwse-resize"
                    : "nesw-resize";
            } else if (vertical) {
                canvas.style.cursor = "ns-resize";
            } else {
                canvas.style.cursor = "ew-resize";
            }
        } else {
            canvas.style.cursor = editorState.activeTool === "select" ? "move" : "crosshair";
        }
    }
    if (!drag) return;
    if (!drag.changed) {
        recordChange();
        drag.changed = true;
    }
    const object = editorState.level.objects.find((item) => item.id === drag.object.id);
    if (object && drag.mode === "move") {
        const position = applySnapping(
            { x: point.x - drag.offsetX, y: point.y - drag.offsetY },
            editorState.gridSize,
            editorState.snapToGrid
        );
        object.x = Math.max(0, position.x);
        object.y = Math.max(0, position.y);
        updateAndDraw();
        return;
    }
    if (object && drag.mode === "resize") {
        const original = drag.object;
        const handle = drag.handle;
        const resizePoint = applySnapping(
            point,
            editorState.gridSize,
            editorState.snapToGrid
        );
        let left = original.x;
        let top = original.y;
        let right = original.x + original.width;
        let bottom = original.y + original.height;

        if (handle.includes("w")) left = Math.min(resizePoint.x, right - MIN_OBJECT_SIZE);
        if (handle.includes("e")) right = Math.max(resizePoint.x, left + MIN_OBJECT_SIZE);
        if (handle.includes("n")) top = Math.min(resizePoint.y, bottom - MIN_OBJECT_SIZE);
        if (handle.includes("s")) bottom = Math.max(resizePoint.y, top + MIN_OBJECT_SIZE);

        left = Math.max(0, left);
        top = Math.max(0, top);
        object.x = left;
        object.y = top;
        object.width = Math.max(MIN_OBJECT_SIZE, right - left);
        object.height = Math.max(MIN_OBJECT_SIZE, bottom - top);
        updateAndDraw();
    }
});

function endPointerInteraction() {
    drag = null;
    panDrag = null;
    canvas.style.cursor = "crosshair";
}

canvas.addEventListener("pointerup", endPointerInteraction);
canvas.addEventListener("pointercancel", endPointerInteraction);

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const screenPoint = getScreenPoint(canvas, event);
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    editorState.camera = zoomAt(
        editorState.camera,
        screenPoint,
        editorState.camera.zoom * factor
    );
    status.textContent = `檢視縮放：${Math.round(editorState.camera.zoom * 100)}%`;
    updateAndDraw();
}, { passive: false });

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

undoButton.addEventListener("click", () => {
    if (history.length === 0) return;
    future.push(snapshot());
    restore(history.pop());
});

redoButton.addEventListener("click", () => {
    if (future.length === 0) return;
    history.push(snapshot());
    restore(future.pop());
});

deleteButton.addEventListener("click", () => {
    if (editorState.selectedObjectIds.length === 0) return;
    recordChange();
    editorState.level.objects = editorState.level.objects.filter(
        (object) => !editorState.selectedObjectIds.includes(object.id)
    );
    editorState.selectedObjectIds = [];
    status.textContent = "已刪除選取物件。";
    updateAndDraw();
});

saveButton.addEventListener("click", async () => {
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
    try {
        const saved = await saveLevel(editorState.level);
        editorState.level = saved;
        status.textContent = `已儲存關卡：${saved.id}`;
        history.push(snapshot());
    } catch (error) {
        status.textContent = `儲存失敗：${error.message}`;
    }
});

levelNameInput.addEventListener("change", () => {
    recordChange();
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
});

window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        spacePressed = true;
        if (event.target === document.body || event.target === canvas) event.preventDefault();
    }
});

window.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
        spacePressed = false;
        if (!panDrag) canvas.style.cursor = "crosshair";
    }
});

window.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (editorState.selectedObjectIds.length !== 1) return;
    event.preventDefault();

    const object = editorState.level.objects.find(
        (item) => item.id === editorState.selectedObjectIds[0]
    );
    if (!object) return;

    const step = event.shiftKey ? 32 : editorState.snapToGrid ? editorState.gridSize : 1;
    recordChange();
    let position = { x: object.x, y: object.y };
    if (event.key === "ArrowLeft") position.x = Math.max(0, position.x - step);
    if (event.key === "ArrowRight") position.x += step;
    if (event.key === "ArrowUp") position.y = Math.max(0, position.y - step);
    if (event.key === "ArrowDown") position.y += step;
    position = applySnapping(position, editorState.gridSize, editorState.snapToGrid);
    object.x = position.x;
    object.y = position.y;
    status.textContent = "已使用方向鍵微調物件位置。";
    updateAndDraw();
});

async function loadInitialLevel() {
    const levelId = new URLSearchParams(window.location.search).get("level");
    if (!levelId) {
        updateAndDraw();
        return;
    }
    try {
        editorState.level = await getLevel(levelId);
        levelNameInput.value = editorState.level.metadata.name;
        status.textContent = `已載入關卡：${editorState.level.metadata.name}`;
    } catch (error) {
        status.textContent = `載入失敗：${error.message}`;
    }
    updateAndDraw();
}

loadInitialLevel();
