export function getScreenPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
}

export function screenToWorld(point, camera) {
    return {
        x: camera.x + point.x / camera.zoom,
        y: camera.y + point.y / camera.zoom,
    };
}

export function panCamera(startCamera, startPoint, currentPoint) {
    return {
        ...startCamera,
        x: startCamera.x - (currentPoint.x - startPoint.x) / startCamera.zoom,
        y: startCamera.y - (currentPoint.y - startPoint.y) / startCamera.zoom,
    };
}

export function zoomAt(camera, screenPoint, nextZoom) {
    const zoom = Math.max(0.25, Math.min(3, nextZoom));
    const worldBefore = screenToWorld(screenPoint, camera);
    return {
        ...camera,
        zoom,
        x: worldBefore.x - screenPoint.x / zoom,
        y: worldBefore.y - screenPoint.y / zoom,
    };
}
