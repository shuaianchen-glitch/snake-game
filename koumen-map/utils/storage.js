const { SEED_SHOPS, enrichShop } = require('./data');

const SHOPS_KEY = 'koumen_shops';
const REPORTS_KEY = 'koumen_reports';
const VERIFICATIONS_KEY = 'koumen_verifications';

function mergeShops() {
  const userShops = wx.getStorageSync(SHOPS_KEY) || [];
  const seedIds = new Set(SEED_SHOPS.map((s) => s.id));
  const merged = [
    ...SEED_SHOPS.map(enrichShop),
    ...userShops.filter((s) => !seedIds.has(s.id)).map(enrichShop),
  ];
  return merged;
}

function getShopById(id) {
  return mergeShops().find((s) => s.id === id) || null;
}

function saveShop(shop) {
  const userShops = wx.getStorageSync(SHOPS_KEY) || [];
  const idx = userShops.findIndex((s) => s.id === shop.id);
  const enriched = enrichShop(shop);
  if (idx >= 0) {
    userShops[idx] = enriched;
  } else {
    userShops.unshift(enriched);
  }
  wx.setStorageSync(SHOPS_KEY, userShops);
  return enriched;
}

function verifyPrice(shopId, itemIndex) {
  const shop = getShopById(shopId);
  if (!shop || !shop.items[itemIndex]) return null;

  const key = `${shopId}:${itemIndex}`;
  const verifications = wx.getStorageSync(VERIFICATIONS_KEY) || {};
  if (verifications[key]) {
    return { already: true, shop };
  }

  verifications[key] = Date.now();
  wx.setStorageSync(VERIFICATIONS_KEY, verifications);

  shop.items[itemIndex].verifiedCount = (shop.items[itemIndex].verifiedCount || 0) + 1;
  shop.items[itemIndex].lastVerifiedAt = formatDate(new Date());

  if (shop.source !== 'seed') {
    saveShop(shop);
  } else {
    const userShops = wx.getStorageSync(SHOPS_KEY) || [];
    const override = userShops.find((s) => s.id === shopId);
    if (override) {
      override.items = shop.items;
      saveShop(override);
    } else {
      saveShop({ ...shop, source: 'verified_seed' });
    }
  }

  return { already: false, shop: getShopById(shopId) };
}

function reportShop(shopId, type, note) {
  const reports = wx.getStorageSync(REPORTS_KEY) || [];
  reports.unshift({
    shopId,
    type,
    note,
    createdAt: new Date().toISOString(),
  });
  wx.setStorageSync(REPORTS_KEY, reports);
}

function getUserStats() {
  const userShops = wx.getStorageSync(SHOPS_KEY) || [];
  const verifications = wx.getStorageSync(VERIFICATIONS_KEY) || {};
  const reports = wx.getStorageSync(REPORTS_KEY) || [];
  return {
    submitCount: userShops.length,
    verifyCount: Object.keys(verifications).length,
    reportCount: reports.length,
  };
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

module.exports = {
  mergeShops,
  getShopById,
  saveShop,
  verifyPrice,
  reportShop,
  getUserStats,
  formatDate,
  generateId,
};
