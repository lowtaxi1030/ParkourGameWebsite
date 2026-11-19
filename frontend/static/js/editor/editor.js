import { createEmptyLevel } from "../shared/level.js";
import { getLevel, saveLevel } from "../api.js";
import { drawEditor } from "./editor_renderer.js";

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

const editorState = {
    level: createEmptyLevel(),
    camera: { x: 0, y: 0 },
    showGrid: true,
    snapToGrid: true,
    gridSize: 32,
    activeTool: "select",
    selectedObjectIds: [],
};

const history = [];
const future = [];
let drag = null;

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
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    if (editorState.snapToGrid) {
        return {
            x: Math.round(x / editorState.gridSize) * editorState.gridSize,
            y: Math.round(y / editorState.gridSize) * editorState.gridSize,
        };
    }
    return { x: Math.round(x), y: Math.round(y) };
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
    drawEditor(canvas, editorState);
}

showGridInput.addEventListener("change", updateAndDraw);
snapGridInput.addEventListener("change", updateAndDraw);
gridSizeInput.addEventListener("change", updateAndDraw);
activeToolInput.addEventListener("change", updateAndDraw);

canvas.addEventListener("pointerdown", (event) => {
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
        const object = createObject(tool, point.x, point.y);
        editorState.level.objects.push(object);
        editorState.selectedObjectIds = [object.id];
        status.textContent = `已放置 ${tool}物件。`;
        updateAndDraw();
        return;
    }
    const object = hitObject(point);
    if (!object) {
        editorState.selectedObjectIds = [];
        updateAndDraw();
        return;
    }
    editorState.selectedObjectIds = [object.id];
    drag = {
        object: cloneObject(object),
        offsetX: point.x - object.x,
        offsetY: point.y - object.y,
        changed: false,
    };
    updateAndDraw();
});

canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const point = canvasPoint(event);
    if (!drag.changed) {
        recordChange();
        drag.changed = true;
    }
    const object = editorState.level.objects.find((item) => item.id === drag.object.id);
    if (object) {
        object.x = Math.max(0, point.x - drag.offsetX);
        object.y = Math.max(0, point.y - drag.offsetY);
        updateAndDraw();
    }
});

canvas.addEventListener("pointerup", () => {
    drag = null;
});
canvas.addEventListener("pointerleave", () => {
    drag = null;
});

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
