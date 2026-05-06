// ========================================
// 定時任務腳本（給 Heroku Scheduler 使用）
// ========================================

const { sendDailyReport } = require('./index.js');

const market = process.argv[2]; // TW 或 US
if (market !== 'TW' && market !== 'US') {
  console.error('❌ 請指定市場：node scheduler.js TW 或 node scheduler.js US');
  process.exit(1);
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
