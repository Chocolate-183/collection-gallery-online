# Collection Gallery Online / 線上展覽與數位藝廊平台

本專案為通用型線上展覽與主題展品檢索網頁應用程式（Collection Gallery Online），提供多展廳動態切換、可收折導覽側欄、開館時間與維護模式管理、獨立大廳與服務台頁面、動態展品卡片矩陣、多維度動態篩選排序與展品導覽彈窗 (Modal)。

---

## 🌟 核心功能特色

### 1. 側邊導覽與展廳版面佈局 (App Layout & Side Navigation Panel)
- **多展廳動態切換**: 支援「日本特色詞彙展廳」與「大陸特色詞彙展廳」等多主題展區動態切換，以及「服務台資訊頁 (INFO)」。
- **可收折側欄**: 支援展廳導覽面板收折/展開與狀態記憶（`localStorage`），側欄收折時主內容區域保持全寬響應式居中。
- **展廳狀態徽章 (Status Badge)**: 展廳維護或調整時，側欄自動呈現「調整中」專屬標籤，隱藏項目數量。
- **頁面頂欄與展品 KPI 儀表板**: 整合頂部導覽列（品牌標籤、展廳切換、同步展品按鈕），並於卡片標題區域整合展廳編號（如 `C101`）與展品總數 KPI 數據（如 `520 件`）。

### 2. 展館開放時間與維護模式管理 (Opening Hours & Maintenance Mode)
- **開放時間排程解析 (`opening-hours.csv`)**: 支援每日參觀時間解析與實時開館狀態判斷 (`isGalleryOpen`)。
- **閉館與調整中視圖 (`view-maintenance`)**: 當非開放時間或特定展廳狀態為「調整中」時，自動切換至專屬維護頁面，提示開館時間與下次開館資訊。
- **大廳與服務台時間告示**: 大廳頂欄及服務台 (Info) 頁面呈現每週參觀時間排程網格與開館狀態告示。

### 3. 動態數據同步與容錯備援 (Data Fetching & Timeout Failover)
- **多管道 API 讀取**: 支援 Google Sheets GViz Query JSON API 與 CSV 格式動態匯入展品與策展詮釋資料。
- **引號內多行 CSV 解析器**: 內建狀態機 CSV 解析器，完美保留展品詳細解說中的換行格式，避免引號內換行導致欄位錯位。
- **逾時自動降級 (Timeout Failover)**: 採用 `AbortSignal.timeout(2500)` 請求，於網路異常或跨域受阻時自動降級使用本地 JSON 快照 (`data.json` / `china-data.json`) 確保展覽系統穩定運作。

### 4. 雙色主題與沉浸式視覺體驗 (Light/Dark Mode)
- **展廳燈光模式**: 支援 Light Mode 與 Dark Mode 一鍵切換，預設自動跟隨系統偏好 (`prefers-color-scheme`) 並儲存於 `localStorage`。
- **純圖示化操作 (Icon-Only Actions)**: 採用原生 SVG Icon（燈光模式切換、展品同步、展廳切換、Modal 關閉等），搭配清晰 Tooltip 與 Accessibility `aria-label`。
- **等高展品卡片矩陣 (Uniform Card Grid)**: 嚴格等高卡片設計，標題採用專屬藍色 (`#0f6ce0` / `#4da2ff`)，解說超過 2 行自動截斷並提示點擊開啟展品詳細導覽。
- **Monospace 等寬字型適配**: 展品編號、建置日期與 KPI 數字採用 `Roboto Mono` 等寬字型提升視覺一致性。

### 5. 多維度檢索與展品篩選機制 (Filter, Search & Sorting)
- **實時關鍵字搜尋**: 支援展品名稱、標音 (Reading)、策展解說與展品編號跨欄位即時模糊搜尋。
- **字數篩選 (`字數篩選`)**: 提供 `不限`、`1字`、`2字`、`3字`、`4字`、`5字+` 多字數頁籤，準確處理多位元 Unicode 字數計算。
- **快速分類與「隨機探索」導覽**: 支援 `全部展品`、`隨機探索` (隨機抽卡觀展模式)、`新進展品` (依建置時間排序) 及 50 音分區頁籤。
- **多重排序與分頁控制**: 提供標音正倒序、漢字正倒序、序號排序，以及每頁 `12` / `24` / `48` 件筆數選擇。

### 6. 展品詳細導覽彈窗與 Hash 路由 (Detail Modal & Hash Routing)
- **舒適無眩光 Modal**: 採用 Soft Gray (`#f2f3f3`) 展品導覽內容背景框，舒適不眩光。
- **展品 Meta 標籤**: 彈窗右下角呈現建置時間與展品編號 (`建置時間: YYYY-MM-DD | 展品編號: XXX`)。
- **Hash 路由 (Single Page Hash Routing)**: 支援純靜態伺服器（GitHub Pages / HTTP Server）直接以 `#/展廳名稱/展品名稱` 或 `#/welcome` / `#/about` 開啟指定展品 Modal 或視圖，支援瀏覽器歷程紀錄與 `ESC` 快捷鍵關閉 Modal。

---

## 📁 專案檔案結構 (ES Modules 模組化)

```
.
├── index.html        # 主網頁應用程式 (Cloudscape Layout & Root Shell)
├── styles.css        # Cloudscape Design System 樣式表 (含 Layout, Cards Grid, Modal & Dark Mode)
├── opening-hours.csv # 展館開放時間排程設定檔
├── js/
│   ├── app.js        # 進入點、全域事件監聽與 Downward Compatibility Bridge
│   ├── constants.js  # 集中式應用程式常數 (Views, Sort Types, Storage Keys, Default Schedules)
│   ├── config.js     # Multi-Collection 展館組態與 Google Sheets API 網址建構器
│   ├── state.js      # 集中式 Application State (Store) & 訂閱機制
│   ├── theme.js      # 深色 / 淺色展廳燈光模式控制 logic
│   ├── parser.js     # 狀態機 CSV、GViz API 通用數據與 Meta 詮釋資料解析器
│   ├── data.js       # Google Sheets 動態網路抓取、Meta 套用與 Fallback 快照機制
│   ├── filter.js     # 全文搜尋、分類索引、Unicode 字數長度比對與排序引擎
│   ├── router.js     # SPA Hash 路由解析與 View 視圖切換引擎
│   ├── utils.js      # HTML 轉義、Unicode 字長計算、開館時間判斷與 Safe Fetch
│   └── components/
│       ├── sidebar.js    # 展廳導覽側欄收折、徽章與展區選擇器組件
│       ├── cards.js      # 動態展品卡片矩陣組件
│       ├── pagination.js # 響應式展品分頁與每頁筆數控制組件
│       ├── modal.js      # 展品詳細導覽彈窗 (Modal) 組件
│       └── toast.js      # 浮動訊息 (Toast) 提醒組件
├── data.json         # 日本特色詞彙展區資料快照備份 (離線降級備援)
├── china-data.json   # 大陸特色詞彙展區資料快照備份 (離線降級備援)
├── tests/
│   ├── unit.test.js        # 核心解析器、篩選邏輯與 UI 結構單元測試
│   └── integration.test.js # 本地快照資料與參觀時間整合測試
└── README.md         # 專案說明文件
```

---

## 🚀 本地啟動與預覽方式

1. 於本專案目錄啟動 HTTP 靜態伺服器：
   ```bash
   python3 -m http.server 8899
   ```
2. 於瀏覽器開啟 `http://localhost:8899` 即可預覽線上展覽應用程式。

---

## 🧪 執行自動化測試

本專案採用 Node.js 內建測試執行器（Zero-dependency）：

```bash
node --test tests/*.test.js
```
