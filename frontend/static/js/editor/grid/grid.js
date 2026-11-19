export function getGridLines(canvasWidth, canvasHeight, gridSize) {
    const vertical = [];
    const horizontal = [];
    for (let x = 0; x <= canvasWidth; x += gridSize) vertical.push(x);
    for (let y = 0; y <= canvasHeight; y += gridSize) horizontal.push(y);
    return { vertical, horizontal };
}
