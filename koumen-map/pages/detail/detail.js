const { getShopById, verifyPrice, reportShop } = require('../../utils/storage');
const { formatDistance, getDistance } = require('../../utils/geo');

Page({
  data: {
    shop: null,
    distanceText: '',
    mealTip: '',
    showReportPanel: false,
    reportTypes: ['价格涨了', '已经关门', '信息有误', '其他'],
    reportType: '',
    reportNote: '',
  },

  onLoad(options) {
    this.shopId = options.id;
    this.loadShop();
  },

  onShow() {
    this.loadShop();
  },

  loadShop() {
    const shop = getShopById(this.shopId);
    if (!shop) {
      this.setData({ shop: null });
      return;
    }

    const loc = getApp().globalData.userLocation;
    let distanceText = '';
    if (loc) {
      distanceText = formatDistance(
        getDistance(loc.lat, loc.lng, shop.latitude, shop.longitude)
      );
    }

    const main = shop.items.reduce((min, item) =>
      item.price >= 5 && item.price < min.price ? item : min, shop.items[0]);

    this.setData({
      shop,
      distanceText,
      mealTip: main ? `${main.name} ¥${main.price}` : '',
    });
  },

  onVerify(e) {
    const index = e.currentTarget.dataset.index;
    const result = verifyPrice(this.shopId, index);

    if (!result) return;

    if (result.already) {
      wx.showToast({ title: '你已经核实过了', icon: 'none' });
      return;
    }

    getApp().addCoins(5);
    wx.showToast({ title: '+5 抠抠币', icon: 'none' });
    this.loadShop();
  },

  openMap() {
    const { shop } = this.data;
    wx.openLocation({
      latitude: shop.latitude,
      longitude: shop.longitude,
      name: shop.name,
      address: shop.address || '',
      scale: 18,
    });
  },

  showReport() {
    this.setData({ showReportPanel: true, reportType: '', reportNote: '' });
  },

  hideReport() {
    this.setData({ showReportPanel: false });
  },

  selectReportType(e) {
    this.setData({ reportType: e.currentTarget.dataset.type });
  },

  onReportNoteInput(e) {
    this.setData({ reportNote: e.detail.value });
  },

  submitReport() {
    if (!this.data.reportType) {
      wx.showToast({ title: '请选择反馈类型', icon: 'none' });
      return;
    }
    reportShop(this.shopId, this.data.reportType, this.data.reportNote);
    getApp().addCoins(3);
    this.hideReport();
    wx.showToast({ title: '感谢反馈 +3抠抠币', icon: 'none' });
  },
});
