const { getUserStats } = require('../../utils/storage');

Page({
  data: {
    coins: 0,
    stats: { submitCount: 0, verifyCount: 0, reportCount: 0 },
  },

  onShow() {
    this.setData({
      coins: getApp().globalData.coins,
      stats: getUserStats(),
    });
  },

  goSubmit() {
    wx.switchTab({ url: '/pages/submit/submit' });
  },

  showAbout() {
    wx.showModal({
      title: '抠门地图',
      content: '中国版平价生存地图。只收录你吃得起的地方，价格优先，社区共建。',
      showCancel: false,
    });
  },

  clearData() {
    wx.showModal({
      title: '清除本地数据',
      content: '将清除你的投稿、核实记录和抠抠币，种子店铺会保留。',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('koumen_shops');
          wx.removeStorageSync('koumen_verifications');
          wx.removeStorageSync('koumen_reports');
          wx.removeStorageSync('koumen_coins');
          getApp().globalData.coins = 0;
          this.onShow();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      },
    });
  },
});
