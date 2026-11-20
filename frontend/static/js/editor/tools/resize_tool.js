export function clampObjectSize(object, minimumSize = 8) {
    object.width = Math.max(minimumSize, Number(object.width) || minimumSize);
    object.height = Math.max(minimumSize, Number(object.height) || minimumSize);
    return object;
}
