// ========================================
// 定時任務腳本（給 Heroku Scheduler 使用）
// ========================================

const { sendDailyReport } = require('./index.js');

const market = process.argv[2]; // TW 或 US
if (market !== 'TW' && market !== 'US') {
  console.error('❌ 請指定市場：node scheduler.js TW 或 node scheduler.js US');
  process.exit(1);
}

// 台灣時間的星期幾（Heroku 跑 UTC，轉換 +8）
const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
const day = now.getUTCDay(); // 0=日, 1=一 ... 6=六

// 台股：週一到五；美股：週二到六（美股收盤對應台灣隔天早上）
const isTradingDay = market === 'TW' ? day >= 1 && day <= 5 : day >= 2 && day <= 6;

if (!isTradingDay) {
  console.log(`⏭️ 今日非 ${market} 交易日，跳過推播`);
  process.exit(0);
}

console.log(`🕐 定時任務觸發（${market}）...`);

sendDailyReport(market)
  .then(() => {
    console.log('✅ 定時任務完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 定時任務失敗:', error);
    process.exit(1);
  });
