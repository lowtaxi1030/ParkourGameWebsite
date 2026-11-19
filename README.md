# ParkourGameWebsite

2D 橫向跑酷遊戲與關卡編輯器的第一版專案骨架。

## 功能規劃

- 2D 橫向跑酷遊戲
- 混合式關卡編輯：格線吸附與自由放置
- JSON 關卡檔案
- SQLite 儲存關卡索引與遊玩紀錄
- 關卡編輯器與遊戲共用關卡資料格式

## 執行方式

需要 Python 3.10 或更新版本。

1. 建立並啟用虛擬環境（建議）。
2. 安裝套件：

   ```bash
   pip install -r requirements.txt
   ```

3. 啟動網站：

   ```bash
   python run.py
   ```

4. 在瀏覽器開啟終端機顯示的本機網址，通常是 `http://127.0.0.1:5000`。

## 資料位置

- `levels/examples/`：範例關卡
- `levels/user/`：使用者建立的關卡
- `instance/game.db`：本機 SQLite 資料庫（啟動時自動建立）

## 目前版本

目前是可啟動的基礎骨架。遊戲物理、完整物件工具、Undo/Redo、關卡匯入匯出等功能會在後續階段實作。
