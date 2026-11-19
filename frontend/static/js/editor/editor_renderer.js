export function drawEditor(canvas, state) {
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#101b2b";
    context.fillRect(0, 0, width, height);

    if (state.showGrid) {
        const size = state.gridSize;
        context.beginPath();
        context.strokeStyle = "rgba(180, 200, 225, 0.13)";
        context.lineWidth = 1;

        for (let x = 0; x <= width; x += size) {
            context.moveTo(x + 0.5, 0);
            context.lineTo(x + 0.5, height);
        }
        for (let y = 0; y <= height; y += size) {
            context.moveTo(0, y + 0.5);
            context.lineTo(width, y + 0.5);
        }
        context.stroke();
    }

    for (const object of state.level.objects) {
        const selected = state.selectedObjectIds.includes(object.id);
        if (object.type === "platform") context.fillStyle = "#60a5fa";
        else if (object.type === "spike") context.fillStyle = "#fb7185";
        else if (object.type === "spawn") context.fillStyle = "#a3e635";
        else context.fillStyle = "#facc15";
        context.fillRect(object.x, object.y, object.width, object.height);
        if (object.type === "spike") {
            context.fillStyle = "#7f1d1d";
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
        }
    }

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
