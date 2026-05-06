const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} = require('firebase/firestore');
const config = require('./config.js');

const app = initializeApp(config.FIREBASE);
const db = getFirestore(app);

// ========================================
// Watchlist
// ========================================

class WatchlistDB {
  async getAll() {
    const snapshot = await getDocs(collection(db, 'watchlist'));
    return snapshot.docs.map((d) => d.data());
  }

  async add(symbol, market, name = '') {
    const sym = symbol.toUpperCase();
    const ref = doc(db, 'watchlist', sym);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      return { success: false, message: `${sym} 已在追蹤清單中` };
    }

    await setDoc(ref, {
      symbol: sym,
      market: market.toUpperCase(),
      name,
      createdAt: new Date().toISOString(),
    });

    return { success: true, message: `已新增 ${sym} 到追蹤清單` };
  }

  async remove(symbol) {
    const sym = symbol.toUpperCase();
    const ref = doc(db, 'watchlist', sym);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
      return { success: false, message: `${sym} 不在追蹤清單中` };
    }

    await deleteDoc(ref);
    return { success: true, message: `已移除 ${sym}` };
  }

  async get(symbol) {
    const ref = doc(db, 'watchlist', symbol.toUpperCase());
    const d = await getDoc(ref);
    return d.exists() ? d.data() : null;
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
    const snapshot = await getDocs(collection(db, 'pledges'));
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
    const ref = doc(db, 'pledges', sym);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      return { success: false, message: `${sym} 已有質押合約，請先刪除再新增` };
    }

    await setDoc(ref, {
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
    const ref = doc(db, 'pledges', sym);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
      return { success: false, message: `${sym} 沒有質押合約` };
    }

    await deleteDoc(ref);
    return { success: true, message: `已刪除 ${sym} 質押合約` };
  }

  async get(symbol) {
    const ref = doc(db, 'pledges', symbol.toUpperCase());
    const d = await getDoc(ref);
    return d.exists() ? d.data() : null;
  }
}

module.exports = {
  database: new WatchlistDB(),
  pledgeDB: new PledgeDB(),
};
