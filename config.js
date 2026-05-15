// ========================================
// 設定檔
// ========================================

module.exports = {
  // Gemini API
  GEMINI_API_KEY: 'AIzaSyBrcNzIe1XjFpMB3B-W7xTPL2hKkk-sc74',

  // Telegram Bot
  TELEGRAM: {
    token: process.env.TELEGRAM_TOKEN || '8862809676:AAFBhdfhaK6Dm5xx0-bHf8J71XJRO0OcPHA',
    chatId: process.env.TELEGRAM_CHAT_ID || '8980495652',
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

  // Firebase 設定
  FIREBASE: {
    apiKey: 'AIzaSyAhrAmg0okaEn88JfJWKEwH588vUvrgrFY',
    authDomain: 'stock-notify-e48fa.firebaseapp.com',
    databaseURL: 'https://stock-notify-e48fa-default-rtdb.firebaseio.com',
    projectId: 'stock-notify-e48fa',
    storageBucket: 'stock-notify-e48fa.firebasestorage.app',
    messagingSenderId: '284852456183',
    appId: '1:284852456183:web:7bee9f5e0a73637ada21f2',
    measurementId: 'G-WGPBTGDBET',
  },
};
