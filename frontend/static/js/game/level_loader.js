import { getLevel } from "../api.js";

export async function loadLevel(levelId) {
    return getLevel(levelId);
}
