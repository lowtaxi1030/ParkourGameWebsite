export function createGameState() {
    return {
        running: false,
        paused: false,
        player: null,
        camera: { x: 0, y: 0 },
        level: null,
    };
}
