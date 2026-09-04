# Collection Gallery Online / 多集合資料展示平台

本專案為通用型主題資料集合展示與檢索網頁應用程式（Collection Gallery Online），提供多資料集切換、側邊導覽面板、獨立集合與系統說明頁面、動態卡片矩陣、多維度動態篩選排序與詳細內容彈窗 (Modal)。

## 🌟 核心功能特色

1. **側邊導覽與版面佈局 (App Layout & Navigation Panel)**
   - **多 Collection 視圖切換**: 支援「日本特色詞彙」與「大陸特色詞彙」等多主題資料集動態切換，以及「系統說明頁 (SYSTEM)」。
   - **可收折側欄**: 支援導覽面板收折/展開，側欄收折時主內容區域保持全寬響應式居中。
   - **頁面頂欄與 KPI**: 整合頂部導覽列（品牌標籤、主題切換按鈕、重新載入資料按鈕），並於卡片標題右側顯示總筆數 KPI 數據（如 `520 筆`）。

2. **動態資料同步與容錯備援 (Data Fetching & Fallback)**
   - **多管道 API 讀取**: 支援 Google Sheets GViz API JSON 與 CSV 格式動態匯入。
   - **引號內多行 CSV 解析器**: 內建狀態機 CSV 解析器，完美保留詳細說明中的換行格式，避免引號內換行導致欄位錯位。
   - **逾時自動降級 (Timeout Failover)**: 採用 `AbortSignal.timeout(2500)` 請求，於網路異常或跨域受阻時自動降級使用本地 JSON 快照 (`data.json` / `china-data.json`) 確保系統穩定運作。

3. **雙色主題視覺體驗 (Light/Dark Mode)**
   - **雙色模式**: 支援 Light Mode 與 Dark Mode 一鍵切換，預設自動跟隨系統偏好 (`prefers-color-scheme`) 並儲存於 `localStorage`。
   - **純圖示化操作 (Icon-Only Actions)**: 採用原生 SVG Icon（主題切換、重新載入、視圖切換、副標題開關、Modal 關閉等），搭配清晰 Tooltip 與 Accessibility `aria-label`。
   - **等高卡片矩陣 (Uniform Card Grid)**: 嚴格等高卡片設計，標題採用專屬藍色 (`#0f6ce0` / `#4da2ff`)，內容超過 2 行自動截斷並提示點擊卡片開啟 Modal。

4. **多維度檢索與篩選機制 (Filter, Search & Sorting)**
   - **實時關鍵字搜尋**: 支援標題名稱、副標題/標音與詳細內容多欄位即時模糊搜尋。
   - **字數篩選 (`以字數搜尋`)**: 提供 `不限字數`、`1字`、`2字`、`3字`、`4字`、`5字以上` 多字數頁籤，準確處理多位元 Unicode 字數計算。
   - **快速分類與「隨機10個」抽卡**: 支援 `ALL`、`隨機10個` (抽卡測驗模式) 及分類頁籤。
   - **正倒序控制**: 提供一鍵正序與倒序切換。
   - **副標題/標音切換與空間彈性適應**: 支援顯示/隱藏副標題；隱藏時完全消除卡片內版面留白並等比例壓縮卡片高度，提供最佳卡片密度。

5. **詳細內容彈窗與 Hash 路由 (Detail Modal & Hash Routing)**
   - **舒適無眩光 Modal**: 採用 Soft Gray (`#f2f3f3`) 詳細內容背景框，舒適不眩光。
   - **中英 Meta 標籤**: 彈窗右下角呈現建置時間與資料編號 (`created at: YYYY-MM-DD | 編號: XXX`)。
   - **Hash 路由 (Single Page Hash Routing)**: 支援純靜態伺服器（GitHub Pages / HTTP Server）直接以 `#/集合名稱/項目名稱` 開啟指定 Modal，支援上一頁/下一頁瀏覽器紀錄與 `ESC` 快捷鍵關閉 Modal。

## 📁 專案檔案結構 (ES Modules 模組化)

```
.
├── index.html        # 主網頁應用程式 (Cloudscape Layout & Root Shell)
├── styles.css        # Cloudscape Design System 樣式表 (含 Layout, Cards Grid, Modal & Dark Mode)
├── js/
│   ├── app.js        # 進入點、全域事件監聽與 Downward Compatibility Bridge
│   ├── config.js     # Multi-Collection 資料庫組態與選項設定
│   ├── state.js      # 集中式 Application State (Store) & 訂閱機制
│   ├── theme.js      # 深色 / 淺色模式控制 logic
│   ├── parser.js     # 狀態機 CSV & GViz API 通用數據解析器
│   ├── data.js       # Google Sheets 動態網路抓取與 Fallback 快照機制
│   ├── filter.js     # 全文搜尋、分類索引、Unicode 字數長度比對與排序引擎
│   ├── router.js     # SPA Hash 路由解析與 View 切換引擎
│   └── components/
│       ├── sidebar.js    # 側欄收折與 Collection 選擇器組件
│       ├── cards.js      # 動態卡片矩陣與欄位顯示 toggle
│       ├── pagination.js # 響應式分頁元件
│       ├── modal.js      # 詳細內容彈窗 (Modal) 組件
│       └── toast.js      # 浮動訊息 (Toast) 提醒組件
├── data.json         # 日本特色詞彙資料快照備份 (離線降級備援)
├── china-data.json   # 大陸特色詞彙資料快照備份 (離線降級備援)
├── tests/
│   ├── unit.test.js        # 核心解析器與篩選邏輯單元測試
│   └── integration.test.js # 本地快照資料完整性測試
└── README.md         # 專案說明文件
```

## 🚀 本地啟動與預覽方式

1. 於本專案目錄啟動 HTTP 靜態伺服器：
   ```bash
   python3 -m http.server 8899
   ```
2. 於瀏覽器開啟 `http://localhost:8899` 即可預覽應用程式。

## 🧪 執行自動化測試

本專案採用 Node.js 內建測試執行器（Zero-dependency）：

```bash
node --test tests/*.test.js
```
