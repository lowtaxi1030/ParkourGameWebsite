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
const testButton = document.querySelector("#test-level");
const exportButton = document.querySelector("#export-level");
const importButton = document.querySelector("#import-level");
const importFileInput = document.querySelector("#import-level-file");
const propertyEmpty = document.querySelector("#property-empty");
const propertyFields = document.querySelector("#property-fields");
const propertyInputs = {
    type: document.querySelector("#property-type"),
    x: document.querySelector("#property-x"),
    y: document.querySelector("#property-y"),
    width: document.querySelector("#property-width"),
    height: document.querySelector("#property-height"),
};
const applyPropertiesButton = document.querySelector("#apply-properties");
const levelSettingInputs = {
    width: document.querySelector("#level-width"),
    height: document.querySelector("#level-height"),
    tile_size: document.querySelector("#level-tile-size"),
    gravity: document.querySelector("#level-gravity"),
    move_speed: document.querySelector("#level-move-speed"),
    jump_strength: document.querySelector("#level-jump-strength"),
};
const applyLevelSettingsButton = document.querySelector("#apply-level-settings");
const propertyColorInput = document.querySelector("#property-color");
const propertyColorValue = document.querySelector("#property-color-value");

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
let autosaveTimer = null;
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
    const tileSize = editorState.level.settings.tile_size || 32;
    const widthLimit = editorState.level.settings.width;
    const heightLimit = editorState.level.settings.height;
    let width = type === "platform" ? tileSize * 4 : tileSize;
    let height = type === "spawn" || type === "goal" ? tileSize * 2 : tileSize;
    return {
        width: Math.min(width, widthLimit),
        height: Math.min(height, heightLimit),
    };
}

const DEFAULT_OBJECT_COLORS = {
    platform: "#60a5fa",
    spike: "#fb7185",
    spawn: "#a3e635",
    goal: "#facc15",
};

function createObject(type, x, y) {
    const size = getObjectSize(type);
    return {
        id: `${type}_${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
        type,
        color: DEFAULT_OBJECT_COLORS[type] || "#ffffff",
        x: Math.max(0, Math.min(x, editorState.level.settings.width - size.width)),
        y: Math.max(0, Math.min(y, editorState.level.settings.height - size.height)),
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

function draftStorageKey(level = editorState.level) {
    return `parkour_editor_autosave:${level.id || "draft"}`;
}

function saveDraftNow() {
    try {
        editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
        localStorage.setItem(draftStorageKey(), JSON.stringify(editorState.level));
        return true;
    } catch (error) {
        console.warn("無法自動保存關卡草稿：", error);
        return false;
    }
}

function scheduleDraftSave() {
    if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
        autosaveTimer = null;
        if (saveDraftNow()) {
            status.textContent = "已自動保存到這台裝置；重新整理後仍可繼續編輯。";
        } else {
            status.textContent = "自動保存失敗，請使用「儲存關卡」或匯出 JSON 備份。";
        }
    }, 350);
}

function restoreLocalDraft(levelId = null) {
    const key = `parkour_editor_autosave:${levelId || "draft"}`;
    try {
        const serialized = localStorage.getItem(key);
        if (!serialized) return false;
        const draft = validateImportedLevel(JSON.parse(serialized));
        editorState.level = draft;
        levelNameInput.value = draft.metadata.name || "未命名關卡";
        status.textContent = "已還原上次自動保存的編輯內容。";
        return true;
    } catch (error) {
        console.warn("自動保存草稿無法讀取：", error);
        localStorage.removeItem(key);
        return false;
    }
}

window.addEventListener("pagehide", () => {
    if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
    saveDraftNow();
});

function updateAndDraw() {
    scheduleDraftSave();
    editorState.showGrid = showGridInput.checked;
    editorState.snapToGrid = snapGridInput.checked;
    editorState.gridSize = Math.max(8, Math.min(128, Number(gridSizeInput.value) || 32));
    editorState.activeTool = activeToolInput.value;
    if (zoomValue) zoomValue.textContent = `${Math.round(editorState.camera.zoom * 100)}%`;
    drawEditor(canvas, editorState);
    updatePropertyPanel();
    updateLevelSettingsPanel();
}

function getSelectedObject() {
    if (editorState.selectedObjectIds.length !== 1) return null;
    return editorState.level.objects.find(
        (object) => object.id === editorState.selectedObjectIds[0]
    ) || null;
}

function updatePropertyPanel() {
    const object = getSelectedObject();
    propertyEmpty.hidden = Boolean(object);
    propertyFields.hidden = !object;
    if (!object) return;
    for (const key of ["type", "x", "y", "width", "height"]) {
        propertyInputs[key].value = object[key];
    }
    propertyColorInput.value = /^#[0-9a-fA-F]{6}$/.test(object.color || "")
        ? object.color : (DEFAULT_OBJECT_COLORS[object.type] || "#ffffff");
    propertyColorValue.textContent = propertyColorInput.value.toUpperCase();
}

function updateLevelSettingsPanel() {
    const defaults = { width: 3200, height: 960, tile_size: 32, gravity: 980, move_speed: 300, jump_strength: 520 };
    for (const key of Object.keys(levelSettingInputs)) {
        editorState.level.settings[key] ??= defaults[key];
        levelSettingInputs[key].value = editorState.level.settings[key];
    }
}

function validateImportedLevel(level) {
    if (!level || typeof level !== "object" || Array.isArray(level)) {
        throw new Error("JSON 最外層必須是物件。");
    }
    if (!level.metadata || typeof level.metadata !== "object" || Array.isArray(level.metadata) ||
        !level.settings || typeof level.settings !== "object" || Array.isArray(level.settings) ||
        !Array.isArray(level.objects)) {
        throw new Error("關卡必須包含 metadata、settings 與 objects。");
    }
    level.settings.move_speed ??= 300;
    level.settings.jump_strength ??= 520;
    for (const key of ["width", "height", "tile_size", "gravity", "move_speed", "jump_strength"]) {
        if (!Number.isFinite(Number(level.settings[key]))) {
            throw new Error(`設定值 ${key} 必須是有效數字。`);
        }
    }
    if (Number(level.settings.width) < 320 || Number(level.settings.width) > 100000 ||
        Number(level.settings.height) < 320 || Number(level.settings.height) > 20000 ||
        Number(level.settings.tile_size) < 8 || Number(level.settings.tile_size) > 256 ||
        Number(level.settings.gravity) < 0 || Number(level.settings.gravity) > 5000 ||
        Number(level.settings.move_speed) < 50 || Number(level.settings.move_speed) > 1000 ||
        Number(level.settings.jump_strength) < 100 || Number(level.settings.jump_strength) > 1500) {
        throw new Error("關卡設定超出允許範圍。");
    }
    const ids = new Set();
    for (const object of level.objects) {
        if (!object || typeof object !== "object" ||
            !["platform", "spike", "spawn", "goal"].includes(object.type)) {
            throw new Error("物件資料或物件類型不正確。");
        }
        if (typeof object.id !== "string" || !object.id || ids.has(object.id)) {
            throw new Error("每個物件都必須有不重複的 ID。");
        }
        ids.add(object.id);
        if (object.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(object.color)) {
            throw new Error(`物件 ${object.id} 的顏色必須是六位數 HEX 色碼。`);
        }
        object.color = object.color || DEFAULT_OBJECT_COLORS[object.type];
        for (const key of ["x", "y", "width", "height"]) {
            if (!Number.isFinite(Number(object[key]))) {
                throw new Error(`物件 ${object.id} 的 ${key} 不是有效數字。`);
            }
        }
        if (Number(object.x) < 0 || Number(object.y) < 0 ||
            Number(object.width) < 8 || Number(object.height) < 8 ||
            Number(object.x) + Number(object.width) > Number(level.settings.width) ||
            Number(object.y) + Number(object.height) > Number(level.settings.height)) {
            throw new Error(`物件 ${object.id} 的位置或大小不合理，或超出關卡範圍。`);
        }
    }
    return level;
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
        object.x = Math.max(0, Math.min(
            position.x, editorState.level.settings.width - object.width
        ));
        object.y = Math.max(0, Math.min(
            position.y, editorState.level.settings.height - object.height
        ));
        updateAndDraw();
        return;
    }
    if (object && drag.mode === "resize") {
        const original = drag.object;
        const handle = drag.handle;
        const snappedPoint = applySnapping(
            point,
            editorState.gridSize,
            editorState.snapToGrid
        );
        const resizePoint = {
            x: Math.max(0, Math.min(snappedPoint.x, editorState.level.settings.width)),
            y: Math.max(0, Math.min(snappedPoint.y, editorState.level.settings.height)),
        };
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

function deleteSelectedObjects() {
    if (editorState.selectedObjectIds.length === 0) return;
    recordChange();
    editorState.level.objects = editorState.level.objects.filter(
        (object) => !editorState.selectedObjectIds.includes(object.id)
    );
    editorState.selectedObjectIds = [];
    status.textContent = "已刪除選取物件。";
    updateAndDraw();
}

deleteButton.addEventListener("click", deleteSelectedObjects);

window.addEventListener("keydown", (event) => {
    if (event.key !== "Delete") return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement || target?.isContentEditable) return;
    if (editorState.selectedObjectIds.length === 0) return;
    event.preventDefault();
    deleteSelectedObjects();
});

saveButton.addEventListener("click", async () => {
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
    try {
        const previousDraftKey = draftStorageKey();
        const saved = await saveLevel(editorState.level);
        editorState.level = saved;
        if (previousDraftKey !== draftStorageKey()) localStorage.removeItem(previousDraftKey);
        saveDraftNow();
        status.textContent = `已儲存關卡：${saved.id}（同時保留本機自動保存）`;
        history.push(snapshot());
    } catch (error) {
        status.textContent = `儲存失敗：${error.message}`;
    }
});

levelNameInput.addEventListener("change", () => {
    recordChange();
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
    scheduleDraftSave();
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
    object.x = Math.max(0, Math.min(
        position.x, editorState.level.settings.width - object.width
    ));
    object.y = Math.max(0, Math.min(
        position.y, editorState.level.settings.height - object.height
    ));
    status.textContent = "已使用方向鍵微調物件位置。";
    updateAndDraw();
});

propertyColorInput.addEventListener("input", () => {
    propertyColorValue.textContent = propertyColorInput.value.toUpperCase();
});

applyPropertiesButton.addEventListener("click", () => {
    const object = getSelectedObject();
    if (!object) return;
    const values = {};
    for (const key of ["x", "y", "width", "height"]) {
        values[key] = Number(propertyInputs[key].value);
        if (!Number.isFinite(values[key])) {
            status.textContent = "物件屬性必須是有效數字。";
            return;
        }
    }
    if (values.x < 0 || values.y < 0 || values.width < MIN_OBJECT_SIZE ||
        values.height < MIN_OBJECT_SIZE ||
        values.x + values.width > editorState.level.settings.width ||
        values.y + values.height > editorState.level.settings.height) {
        status.textContent = "物件不可超出關卡範圍，寬高至少要 8。";
        return;
    }
    const color = propertyColorInput.value;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        status.textContent = "請選擇有效的物件顏色。";
        return;
    }
    recordChange();
    Object.assign(object, values, { color });
    status.textContent = "已更新物件位置、大小與顏色。";
    updateAndDraw();
});

applyLevelSettingsButton.addEventListener("click", () => {
    const values = {
        width: Number(levelSettingInputs.width.value),
        height: Number(levelSettingInputs.height.value),
        tile_size: Number(levelSettingInputs.tile_size.value),
        gravity: Number(levelSettingInputs.gravity.value),
        move_speed: Number(levelSettingInputs.move_speed.value),
        jump_strength: Number(levelSettingInputs.jump_strength.value),
    };
    if (!Number.isInteger(values.width) || values.width < 320 || values.width > 100000 ||
        !Number.isInteger(values.height) || values.height < 320 || values.height > 20000 ||
        !Number.isInteger(values.tile_size) || values.tile_size < 8 || values.tile_size > 256 ||
        !Number.isFinite(values.gravity) || values.gravity < 0 || values.gravity > 5000 ||
        !Number.isFinite(values.move_speed) || values.move_speed < 50 || values.move_speed > 1000 ||
        !Number.isFinite(values.jump_strength) || values.jump_strength < 100 || values.jump_strength > 1500) {
        status.textContent = "設定超出範圍：寬 320–100000、高 320–20000、格子 8–256、重力 0–5000、移動速度 50–1000、跳躍力度 100–1500。";
        updateLevelSettingsPanel();
        return;
    }
    const outsideObject = editorState.level.objects.find((object) =>
        object.x + object.width > values.width || object.y + object.height > values.height
    );
    if (outsideObject) {
        status.textContent = `無法套用：物件 ${outsideObject.id} 會超出新的關卡範圍。`;
        return;
    }
    recordChange();
    editorState.level.settings = { ...editorState.level.settings, ...values };
    status.textContent = "已更新遊戲整體數據。";
    updateAndDraw();
});

exportButton.addEventListener("click", () => {
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
    const blob = new Blob(
        [JSON.stringify(editorState.level, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${editorState.level.metadata.name.replace(/[\\\\/:*?"<>|]/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "已匯出 JSON 關卡檔案。";
});

importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file) return;
    try {
        const imported = validateImportedLevel(JSON.parse(await file.text()));
        recordChange();
        editorState.level = imported;
        levelNameInput.value = imported.metadata.name || "未命名關卡";
        editorState.selectedObjectIds = [];
        status.textContent = `已匯入關卡：${levelNameInput.value}`;
        updateAndDraw();
    } catch (error) {
        status.textContent = `匯入失敗：${error.message}`;
    } finally {
        importFileInput.value = "";
    }
});

testButton.addEventListener("click", () => {
    editorState.level.metadata.name = levelNameInput.value.trim() || "未命名關卡";
    try {
        validateImportedLevel(editorState.level);
        sessionStorage.setItem("parkour_test_level", JSON.stringify(editorState.level));
        window.location.href = "/game?source=editor";
    } catch (error) {
        status.textContent = `無法測試：${error.message}`;
    }
});

async function loadInitialLevel() {
    const levelId = new URLSearchParams(window.location.search).get("level");
    if (levelId) {
        try {
            editorState.level = await getLevel(levelId);
            levelNameInput.value = editorState.level.metadata.name;
            restoreLocalDraft(levelId);
            status.textContent = "已載入關卡；若有較新的本機草稿，已優先還原。";
        } catch (error) {
            status.textContent = `載入失敗：${error.message}`;
            if (!restoreLocalDraft(levelId)) restoreLocalDraft();
        }
    } else if (!restoreLocalDraft()) {
        levelNameInput.value = editorState.level.metadata.name;
        status.textContent = "新關卡已準備好。編輯內容會自動保存到這台裝置。";
    }
    updateAndDraw();
}

loadInitialLevel();
