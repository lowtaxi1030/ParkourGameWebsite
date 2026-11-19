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

    context.fillStyle = "#a3e635";
    context.font = "bold 22px system-ui";
    context.fillText("Level Editor - Ready", 24, 38);
    context.fillStyle = "#aab6c7";
    context.font = "14px system-ui";
    context.fillText(
        state.snapToGrid ? "格線吸附：開啟" : "格線吸附：關閉",
        24, 64
    );
}
