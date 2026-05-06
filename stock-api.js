const axios = require('axios');
const config = require('./config.js');

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';

class StockAPI {
  // ========================================
  // 台股行情（Yahoo Finance）
  // ========================================

  async _fetchYahooTW(ticker) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const response = await axios.get(url);
    const result = response.data.chart.result;
    if (!result?.length) throw new Error('No data');
    return result[0];
  }

  async getTWStock(symbol) {
    try {
      // 上市用 .TW，上櫃用 .TWO，自動偵測
      let result;
      try {
        result = await this._fetchYahooTW(`${symbol}.TW`);
      } catch {
        result = await this._fetchYahooTW(`${symbol}.TWO`);
      }

      const quote = result.meta;
      const indicators = result.indicators.quote[0];

      return {
        symbol,
        name: quote.longName || symbol,
        price: quote.regularMarketPrice,
        change: parseFloat((quote.regularMarketPrice - quote.previousClose).toFixed(2)),
        changePercent: (
          ((quote.regularMarketPrice - quote.previousClose) / quote.previousClose) *
          100
        ).toFixed(2),
        volume: indicators.volume[indicators.volume.length - 1],
        open: quote.regularMarketOpen,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        previousClose: quote.previousClose,
      };
    } catch (error) {
      console.error(`取得 ${symbol} 台股資料失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 三大法人買賣超（FinMind）
  // ========================================

  async getTWChips(symbol) {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const response = await axios.get(FINMIND_URL, {
        params: {
          dataset: 'TaiwanStockInstitutionalInvestorsBuySell',
          data_id: symbol,
          start_date: dateStr,
          end_date: dateStr,
          token: config.FINMIND_TOKEN || '',
        },
      });

      if (!response.data.data?.length) return null;

      const rows = response.data.data;
      const find = (name) => rows.find((r) => r.name === name);

      const foreign = find('Foreign_Investor');
      const trust = find('Investment_Trust');
      const dealerSelf = find('Dealer_self');
      const dealerHedge = find('Dealer_Hedging');

      return {
        foreign: foreign ? Math.round((foreign.buy - foreign.sell) / 1000) : 0,
        trust: trust ? Math.round((trust.buy - trust.sell) / 1000) : 0,
        dealer: Math.round(
          ((dealerSelf?.buy ?? 0) -
            (dealerSelf?.sell ?? 0) +
            (dealerHedge?.buy ?? 0) -
            (dealerHedge?.sell ?? 0)) /
            1000
        ),
      };
    } catch (error) {
      console.error(`取得 ${symbol} 籌碼面資料失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 月營收（FinMind）— 近 3 個月趨勢
  // ========================================

  async getTWMonthRevenue(symbol) {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 4);

      const response = await axios.get(FINMIND_URL, {
        params: {
          dataset: 'TaiwanStockMonthRevenue',
          data_id: symbol,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          token: config.FINMIND_TOKEN || '',
        },
      });

      if (!response.data.data?.length) return null;

      // 依日期排序，取最新 3 筆
      const rows = response.data.data.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

      return rows.map((r, i) => {
        const prev = rows[i + 1];
        const mom = prev ? (((r.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1) : null;
        return {
          month: `${r.revenue_year}/${String(r.revenue_month).padStart(2, '0')}`,
          revenue: r.revenue,
          mom, // 月增率 %
        };
      });
    } catch (error) {
      console.error(`取得 ${symbol} 月營收失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 本益比、股價淨值比、殖利率（FinMind）
  // ========================================

  async getTWValuation(symbol) {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const start = new Date();
      start.setDate(start.getDate() - 5); // 往前 5 天確保有資料

      const response = await axios.get(FINMIND_URL, {
        params: {
          dataset: 'TaiwanStockPER',
          data_id: symbol,
          start_date: start.toISOString().split('T')[0],
          end_date: dateStr,
          token: config.FINMIND_TOKEN || '',
        },
      });

      if (!response.data.data?.length) return null;

      const latest = response.data.data.at(-1);
      return {
        per: latest.PER,
        pbr: latest.PBR,
        dividendYield: latest.dividend_yield,
      };
    } catch (error) {
      console.error(`取得 ${symbol} 估值資料失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 技術指標（Yahoo Finance 歷史 K 線）
  // ========================================

  async getTechnicals(symbol, market) {
    try {
      let response;
      if (market === 'TW') {
        try {
          response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=3mo&interval=1d`);
          if (!response.data.chart.result) throw new Error('No data');
        } catch {
          response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TWO?range=3mo&interval=1d`);
        }
      } else {
        response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`);
      }

      const closes = response.data.chart.result[0].indicators.quote[0].close.filter(
        (v) => v !== null
      );

      if (closes.length < 20) return null;

      const ma = (n) => parseFloat((closes.slice(-n).reduce((a, b) => a + b, 0) / n).toFixed(2));

      const ma5 = closes.length >= 5 ? ma(5) : null;
      const ma20 = closes.length >= 20 ? ma(20) : null;
      const ma60 = closes.length >= 60 ? ma(60) : null;

      // RSI(14)：取最近 15 筆計算 14 期漲跌均值
      let rsi14 = null;
      if (closes.length >= 15) {
        const changes = closes
          .slice(-15)
          .map((v, i, arr) => (i > 0 ? v - arr[i - 1] : 0))
          .slice(1);
        const avgGain = changes.filter((c) => c > 0).reduce((a, b) => a + b, 0) / 14;
        const avgLoss =
          changes
            .filter((c) => c < 0)
            .map((c) => -c)
            .reduce((a, b) => a + b, 0) / 14;
        rsi14 = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
      }

      return { ma5, ma20, ma60, rsi14 };
    } catch (error) {
      console.error(`取得 ${symbol} 技術指標失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 美股行情（Yahoo Finance）
  // ========================================

  async getUSStock(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const response = await axios.get(url);

      const result = response.data.chart.result[0];
      const meta = result.meta;
      const indicators = result.indicators.quote[0];

      return {
        symbol,
        name: meta.longName || symbol,
        price: meta.regularMarketPrice,
        change: parseFloat((meta.regularMarketPrice - meta.previousClose).toFixed(2)),
        changePercent: (
          ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) *
          100
        ).toFixed(2),
        volume: indicators.volume[indicators.volume.length - 1],
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        previousClose: meta.previousClose,
      };
    } catch (error) {
      console.error(`取得 ${symbol} 美股資料失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 美股基本面（Alpha Vantage OVERVIEW）
  // ========================================

  async getUSOverview(symbol) {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: config.ALPHA_VANTAGE_KEY,
        },
      });

      const d = response.data;
      if (!d.Symbol) return null;

      return {
        name: d.Name,
        sector: d.Sector,
        per: parseFloat(d.TrailingPE) || null,
        forwardPE: parseFloat(d.ForwardPE) || null,
        pbr: parseFloat(d.PriceToBookRatio) || null,
        dividendYield:
          d.DividendYield !== 'None' ? (parseFloat(d.DividendYield) * 100).toFixed(2) : null,
        eps: parseFloat(d.EPS) || null,
        analystTarget: parseFloat(d.AnalystTargetPrice) || null,
        epsGrowthYOY:
          d.QuarterlyEarningsGrowthYOY !== 'None'
            ? (parseFloat(d.QuarterlyEarningsGrowthYOY) * 100).toFixed(1)
            : null,
        revenueGrowthYOY:
          d.QuarterlyRevenueGrowthYOY !== 'None'
            ? (parseFloat(d.QuarterlyRevenueGrowthYOY) * 100).toFixed(1)
            : null,
      };
    } catch (error) {
      console.error(`取得 ${symbol} 美股基本面失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 美股季報 EPS（Alpha Vantage EARNINGS）
  // ========================================

  async getUSEarnings(symbol) {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'EARNINGS',
          symbol,
          apikey: config.ALPHA_VANTAGE_KEY,
        },
      });

      const quarters = response.data.quarterlyEarnings;
      if (!quarters?.length) return null;

      // 取最近 2 季
      return quarters.slice(0, 2).map((q) => ({
        quarter: q.fiscalDateEnding,
        reported: parseFloat(q.reportedEPS),
        estimated: parseFloat(q.estimatedEPS),
        surprise: parseFloat(q.surprisePercentage),
      }));
    } catch (error) {
      console.error(`取得 ${symbol} 季報失敗:`, error.message);
      return null;
    }
  }

  // ========================================
  // 統一介面
  // ========================================

  async getStock(symbol, market) {
    if (market === 'TW') {
      const [stock, chips, monthRevenue, valuation, technicals] = await Promise.all([
        this.getTWStock(symbol),
        this.getTWChips(symbol),
        this.getTWMonthRevenue(symbol),
        this.getTWValuation(symbol),
        this.getTechnicals(symbol, market),
      ]);

      return stock ? { ...stock, chips, monthRevenue, valuation, technicals } : null;
    } else if (market === 'US') {
      const [stock, overview, earnings, technicals] = await Promise.all([
        this.getUSStock(symbol),
        this.getUSOverview(symbol),
        this.getUSEarnings(symbol),
        this.getTechnicals(symbol, market),
      ]);

      if (!stock) return null;
      // overview 可補全 name
      const name = overview?.name || stock.name;
      return { ...stock, name, overview, earnings, technicals };
    }

    return null;
  }

  async getStocks(stockList) {
    const results = await Promise.all(stockList.map((s) => this.getStock(s.symbol, s.market)));
    return results.filter((r) => r !== null);
  }
}

module.exports = new StockAPI();
