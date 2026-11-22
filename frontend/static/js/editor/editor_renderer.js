function shadeColor(hex, factor = 0.48) {
    const value = Number.parseInt(hex.slice(1), 16);
    const red = Math.round(((value >> 16) & 255) * factor);
    const green = Math.round(((value >> 8) & 255) * factor);
    const blue = Math.round((value & 255) * factor);
    return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

export function drawEditor(canvas, state) {
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#101b2b";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(
        -state.camera.x * state.camera.zoom,
        -state.camera.y * state.camera.zoom
    );
    context.scale(state.camera.zoom, state.camera.zoom);

    if (state.showGrid) {
        const size = state.gridSize;
        context.beginPath();
        context.strokeStyle = "rgba(180, 200, 225, 0.13)";
        context.lineWidth = 1 / state.camera.zoom;

        const worldLeft = state.camera.x;
        const worldTop = state.camera.y;
        const worldRight = worldLeft + width / state.camera.zoom;
        const worldBottom = worldTop + height / state.camera.zoom;

        for (let x = Math.floor(worldLeft / size) * size; x <= worldRight; x += size) {
            context.moveTo(x + 0.5, worldTop);
            context.lineTo(x + 0.5, worldBottom);
        }
        for (let y = Math.floor(worldTop / size) * size; y <= worldBottom; y += size) {
            context.moveTo(worldLeft, y + 0.5);
            context.lineTo(worldRight, y + 0.5);
        }
        context.stroke();
    }

    for (const object of state.level.objects) {
        const selected = state.selectedObjectIds.includes(object.id);
        const defaultColors = {
            platform: "#60a5fa",
            spike: "#fb7185",
            spawn: "#a3e635",
            goal: "#facc15",
        };
        context.fillStyle = object.color || defaultColors[object.type] || "#ffffff";
        context.fillRect(object.x, object.y, object.width, object.height);
        if (object.type === "spike") {
            context.fillStyle = shadeColor(object.color || "#fb7185");
            context.beginPath();
            context.moveTo(object.x, object.y + object.height);
            context.lineTo(object.x + object.width / 2, object.y);
            context.lineTo(object.x + object.width, object.y + object.height);
            context.closePath();
            context.fill();
        }
        if (selected) {
            context.strokeStyle = "#ffffff";
            context.lineWidth = 3;
            context.strokeRect(object.x + 1, object.y + 1, object.width - 2, object.height - 2);
            context.fillStyle = "#ffffff";
            const handles = [
                [object.x, object.y],
                [object.x + object.width / 2, object.y],
                [object.x + object.width, object.y],
                [object.x, object.y + object.height / 2],
                [object.x + object.width, object.y + object.height / 2],
                [object.x, object.y + object.height],
                [object.x + object.width / 2, object.y + object.height],
                [object.x + object.width, object.y + object.height],
            ];
            for (const [x, y] of handles) {
                const handleSize = 12 / state.camera.zoom;
                context.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
                context.strokeStyle = "#0f172a";
                context.lineWidth = 2 / state.camera.zoom;
                context.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
            }
        }
    }
    context.restore();

    context.fillStyle = "#aab6c7";
    context.font = "14px system-ui";
    context.fillText(state.level.metadata.name, 24, 28);
    context.fillStyle = "#aab6c7";
    context.font = "14px system-ui";
    context.fillText(
        state.snapToGrid ? "格線吸附：開啟" : "格線吸附：關閉",
        24, 64
    );
}
