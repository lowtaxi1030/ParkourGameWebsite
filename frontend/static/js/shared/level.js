export function createEmptyLevel() {
    return {
        version: 1,
        metadata: {
            name: "未命名關卡",
            author: "Player",
            description: "",
        },
        settings: {
            width: 3200,
            height: 960,
            tile_size: 32,
            gravity: 980,
            move_speed: 300,
            jump_strength: 520,
        },
        objects: [],
    };
}
