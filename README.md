# Collection Gallery Online / 線上展覽與數位藝廊平台

本專案為通用型線上展覽與主題展品檢索網頁應用程式（Collection Gallery Online），提供多展廳切換、側邊展廳導覽面板、獨立展廳與策展說明頁面、動態展品卡片矩陣、多維度動態篩選排序與展品導覽彈窗 (Modal)。

## 🌟 核心功能特色

1. **側邊導覽與展廳版面佈局 (App Layout & Navigation Panel)**
   - **多展廳動態切換**: 支援「日本特色詞彙展廳」與「大陸特色詞彙展廳」等多主題展區動態切換，以及「服務台資訊頁 (INFO)」。
   - **可收折側欄**: 支援展廳導覽面板收折/展開，側欄收折時主內容區域保持全寬響應式居中。
   - **頁面頂欄與展品 KPI**: 整合頂部導覽列（品牌標籤、展廳切換按鈕、同步展品按鈕），並於卡片標題右側顯示展品總數 KPI 數據（如 `520 件`）。

2. **動態資料同步與容錯備援 (Data Fetching & Fallback)**
   - **多管道 API 讀取**: 支援 Google Sheets GViz API JSON 與 CSV 格式動態匯入展品與策展詮釋資料。
   - **引號內多行 CSV 解析器**: 內建狀態機 CSV 解析器，完美保留展品詳細解說中的換行格式，避免引號內換行導致欄位錯位。
   - **逾時自動降級 (Timeout Failover)**: 採用 `AbortSignal.timeout(2500)` 請求，於網路異常或跨域受阻時自動降級使用本地 JSON 快照 (`data.json` / `china-data.json`) 確保展覽系統穩定運作。

3. **雙色主題與沉浸式視覺體驗 (Light/Dark Mode)**
   - **展廳燈光模式**: 支援 Light Mode 與 Dark Mode 一鍵切換，預設自動跟隨系統偏好 (`prefers-color-scheme`) 並儲存於 `localStorage`。
   - **純圖示化操作 (Icon-Only Actions)**: 採用原生 SVG Icon（燈光模式切換、展品同步、展廳切換、Modal 關閉等），搭配清晰 Tooltip 與 Accessibility `aria-label`。
   - **等高展品卡片矩陣 (Uniform Card Grid)**: 嚴格等高卡片設計，標題採用專屬藍色 (`#0f6ce0` / `#4da2ff`)，解說超過 2 行自動截斷並提示點擊開啟展品詳細導覽。

4. **多維度檢索與展品篩選機制 (Filter, Search & Sorting)**
   - **實時關鍵字搜尋**: 支援展品名稱、標音與策展導覽解說多欄位即時模糊搜尋。
   - **字數篩選 (`字數篩選`)**: 提供 `不限`、`1字`、`2字`、`3字`、`4字`、`5字+` 多字數頁籤，準確處理多位元 Unicode 字數計算。
   - **快速分類與「隨機探索」導覽**: 支援 `全部展品`、`隨機探索` (隨機抽卡觀展模式)、`新進展品` 及 50 音分區頁籤。
   - **正倒序控制**: 提供一鍵正序與倒序展品排列。

5. **展品詳細導覽彈窗與 Hash 路由 (Detail Modal & Hash Routing)**
   - **舒適無眩光 Modal**: 採用 Soft Gray (`#f2f3f3`) 展品導覽內容背景框，舒適不眩光。
   - **展品 Meta 標籤**: 彈窗右下角呈現建置時間與展品編號 (`建置時間: YYYY-MM-DD | 展品編號: XXX`)。
   - **Hash 路由 (Single Page Hash Routing)**: 支援純靜態伺服器（GitHub Pages / HTTP Server）直接以 `#/展廳名稱/展品名稱` 開啟指定展品 Modal，支援瀏覽器歷程紀錄與 `ESC` 快捷鍵關閉 Modal。

## 📁 專案檔案結構 (ES Modules 模組化)

```
.
├── index.html        # 主網頁應用程式 (Cloudscape Layout & Root Shell)
├── styles.css        # Cloudscape Design System 樣式表 (含 Layout, Cards Grid, Modal & Dark Mode)
├── js/
│   ├── app.js        # 進入點、全域事件監聽與 Downward Compatibility Bridge
│   ├── config.js     # Multi-Collection 展館與策展組態設定
│   ├── state.js      # 集中式 Application State (Store) & 訂閱機制
│   ├── theme.js      # 深色 / 淺色展廳燈光模式控制 logic
│   ├── parser.js     # 狀態機 CSV & GViz API 通用數據解析器
│   ├── data.js       # Google Sheets 動態網路抓取與 Fallback 快照機制
│   ├── filter.js     # 全文搜尋、分類索引、Unicode 字數長度比對與排序引擎
│   ├── router.js     # SPA Hash 路由解析與 View 切換引擎
│   └── components/
│       ├── sidebar.js    # 展廳導覽側欄收折與展區選擇器組件
│       ├── cards.js      # 動態展品卡片矩陣組件
│       ├── pagination.js # 響應式展品分頁元件
│       ├── modal.js      # 展品詳細導覽彈窗 (Modal) 組件
│       └── toast.js      # 浮動訊息 (Toast) 提醒組件
├── data.json         # 日本特色詞彙展區資料快照備份 (離線降級備援)
├── china-data.json   # 大陸特色詞彙展區資料快照備份 (離線降級備援)
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
2. 於瀏覽器開啟 `http://localhost:8899` 即可預覽線上展覽應用程式。

## 🧪 執行自動化測試

本專案採用 Node.js 內建測試執行器（Zero-dependency）：

```bash
```bash
node --test tests/*.test.js
```
