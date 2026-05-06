const stockAPI = require('./stock-api');
const gemini = require('./gemini');
const { database, pledgeDB } = require('./database');
const axios = require('axios');

async function testFirebase() {
  console.log('=== Firebase 測試 ===');

  console.log('\n1. 新增股票...');
  const add1 = await database.add('2330', 'TW', '台積電');
  console.log(add1.message);
  const add2 = await database.add('6706', 'TW', '惠特');
  console.log(add2.message);

  const add3 = await database.add('MSFT', 'US', 'Microsoft');
  console.log(add3.message);

  const add4 = await database.add('AAPL', 'US', 'Apple');
  console.log(add4.message);

  const addDup = await database.add('2330', 'TW', '台積電');
  console.log('重複新增:', addDup.message);

  console.log('\n2. 讀取清單...');
  const all = await database.getAll();
  console.log(JSON.stringify(all, null, 2));

  console.log('\n3. 取得單支股票...');
  const one = await database.get('2330');
  console.log(JSON.stringify(one, null, 2));

  console.log('\n4. 統計...');
  const stats = await database.getStats();
  console.log(stats);

  console.log('\n5. 刪除股票...');
  const del1 = await database.remove('AAPL');
  console.log(del1.message);

  const delNone = await database.remove('9999');
  console.log('刪除不存在:', delNone.message);

  console.log('\n6. 刪除後清單...');
  const final = await database.getAll();
  console.log(JSON.stringify(final, null, 2));

  console.log('\n=== Pledge 測試 ===');
  const p1 = await pledgeDB.add({
    symbol: '0050',
    shares: 10,
    borrowAmount: 473000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    interestRate: 2.5,
    warningRatio: 130,
  });
  console.log(p1.message);

  const allPledges = await pledgeDB.getAll();
  console.log(JSON.stringify(allPledges, null, 2));

  const delP = await pledgeDB.remove('0050');
  console.log(delP.message);

  console.log('\n✅ Firebase 測試完成');
}

async function test() {
  console.log('=== 台股測試 (2330 台積電) ===');
  const tw = await stockAPI.getStock('2330', 'TW');
  console.log(JSON.stringify(tw, null, 2));

  console.log('\n=== 美股測試 (AAPL) ===');
  const us = await stockAPI.getStock('AAPL', 'US');
  console.log(JSON.stringify(us, null, 2));

  console.log('\n=== 籌碼面單獨測試 (2330，指定日期) ===');
  const chipsRes = await axios.get('https://api.finmindtrade.com/api/v4/data', {
    params: {
      dataset: 'TaiwanStockInstitutionalInvestorsBuySell',
      data_id: '2330',
      start_date: '2026-04-29',
      end_date: '2026-04-29',
    },
  });
  console.log(JSON.stringify(chipsRes.data, null, 2));

  if (tw) {
    console.log('\n=== Gemini 分析台股 (2330) ===');
    const twAnalysis = await gemini.analyzeStock(tw);
    console.log(twAnalysis);
  }

  if (us) {
    console.log('\n=== Gemini 分析美股 (AAPL) ===');
    const usAnalysis = await gemini.analyzeStock(us);
    console.log(usAnalysis);
  }

  const stocksData = [tw, us].filter(Boolean);

  if (stocksData.length > 0) {
    console.log('\n=== 推播訊息預覽 ===');
    let report = `📊 ${new Date().toLocaleDateString('zh-TW')} 收盤報告\n\n`;

    for (const data of stocksData) {
      const direction = data.change > 0 ? '▲' : '▼';
      const chipText = data.chips
        ? `\n  🌏 外資：${data.chips.foreign > 0 ? '+' : ''}${data.chips.foreign} 張\n  🏢 投信：${data.chips.trust > 0 ? '+' : ''}${data.chips.trust} 張`
        : '';
      report += `【${data.symbol} ${data.name}】\n`;
      report += `💰 ${data.price} ${direction}${Math.abs(data.change)} (${data.changePercent}%)${chipText}\n\n`;
    }

    const analysis = await gemini.analyzeDailyReport(stocksData);
    report += `🤖 AI 籌碼分析：\n${analysis}`;

    console.log('─'.repeat(40));
    console.log(report);
    console.log('─'.repeat(40));
  }

  console.log('\n=== Gemini 對話問答（有記憶）===');
  const testUserId = 'test-user-001';
  const a1 = await gemini.ask(testUserId, '台積電最近值得買嗎？');
  console.log('Q: 台積電最近值得買嗎？');
  console.log('A:', a1);

  const a2 = await gemini.ask(testUserId, '那它的主要競爭對手是誰？');
  console.log('\nQ: 那它的主要競爭對手是誰？');
  console.log('A:', a2);
}

testFirebase().catch(console.error);
// test().catch(console.error);  // 完整測試（含股票 API + Gemini）
