const { mergeShops } = require('./utils/storage');

App({
  globalData: {
    userLocation: null,
    coins: 0,
  },

  onLaunch() {
    const coins = wx.getStorageSync('koumen_coins');
    if (typeof coins === 'number') {
      this.globalData.coins = coins;
    }
    mergeShops();
  },

  addCoins(amount) {
    this.globalData.coins += amount;
    wx.setStorageSync('koumen_coins', this.globalData.coins);
  },
});
