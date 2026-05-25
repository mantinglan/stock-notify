const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ========================================
// Watchlist
// ========================================

class WatchlistDB {
  async getAll() {
    const snapshot = await db.collection('watchlist').get();
    return snapshot.docs.map((d) => d.data());
  }

  async add(symbol, market, name = '') {
    const sym = symbol.toUpperCase();
    const ref = db.collection('watchlist').doc(sym);
    const existing = await ref.get();

    if (existing.exists) {
      return { success: false, message: `${sym} 已在追蹤清單中` };
    }

    await ref.set({
      symbol: sym,
      market: market.toUpperCase(),
      name,
      createdAt: new Date().toISOString(),
    });

    return { success: true, message: `已新增 ${sym} 到追蹤清單` };
  }

  async remove(symbol) {
    const sym = symbol.toUpperCase();
    const ref = db.collection('watchlist').doc(sym);
    const existing = await ref.get();

    if (!existing.exists) {
      return { success: false, message: `${sym} 不在追蹤清單中` };
    }

    await ref.delete();
    return { success: true, message: `已移除 ${sym}` };
  }

  async get(symbol) {
    const snap = await db.collection('watchlist').doc(symbol.toUpperCase()).get();
    return snap.exists ? snap.data() : null;
  }

  async getStats() {
    const stocks = await this.getAll();
    return {
      total: stocks.length,
      tw: stocks.filter((s) => s.market === 'TW').length,
      us: stocks.filter((s) => s.market === 'US').length,
    };
  }
}

// ========================================
// Pledges
// ========================================

class PledgeDB {
  async getAll() {
    const snapshot = await db.collection('pledges').get();
    return snapshot.docs.map((d) => d.data());
  }

  async add({
    symbol,
    shares,
    borrowAmount,
    startDate,
    endDate,
    interestRate,
    warningRatio,
    exDividendDate,
    estimatedDividend,
  }) {
    const sym = symbol.toUpperCase();
    const ref = db.collection('pledges').doc(sym);
    const existing = await ref.get();

    if (existing.exists) {
      return { success: false, message: `${sym} 已有質押合約，請先刪除再新增` };
    }

    await ref.set({
      symbol: sym,
      market: /^\d{4}$/.test(sym) ? 'TW' : 'US',
      shares: Number(shares),
      borrowAmount: Number(borrowAmount),
      startDate,
      endDate,
      interestRate: Number(interestRate),
      warningRatio: Number(warningRatio),
      exDividendDate: exDividendDate || null,
      estimatedDividend: estimatedDividend ? Number(estimatedDividend) : null,
      createdAt: new Date().toISOString(),
    });

    return { success: true, message: `已新增 ${sym} 質押合約` };
  }

  async remove(symbol) {
    const sym = symbol.toUpperCase();
    const ref = db.collection('pledges').doc(sym);
    const existing = await ref.get();

    if (!existing.exists) {
      return { success: false, message: `${sym} 沒有質押合約` };
    }

    await ref.delete();
    return { success: true, message: `已刪除 ${sym} 質押合約` };
  }

  async get(symbol) {
    const snap = await db.collection('pledges').doc(symbol.toUpperCase()).get();
    return snap.exists ? snap.data() : null;
  }
}

module.exports = {
  database: new WatchlistDB(),
  pledgeDB: new PledgeDB(),
};
