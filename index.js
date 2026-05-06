// ========================================
// Stock Notify Bot - LINE Bot 主程式
// ========================================

const linebot = require('linebot');
const config = require('./config.js');
const { database, pledgeDB } = require('./database.js');
const stockAPI = require('./stock-api.js');
const gemini = require('./gemini.js');

// ========================================
// 初始化 LINE Bot
// ========================================

const bot = linebot({
  channelId: config.LINE.channelId,
  channelSecret: config.LINE.channelSecret,
  channelAccessToken: config.LINE.channelAccessToken,
});

// ========================================
// 訊息事件處理
// ========================================

bot.on('message', async function (event) {
  if (event.message.type !== 'text') return;

  const msg = event.message.text.trim();
  let replyMsg = '';

  try {
    // ========================================
    // 股票管理指令
    // ========================================

    // 新增股票
    if (msg.startsWith('add ')) {
      const parts = msg.split(' ');
      const symbol = parts[1];

      if (!symbol) {
        replyMsg = '❌ 請輸入股票代號\n範例：add 2330';
      } else {
        // 判斷市場（台股 4 碼，美股英文）
        const market = /^\d{4}$/.test(symbol) ? 'TW' : 'US';

        // 先查詢股票資訊確認有效
        await event.reply('⏳ 查詢股票資訊中...');
        const stockData = await stockAPI.getStock(symbol, market);

        if (!stockData) {
          await bot.push(event.source.userId, `❌ 找不到股票 ${symbol}，請確認代號是否正確`);
          return;
        }

        const result = await database.add(symbol, market, stockData.name);
        await bot.push(event.source.userId, result.message);
        return;
      }
    }

    // 刪除股票
    else if (msg.startsWith('del ')) {
      const symbol = msg.split(' ')[1];

      if (!symbol) {
        replyMsg = '❌ 請輸入股票代號\n範例：del 2330';
      } else {
        const result = await database.remove(symbol);
        replyMsg = result.message;
      }
    }

    // 顯示清單
    else if (msg === 'list') {
      const stocks = await database.getAll();

      if (stocks.length === 0) {
        replyMsg = '📋 追蹤清單是空的\n\n輸入 help 查看指令';
      } else {
        const stats = await database.getStats();
        let list = `📊 追蹤清單 (共 ${stats.total} 支)\n\n`;

        list += '🇹🇼 台股：\n';
        stocks
          .filter((s) => s.market === 'TW')
          .forEach((s) => {
            list += `  • ${s.symbol} ${s.name || ''}\n`;
          });

        list += '\n🇺🇸 美股：\n';
        stocks
          .filter((s) => s.market === 'US')
          .forEach((s) => {
            list += `  • ${s.symbol} ${s.name || ''}\n`;
          });

        replyMsg = list;
      }
    }

    // ========================================
    // 股票查詢與分析
    // ========================================

    // 即時查詢
    else if (msg.startsWith('info ')) {
      const symbol = msg.split(' ')[1].toUpperCase();
      const stockInfo = await database.get(symbol);

      if (!stockInfo) {
        replyMsg = `❌ ${symbol} 不在追蹤清單中\n請先用 add ${symbol} 新增`;
      } else {
        await event.reply('⏳ 查詢中...');

        const data = await stockAPI.getStock(symbol, stockInfo.market);

        if (!data) {
          await bot.push(event.source.userId, `❌ 無法取得 ${symbol} 資料`);
          return;
        }

        const direction = data.change > 0 ? '▲' : '▼';
        const chipText = data.chips
          ? `\n🌏 外資：${data.chips.foreign > 0 ? '+' : ''}${data.chips.foreign} 張\n🏢 投信：${data.chips.trust > 0 ? '+' : ''}${data.chips.trust} 張\n💼 自營：${data.chips.dealer > 0 ? '+' : ''}${data.chips.dealer} 張`
          : '';

        await bot.push(
          event.source.userId,
          `📊 ${data.symbol} ${data.name}\n\n` +
            `💰 ${data.price} ${direction}${Math.abs(data.change)} (${data.changePercent}%)\n` +
            `📈 成交量：${data.volume}${chipText}`
        );
        return;
      }
    }

    // 分析股票
    else if (msg.startsWith('analyze ')) {
      const symbol = msg.split(' ')[1].toUpperCase();
      const stockInfo = await database.get(symbol);

      if (!stockInfo) {
        replyMsg = `❌ ${symbol} 不在追蹤清單中`;
      } else {
        await event.reply('⏳ AI 分析中，請稍候...');

        const data = await stockAPI.getStock(symbol, stockInfo.market);

        if (!data) {
          await bot.push(event.source.userId, `❌ 無法取得 ${symbol} 資料`);
          return;
        }

        const analysis = await gemini.analyzeStock(data);

        const direction = data.change > 0 ? '▲' : '▼';
        await bot.push(
          event.source.userId,
          `📊 ${data.symbol} ${data.name}\n` +
            `💰 ${data.price} ${direction}${Math.abs(data.change)} (${data.changePercent}%)\n\n` +
            `🤖 AI 分析：\n${analysis}`
        );
        return;
      }
    }

    // 比較股票
    else if (msg.startsWith('compare ')) {
      const parts = msg.split(' ');
      if (parts.length < 3) {
        replyMsg = '❌ 請輸入兩支股票代號\n範例：compare 2330 2454';
      } else {
        const [, symbol1, symbol2] = parts;
        await event.reply('⏳ 比較分析中...');

        const [stock1, stock2] = await Promise.all([
          database.get(symbol1.toUpperCase()),
          database.get(symbol2.toUpperCase()),
        ]);

        if (!stock1 || !stock2) {
          await bot.push(event.source.userId, '❌ 請確認兩支股票都在追蹤清單中');
          return;
        }

        const [data1, data2] = await Promise.all([
          stockAPI.getStock(stock1.symbol, stock1.market),
          stockAPI.getStock(stock2.symbol, stock2.market),
        ]);

        if (!data1 || !data2) {
          await bot.push(event.source.userId, '❌ 無法取得股票資料');
          return;
        }

        const comparison = await gemini.compareStocks(data1, data2);
        await bot.push(event.source.userId, `🔍 比較分析\n\n${comparison}`);
        return;
      }
    }

    // ========================================
    // 質押管理
    // ========================================
    else if (msg.startsWith('pledge ')) {
      const parts = msg.split(' ');
      const action = parts[1];

      // pledge add 0050 10 473000 2026-01-01 2026-12-31 2.5 130
      if (action === 'add') {
        const [, , symbol, shares, borrowAmount, startDate, endDate, interestRate, warningRatio] =
          parts;
        if (
          !symbol ||
          !shares ||
          !borrowAmount ||
          !startDate ||
          !endDate ||
          !interestRate ||
          !warningRatio
        ) {
          replyMsg =
            '❌ 格式：pledge add [代號] [張數] [借款金額] [開始日] [到期日] [利率%] [警戒維持率%]\n範例：pledge add 0050 10 473000 2026-01-01 2026-12-31 2.5 130';
        } else {
          const result = await pledgeDB.add({
            symbol,
            shares,
            borrowAmount,
            startDate,
            endDate,
            interestRate,
            warningRatio,
          });
          replyMsg = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        }
      }

      // pledge list
      else if (action === 'list') {
        const pledges = await pledgeDB.getAll();
        if (pledges.length === 0) {
          replyMsg = '📋 目前沒有質押合約';
        } else {
          const today = new Date();
          let list = '🛡️ 質押合約清單\n\n';
          for (const p of pledges) {
            const daysLeft = Math.ceil((new Date(p.endDate) - today) / (1000 * 60 * 60 * 24));
            list += `【${p.symbol}】${p.shares}張 借${(p.borrowAmount / 10000).toFixed(1)}萬\n`;
            list += `  到期：${p.endDate}（剩 ${daysLeft} 天）\n`;
            list += `  利率：${p.interestRate}%　警戒：${p.warningRatio}%\n\n`;
          }
          replyMsg = list;
        }
      }

      // pledge del 0050
      else if (action === 'del') {
        const symbol = parts[2];
        if (!symbol) {
          replyMsg = '❌ 請輸入股票代號\n範例：pledge del 0050';
        } else {
          const result = await pledgeDB.remove(symbol);
          replyMsg = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
        }
      } else {
        replyMsg = '❌ 不認識的 pledge 指令\n輸入 help 查看說明';
      }
    }

    // 手動觸發每日報告
    else if (msg === 'report') {
      await event.reply('⏳ 生成報告中...');
      await sendDailyReport();
      return;
    }

    // AI 問答
    else if (msg.startsWith('ask ')) {
      const question = msg.substring(4);
      await event.reply('⏳ AI 思考中...');

      const answer = await gemini.ask(event.source.userId, question);
      await bot.push(event.source.userId, `🤖 ${answer}`);
      return;
    }

    // ========================================
    // 說明與其他
    // ========================================
    else if (msg === 'help') {
      replyMsg = `📖 指令說明

【股票管理】
add [代號] - 新增追蹤
del [代號] - 移除追蹤
list - 顯示清單

【查詢分析】
info [代號] - 即時資訊
analyze [代號] - AI 分析
compare [代號1] [代號2] - 比較
report - 每日報告

【質押管理】
pledge add [代號] [張數] [借款] [開始日] [到期日] [利率%] [警戒%]
pledge list - 顯示質押清單
pledge del [代號] - 刪除質押

【AI 問答】
ask [問題] - 詢問 AI

範例：
add 2330
pledge add 0050 10 473000 2026-01-01 2026-12-31 2.5 130
ask 台積電適合買嗎？`;
    } else {
      replyMsg = '❓ 不認識的指令\n輸入 help 查看說明';
    }

    if (replyMsg) {
      await event.reply(replyMsg);
    }
  } catch (error) {
    console.error('處理訊息錯誤:', error);
    await event.reply('❌ 系統錯誤，請稍後再試');
  }
});

// ========================================
// 每日報告生成
// ========================================

async function sendDailyReport(market = null) {
  const allStocks = await database.getAll();
  const stocks = market ? allStocks.filter((s) => s.market === market) : allStocks;

  if (stocks.length === 0) {
    console.log(`追蹤清單是空的（${market ?? '全部'}），跳過推播`);
    return;
  }

  try {
    const stocksData = await stockAPI.getStocks(stocks);

    if (stocksData.length === 0) {
      console.log('無法取得股票資料');
      return;
    }

    const dateStr = new Date().toLocaleDateString('zh-TW');

    // 標題訊息
    await bot.push(config.LINE.userId, `📊 ${dateStr} 收盤報告（共 ${stocksData.length} 支）`);

    // 每支股票：行情資料 + 個別 AI 分析
    for (const data of stocksData) {
      const direction = data.change > 0 ? '▲' : '▼';

      let msg = `【${data.symbol} ${data.name}】\n`;
      msg += `💰 ${data.price} ${direction}${Math.abs(data.change)} (${data.changePercent}%)\n`;

      if (data.chips) {
        msg += `🌏 外資：${data.chips.foreign > 0 ? '+' : ''}${data.chips.foreign} 張\n`;
        msg += `🏢 投信：${data.chips.trust > 0 ? '+' : ''}${data.chips.trust} 張\n`;
        msg += `💼 自營：${data.chips.dealer > 0 ? '+' : ''}${data.chips.dealer} 張\n`;
      }

      if (data.monthRevenue?.length) {
        const latest = data.monthRevenue[0];
        msg += `📈 月營收：${latest.month} ${(latest.revenue / 1e8).toFixed(2)} 億`;
        if (latest.mom !== null) msg += `（月增 ${latest.mom}%）`;
        msg += '\n';
      }

      if (data.valuation) {
        const v = data.valuation;
        msg += `📐 PER ${v.per ?? 'N/A'}｜PBR ${v.pbr ?? 'N/A'}｜殖利率 ${v.dividendYield ?? 'N/A'}%\n`;
      }

      await bot.push(config.LINE.userId, msg.trim());

      // 個別 AI 分析
      try {
        const analysis = await gemini.analyzeStock(data);
        await bot.push(config.LINE.userId, `🤖 ${data.symbol} 分析：\n${analysis}`);
      } catch (e) {
        console.error(`${data.symbol} AI 分析失敗:`, e.message);
      }
    }

    // 質押狀態
    try {
      const pledgeSection = await buildPledgeSection();
      if (pledgeSection) {
        await bot.push(config.LINE.userId, pledgeSection);
      }
    } catch (e) {
      console.error('質押狀態推送失敗:', e.message);
    }

    console.log('✅ 每日報告已推送');
  } catch (error) {
    console.error('生成每日報告失敗:', error);
  }
}

async function buildPledgeSection() {
  const pledges = await pledgeDB.getAll();
  if (pledges.length === 0) return null;

  const today = new Date();
  let section = '🛡️ 質押狀態\n\n';
  const warnings = [];

  for (const p of pledges) {
    const stockData = await stockAPI.getStock(p.symbol, p.market);
    if (!stockData) continue;

    const price = stockData.price;
    const maintenanceRatio = (((price * p.shares * 1000) / p.borrowAmount) * 100).toFixed(1);
    const breakPrice = ((p.borrowAmount / (p.shares * 1000)) * (p.warningRatio / 100)).toFixed(1);
    const cushion = (price - breakPrice).toFixed(1);

    const light = maintenanceRatio >= 200 ? '🟢' : maintenanceRatio >= 150 ? '🟡' : '🔴';
    if (maintenanceRatio < 150)
      warnings.push(`⚠️ ${p.symbol} 維持率偏低（${maintenanceRatio}%），請注意補繳風險`);

    section += `【${p.symbol}】${p.shares}張 借${(p.borrowAmount / 10000).toFixed(1)}萬\n`;
    section += `股價：${price} → 維持率：${maintenanceRatio}% ${light}\n`;
    section += `安全墊：${cushion} 元（跌至 ${breakPrice} 需補錢）\n`;

    // 到期提醒
    const daysToExpiry = Math.ceil((new Date(p.endDate) - today) / (1000 * 60 * 60 * 24));
    if (daysToExpiry <= 7) {
      section += `⚠️ 合約將於 ${p.endDate} 到期（剩 ${daysToExpiry} 天）\n`;
    }

    // 除息提醒
    if (p.exDividendDate) {
      const daysToExDiv = Math.ceil((new Date(p.exDividendDate) - today) / (1000 * 60 * 60 * 24));
      if (daysToExDiv >= 0 && daysToExDiv <= 3) {
        section += `💰 除息日倒數 ${daysToExDiv} 天（${p.exDividendDate}）`;
        if (p.estimatedDividend) section += ` 預估股利 ${p.estimatedDividend} 元`;
        section += '\n';
      }
    }

    section += '\n';
  }

  if (warnings.length > 0) {
    section += warnings.join('\n');
  }

  return section.trim();
}

// ========================================
// 啟動 Bot 服務
// ========================================

if (require.main === module) {
  bot.listen('/', process.env.PORT || 5000, function () {
    console.log('📈 Stock Notify Bot 上線！');
  });
}

// 導出 bot 和 sendDailyReport（給 scheduler 用）
module.exports = { bot, sendDailyReport };
