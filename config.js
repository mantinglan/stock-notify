// ========================================
// 設定檔
// ========================================

module.exports = {
  // Gemini API
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Telegram Bot
  TELEGRAM: {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // 股市 API Keys
  ALPHA_VANTAGE_KEY: process.env.ALPHA_VANTAGE_KEY, // 美股
  FINMIND_TOKEN: process.env.FINMIND_TOKEN, // 台股（選用）

  // 推播時間設定
  SCHEDULE: {
    TW_STOCK: '30 14 * * 1-5', // 週一到五 13:30（台股收盤）
    US_STOCK: '0 10 * * 2-6', // 週二到六 06:00（美股收盤，台灣時間）
  },

  // Gemini 模型設定
  GEMINI_MODEL: 'gemini-3.1-pro-preview',
};
