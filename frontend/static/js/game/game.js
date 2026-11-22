import { getLevel } from "../api.js";

const canvas = document.querySelector("#game-canvas");
const context = canvas?.getContext("2d");
const status = document.querySelector("#game-status");
const restartButton = document.querySelector("#restart-game");
const returnEditorButton = document.querySelector("#return-editor");

const keys = new Set();
let level = null;
let player = null;
let cameraX = 0;
let completed = false;
let lastTime = performance.now();

function shadeColor(hex, factor = 0.48) {
    const value = Number.parseInt(hex.slice(1), 16);
    const red = Math.round(((value >> 16) & 255) * factor);
    const green = Math.round(((value >> 8) & 255) * factor);
    const blue = Math.round((value & 255) * factor);
    return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function overlaps(a, b) {
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
}

function resetGame() {
    if (!level) return;
    const spawn = level.objects.find((object) => object.type === "spawn");
    player = {
        x: spawn?.x ?? 64,
        y: spawn?.y ?? 400,
        width: 30,
        height: 52,
        vx: 0,
        vy: 0,
        grounded: false,
    };
    cameraX = 0;
    completed = false;
    status.textContent = `關卡：${level.metadata.name}`;
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#101b2b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.translate(-cameraX, 0);
    for (const object of level.objects) {
        const defaultColors = {
            platform: "#60a5fa",
            spike: "#fb7185",
            spawn: "#a3e635",
            goal: "#facc15",
        };
        context.fillStyle = object.color || defaultColors[object.type] || "#ffffff";
        if (object.type === "platform") context.fillRect(object.x, object.y, object.width, object.height);
        if (object.type === "spike") {
            context.fillStyle = shadeColor(object.color || "#fb7185");
            context.beginPath();
            context.moveTo(object.x, object.y + object.height);
            context.lineTo(object.x + object.width / 2, object.y);
            context.lineTo(object.x + object.width, object.y + object.height);
            context.closePath();
            context.fill();
        }
        if (object.type === "spawn") context.fillRect(object.x, object.y, object.width, object.height);
        if (object.type === "goal") context.fillRect(object.x, object.y, object.width, object.height);
    }
    context.fillStyle = "#e5e7eb";
    context.fillRect(player.x, player.y, player.width, player.height);
    context.restore();
}

function update(delta) {
    if (!player || completed) return;
    const acceleration = 1800;
    const maxSpeed = level.settings.move_speed ?? 300;
    const friction = 0.82;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) player.vx -= acceleration * delta;
    if (keys.has("ArrowRight") || keys.has("KeyD")) player.vx += acceleration * delta;
    if (!(keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("ArrowRight") || keys.has("KeyD"))) {
        player.vx *= friction;
        if (Math.abs(player.vx) < 2) player.vx = 0;
    }
    player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

    player.vy += level.settings.gravity * delta;
    player.vy = Math.min(player.vy, 900);

    player.x += player.vx * delta;
    for (const object of level.objects) {
        if (object.type !== "platform" || !overlaps(player, object)) continue;
        if (player.vx > 0) player.x = object.x - player.width;
        else if (player.vx < 0) player.x = object.x + object.width;
        player.vx = 0;
    }

    player.y += player.vy * delta;
    player.grounded = false;
    for (const object of level.objects) {
        if (object.type !== "platform" || !overlaps(player, object)) continue;
        if (player.vy > 0) {
            player.y = object.y - player.height;
            player.grounded = true;
        } else if (player.vy < 0) {
            player.y = object.y + object.height;
        }
        player.vy = 0;
    }

    for (const object of level.objects) {
        if (object.type === "spike" && overlaps(player, object)) {
            status.textContent = "撞到尖刺！點重新開始再試一次。";
            resetGame();
            return;
        }
        if (object.type === "goal" && overlaps(player, object)) {
            completed = true;
            status.textContent = "恭喜到達終點！";
        }
    }

    player.x = Math.max(0, Math.min(player.x, Math.max(0, level.settings.width - player.width)));
    if (player.y > level.settings.height + 200) {
        status.textContent = "掉出關卡！點重新開始再試一次。";
        resetGame();
        return;
    }

    cameraX = Math.max(0, Math.min(level.settings.width - canvas.width, player.x - canvas.width * 0.35));
}

window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
    if ((event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") &&
        player?.grounded) {
        player.vy = -(level.settings.jump_strength ?? 520);
        player.grounded = false;
    }
    keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
restartButton?.addEventListener("click", resetGame);

function bindTouchControls() {
    for (const button of document.querySelectorAll("[data-game-key]")) {
        const key = button.dataset.gameKey;
        const release = (event) => {
            event.preventDefault();
            keys.delete(key);
        };
        button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            button.setPointerCapture?.(event.pointerId);
            keys.add(key);
        });
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", () => keys.delete(key));
        button.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    const jumpButton = document.querySelector('[data-game-action="jump"]');
    const jump = (event) => {
        event.preventDefault();
        if (player?.grounded && !completed) {
            player.vy = -(level.settings.jump_strength ?? 520);
            player.grounded = false;
        }
    };
    jumpButton?.addEventListener("pointerdown", jump);
    jumpButton?.addEventListener("contextmenu", (event) => event.preventDefault());
}

bindTouchControls();

function loop(now) {
    const delta = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;
    if (level) {
        update(delta);
        draw();
    }
    requestAnimationFrame(loop);
}

async function initialize() {
    if (!context) return;
    const params = new URLSearchParams(window.location.search);
    const isEditorTest = params.get("source") === "editor";
    if (returnEditorButton) {
        returnEditorButton.hidden = !isEditorTest;
        returnEditorButton.addEventListener("click", () => {
            window.location.href = "/editor";
        });
    }
    try {
        if (isEditorTest) {
            const draft = sessionStorage.getItem("parkour_test_level");
            if (!draft) throw new Error("找不到編輯器傳來的測試關卡，請回編輯器重新測試。");
            level = JSON.parse(draft);
        } else {
            const levelId = params.get("level") || "example_first";
            level = await getLevel(levelId);
        }
        resetGame();
    } catch (error) {
        status.textContent = `載入失敗：${error.message}`;
        context.fillStyle = "#101b2b";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
}

initialize();
requestAnimationFrame(loop);
