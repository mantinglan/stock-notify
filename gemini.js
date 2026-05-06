const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config.js');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Gem 角色定義：資深股票研究分析師
const SYSTEM_INSTRUCTION = `
扮演一位資深股票研究分析師。 你的任務是編寫一份關於[Company Name]（股票代碼：[Ticker Symbol]）的綜合投資分析報告。
該報告應詳細、客觀且以數據為導向，使用過去五個完整財政年度和最近十二個月（TTM）的財務數據。

使用以下部分來構建您的報告：

1. 執行摘要：
   - 簡要概述公司的業務。
   - 用 2-3 句話陳述您的整體投資論點。 以目前的估值來看，是買入、持有還是賣出？
   - 總結主要的積極催化劑和主要風險。

2. 財務表現與健康狀況：
   - 損益表分析：分析過去 5 年 + TTM 的收入增長、毛利率、營業利潤率和淨利潤率趨勢。
   - 資產負債表分析：評估公司的債務水平、債務權益比率、流動比率和現金狀況。 資產負債表是強勁還是疲軟？
   - 現金流量分析：分析經營現金流量、資本支出和自由現金流量 (FCF) 的產生。 該公司是否持續 FCF 為正？

3. 估值：
   - 倍數分析：將公司的當前市盈率、市銷率、市淨率和企業價值/EBITDA 比率與以下內容進行比較：
     - 其自身的 5 年歷史平均值。
     - 行業平均值。
     - 其前 3 名直接競爭對手：[Competitor A]、[Competitor B] 和 [Competitor C]。
   - 結論：基於此分析，得出股票是高估、低估還是合理定價的結論。

4. 商業模式與競爭護城河：
   - 業務部門：簡要描述公司的核心業務部門及其對收入的貢獻。
   - 經濟護城河：確定並解釋其競爭優勢的來源（例如，品牌、專利、網絡效應、成本領先地位）。 評估這條護城河的耐用性和強度。

5. 增長策略與未來展望：
   - 增長動力：確定預計將推動未來增長的主要催化劑（例如，新產品、市場擴張、行業趨勢）。
   - 市場機會：分析總體潛在市場 (TAM) 以及公司佔據更大市場份額的潛力。

6. 管理與治理：
   - 領導力：簡要概述首席執行官和高級管理團隊。 評論他們的任期和業績記錄。
   - 資本配置：評估管理層在配置資本方面的有效性。 審查他們關於股息、股票回購和併購活動的政策。
   - 內部人持股：注意內部人持股的水平。

7. 風險分析：
   - 特殊風險：公司特有的前 3 大風險是什麼（例如，產品故障、關鍵人物風險、訴訟）？
   - 系統性風險：前 3 大外部風險是什麼（例如，經濟衰退、監管變化、競爭性破壞）？

8. 最終建議：
   - 將以上所有要點綜合成最終的投資結論。 重申您的買入/持有/賣出評級，並根據當前價格的機會和風險的平衡，給出簡潔的理由。
`.trim();

const model = genAI.getGenerativeModel({
  model: config.GEMINI_MODEL,
  systemInstruction: SYSTEM_INSTRUCTION,
});

// 每個用戶獨立的對話 session（用於 ask 指令）
const chatSessions = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 小時

function getChat(userId) {
  const now = Date.now();
  const existing = chatSessions.get(userId);

  if (existing && now - existing.lastUsed < SESSION_TTL) {
    existing.lastUsed = now;
    return existing.chat;
  }

  const chat = model.startChat({ history: [] });
  chatSessions.set(userId, { chat, lastUsed: now });
  return chat;
}

// 每小時清除過期 session
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of chatSessions) {
    if (now - session.lastUsed >= SESSION_TTL) {
      chatSessions.delete(userId);
    }
  }
}, SESSION_TTL);

class GeminiAnalyzer {
  // ========================================
  // 分析單支股票（仿 Gem 報告格式，適合 LINE 長度）
  // ========================================

  async analyzeStock(stockData) {
    const prompt = this.buildAnalyzePrompt(stockData);
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini 分析失敗:', error.message);
      return '⚠️ AI 分析暫時無法使用';
    }
  }

  buildAnalyzePrompt(stock) {
    const direction = stock.change > 0 ? '▲' : '▼';
    const chipText = stock.chips
      ? `外資：${stock.chips.foreign > 0 ? '+' : ''}${stock.chips.foreign} 張｜投信：${stock.chips.trust > 0 ? '+' : ''}${stock.chips.trust} 張｜自營：${stock.chips.dealer > 0 ? '+' : ''}${stock.chips.dealer} 張`
      : '（無籌碼資料）';

    const isTW = /^\d{4}$/.test(stock.symbol);

    let revenueText = '';
    if (isTW && stock.monthRevenue?.length) {
      const rows = stock.monthRevenue
        .map(
          (r) =>
            `${r.month} 營收 ${(r.revenue / 1e8).toFixed(2)} 億${r.mom !== null ? `（月增 ${r.mom}%）` : ''}`
        )
        .join('｜');
      revenueText = `近期月營收：${rows}`;
    }

    let valuationText = '';
    if (isTW && stock.valuation) {
      const v = stock.valuation;
      valuationText = `估值：本益比 ${v.per ?? 'N/A'}｜股價淨值比 ${v.pbr ?? 'N/A'}｜殖利率 ${v.dividendYield ?? 'N/A'}%`;
    } else if (!isTW && stock.overview) {
      const o = stock.overview;
      const parts = [
        o.per ? `本益比 ${o.per}` : null,
        o.forwardPE ? `Forward PE ${o.forwardPE}` : null,
        o.pbr ? `PBR ${o.pbr}` : null,
        o.dividendYield ? `殖利率 ${o.dividendYield}%` : null,
        o.eps ? `EPS $${o.eps}` : null,
        o.epsGrowthYOY ? `EPS YoY ${o.epsGrowthYOY}%` : null,
        o.revenueGrowthYOY ? `營收 YoY ${o.revenueGrowthYOY}%` : null,
        o.analystTarget ? `分析師目標價 $${o.analystTarget}` : null,
      ]
        .filter(Boolean)
        .join('｜');
      valuationText = parts ? `估值：${parts}` : '';
    }

    let earningsText = '';
    if (!isTW && stock.earnings?.length) {
      const rows = stock.earnings
        .map((q) => {
          const beat =
            q.surprise > 0
              ? `超預期 +${q.surprise.toFixed(1)}%`
              : `低於預期 ${q.surprise.toFixed(1)}%`;
          return `${q.quarter} EPS $${q.reported}（預估 $${q.estimated}，${beat}）`;
        })
        .join('\n');
      earningsText = `近期季報：\n${rows}`;
    }

    let techText = '';
    if (stock.technicals) {
      const t = stock.technicals;
      const price = stock.price;
      const maStatus = [
        t.ma5 ? `MA5 ${t.ma5}（${price > t.ma5 ? '上方' : '下方'}）` : null,
        t.ma20 ? `MA20 ${t.ma20}（${price > t.ma20 ? '上方' : '下方'}）` : null,
        t.ma60 ? `MA60 ${t.ma60}（${price > t.ma60 ? '上方' : '下方'}）` : null,
      ]
        .filter(Boolean)
        .join('｜');
      const rsiStatus =
        t.rsi14 !== null
          ? `RSI(14) ${t.rsi14}${t.rsi14 >= 70 ? '（超買）' : t.rsi14 <= 30 ? '（超賣）' : ''}`
          : '';
      techText = `技術指標：${maStatus}${rsiStatus ? `　${rsiStatus}` : ''}`;
    }

    const marketHint = isTW
      ? '⚠️ 此為台股：請結合月營收趨勢、估值與技術指標，綜合判斷成長動能與進出場時機。'
      : '⚠️ 此為美股：請結合技術指標與季報指引（EPS/營收 Guidance），判斷趨勢與進出場時機。';

    return `請針對以下股票，依照研究報告格式給出分析：

【股票資訊】
代號：${stock.symbol}　名稱：${stock.name}
收盤：${stock.price} ${direction}${Math.abs(stock.change)} (${stock.changePercent}%)
成交量：${stock.volume}
今日籌碼：${chipText}${revenueText ? `\n${revenueText}` : ''}${valuationText ? `\n${valuationText}` : ''}${earningsText ? `\n${earningsText}` : ''}${techText ? `\n${techText}` : ''}

${marketHint}

請依以下順序回覆（每段 2-3 句，總長控制在 350 字內）：
⚠️ 請勿使用任何 Markdown 語法（不要用 **粗體**、*斜體*、# 標題、- 列表等），直接輸出純文字。

1️⃣ 執行摘要：整體投資論點 + 買入/持有/賣出評級
2️⃣ 籌碼與短期趨勢：法人動向解讀
3️⃣ 技術面：均線多空排列、RSI 位置解讀
4️⃣ 基本面亮點（台股請結合月營收與估值；美股請結合季報指引）
5️⃣ 主要風險：1-2 個最需注意的風險
6️⃣ 操作建議：具體進出場參考`;
  }

  // ========================================
  // 每日報告（仿 Gem 投資組合分析）
  // ========================================

  async analyzeDailyReport(stocksData) {
    const prompt = this.buildDailyReportPrompt(stocksData);
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini 每日報告失敗:', error.message);
      return '⚠️ AI 報告暫時無法使用';
    }
  }

  buildDailyReportPrompt(stocks) {
    const stockList = stocks
      .map((s) => {
        const direction = s.change > 0 ? '▲' : '▼';
        const isTW = /^\d{4}$/.test(s.symbol);

        const chips = s.chips
          ? `\n   外資：${s.chips.foreign > 0 ? '+' : ''}${s.chips.foreign} 張｜投信：${s.chips.trust > 0 ? '+' : ''}${s.chips.trust} 張`
          : '\n   （無籌碼資料）';

        let extra = '';
        if (isTW && s.monthRevenue?.length) {
          const latest = s.monthRevenue[0];
          extra += `\n   月營收：${latest.month} ${(latest.revenue / 1e8).toFixed(2)} 億${latest.mom !== null ? `（月增 ${latest.mom}%）` : ''}`;
        }
        if (isTW && s.valuation) {
          const v = s.valuation;
          extra += `\n   估值：PER ${v.per ?? 'N/A'}｜PBR ${v.pbr ?? 'N/A'}｜殖利率 ${v.dividendYield ?? 'N/A'}%`;
        }
        if (!isTW && s.overview) {
          const o = s.overview;
          const parts = [
            o.per ? `PER ${o.per}` : null,
            o.forwardPE ? `FwdPE ${o.forwardPE}` : null,
            o.epsGrowthYOY ? `EPS YoY ${o.epsGrowthYOY}%` : null,
            o.revenueGrowthYOY ? `營收 YoY ${o.revenueGrowthYOY}%` : null,
          ]
            .filter(Boolean)
            .join('｜');
          if (parts) extra += `\n   基本面：${parts}`;
        }
        if (!isTW && s.earnings?.length) {
          const q = s.earnings[0];
          const beat =
            q.surprise > 0
              ? `超預期 +${q.surprise.toFixed(1)}%`
              : `低於預期 ${q.surprise.toFixed(1)}%`;
          extra += `\n   最新季報：${q.quarter} EPS $${q.reported}（${beat}）`;
        }
        if (s.technicals) {
          const t = s.technicals;
          const maLine = [
            t.ma20 ? `MA20 ${t.ma20}（${s.price > t.ma20 ? '上方' : '下方'}）` : null,
            t.ma60 ? `MA60 ${t.ma60}（${s.price > t.ma60 ? '上方' : '下方'}）` : null,
          ]
            .filter(Boolean)
            .join('｜');
          const rsiLine = t.rsi14 !== null ? `RSI ${t.rsi14}` : '';
          extra += `\n   技術：${maLine}${rsiLine ? `　${rsiLine}` : ''}`;
        }

        return `${s.symbol} ${s.name}：${s.price} ${direction}${Math.abs(s.change)} (${s.changePercent}%)${chips}${extra}`;
      })
      .join('\n');

    return `以下是今日投資組合的收盤表現、三大法人籌碼與基本面資料，請給出綜合分析報告：

【今日持股】
${stockList}

請依以下順序回覆（總長控制在 400 字內）：
⚠️ 請勿使用任何 Markdown 語法（不要用 **粗體**、*斜體*、# 標題、- 列表等），直接輸出純文字。

1️⃣ 籌碼面總結：外資與投信今日整體動向，是買超還是賣超，代表什麼訊號
2️⃣ 個股籌碼亮點：哪支股票的法人動向最值得關注，為什麼
3️⃣ 基本面觀察（台股）：月營收趨勢是否支撐股價？估值是否合理？
4️⃣ 警訊：若有外資或投信持續賣超、或估值過高的股票，點名並說明風險
5️⃣ 明日操作建議：根據籌碼面與基本面，各股持有/加碼/減碼/觀望`;
  }

  // ========================================
  // 比較分析
  // ========================================

  async compareStocks(stock1, stock2) {
    const prompt = `請以資深分析師角度比較以下兩支股票，判斷哪支目前更值得配置：

【股票 A】${stock1.symbol} ${stock1.name}：${stock1.price} (${stock1.changePercent}%)
【股票 B】${stock2.symbol} ${stock2.name}：${stock2.price} (${stock2.changePercent}%)

依序分析：護城河比較、短期動能、風險差異，最後給出明確推薦。150 字內。`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Gemini 比較分析失敗:', error.message);
      return '⚠️ 比較分析暫時無法使用';
    }
  }

  // ========================================
  // 有記憶的 AI 問答（對話模式）
  // ========================================

  async ask(userId, question) {
    const chat = getChat(userId);
    try {
      const result = await chat.sendMessage(question);
      return result.response.text();
    } catch (error) {
      console.error('Gemini 問答失敗:', error.message);
      return '⚠️ AI 問答暫時無法使用';
    }
  }

  // 清除該用戶的對話記憶
  clearChat(userId) {
    chatSessions.delete(userId);
  }

  getChatCount() {
    return chatSessions.size;
  }
}

module.exports = new GeminiAnalyzer();
