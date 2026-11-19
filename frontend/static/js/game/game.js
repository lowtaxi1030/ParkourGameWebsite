import { GAME_CONFIG } from "../shared/config.js";

const canvas = document.querySelector("#game-canvas");
const context = canvas?.getContext("2d");

if (context) {
    context.fillStyle = "#101b2b";
    context.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);
    context.fillStyle = "#a3e635";
    context.font = "bold 28px system-ui";
    context.fillText("Game Engine - Ready", 32, 58);
    context.fillStyle = "#aab6c7";
    context.font = "16px system-ui";
    context.fillText("玩家、物理、碰撞與關卡載入功能將在後續階段加入。", 32, 92);
}
