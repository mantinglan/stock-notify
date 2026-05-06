# 📊 Stock Notify Bot

LINE Bot 股票通知機器人，整合 Gemini AI 分析功能。

## 功能

- ✅ 股票追蹤清單管理（台股 + 美股）
- ✅ 每日收盤自動推播
- ✅ 即時股票查詢
- ✅ Gemini AI 智能分析
- ✅ 股票比較分析
- ✅ AI 自由問答

## 指令

### 股票管理
- `add 2330` - 新增台積電到追蹤清單
- `add AAPL` - 新增 Apple 到追蹤清單
- `del 2330` - 移除台積電
- `list` - 顯示追蹤清單

### 查詢分析
- `info 2330` - 查詢台積電即時資訊
- `analyze 2330` - AI 分析台積電
- `compare 2330 2454` - 比較兩支股票
- `report` - 手動觸發每日報告

### AI 問答
- `ask 台積電適合買嗎？` - 詢問 AI

## 環境變數

需要在 Heroku 設定以下環境變數：

```bash
# LINE Bot
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_USER_ID=              # 你的 LINE User ID

# Gemini API
GEMINI_API_KEY=

# 股市 API (選用)
ALPHA_VANTAGE_KEY=         # 美股 API
FINMIND_TOKEN=             # 台股籌碼面（選用）
```

## 部署到 Heroku

1. 建立 Heroku app
2. 設定環境變數
3. 推送程式碼
4. 設定 Heroku Scheduler（每日推播）

## 本地測試

```bash
# 安裝套件
npm install

# 設定環境變數（建立 .env 檔案）
# 執行
node index.js
```

## API Keys 申請

### LINE Bot
https://developers.line.biz/

### Gemini API
https://aistudio.google.com/app/apikey

### Alpha Vantage (美股)
https://www.alphavantage.co/support/#api-key

### FinMind (台股，選用)
https://finmindtrade.com/
