import { getLevels } from "./api.js";

const list = document.querySelector("#level-list");

async function renderLevels() {
    try {
        const result = await getLevels();
        if (result.levels.length === 0) {
            list.innerHTML = "<p>目前還沒有關卡。可以先到編輯器建立關卡。</p>";
            return;
        }

        list.replaceChildren();
        for (const level of result.levels) {
            const item = document.createElement("article");
            item.className = "panel";
            const title = document.createElement("h2");
            title.textContent = level.name;
            const author = document.createElement("p");
            author.textContent = `作者：${level.author}`;
            item.append(title, author);
            list.append(item);
        }
    } catch (error) {
        list.textContent = `載入失敗：${error.message}`;
    }
}

renderLevels();
