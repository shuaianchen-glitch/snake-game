const { PRICE_FILTERS } = require('../../utils/data');
const { mergeShops } = require('../../utils/storage');
const { sortByDistance, filterByPrice, formatDistance, getMarkerColor } = require('../../utils/geo');

// 默认中心：武汉大学（无定位时展示种子数据）
const DEFAULT_CENTER = { lat: 30.5365, lng: 114.3640 };

Page({
  data: {
    filters: PRICE_FILTERS,
    activeFilter: '20',
    center: DEFAULT_CENTER,
    scale: 15,
    markers: [],
    shops: [],
    locationLabel: '',
  },

  onLoad() {
    this.initLocation();
  },

  onShow() {
    this.refreshShops();
  },

  initLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const center = { lat: res.latitude, lng: res.longitude };
        this.setData({ center, locationLabel: '已定位' });
        getApp().globalData.userLocation = center;
        this.refreshShops(center);
      },
      fail: () => {
        this.setData({ locationLabel: '未授权定位，显示示例区域' });
        this.refreshShops(DEFAULT_CENTER);
        wx.showToast({ title: '可授权定位查看附近', icon: 'none', duration: 2500 });
      },
    });
  },

  refreshShops(center) {
    const loc = center || this.data.center;
    const maxPrice = PRICE_FILTERS.find((f) => f.key === this.data.activeFilter)?.max ?? 20;

    let shops = mergeShops();
    shops = filterByPrice(shops, maxPrice);
    shops = sortByDistance(shops, loc.lat, loc.lng).map((s) => ({
      ...s,
      distanceText: formatDistance(s.distance),
    }));

    const markers = shops.map((shop, index) => ({
      id: index,
      shopId: shop.id,
      latitude: shop.latitude,
      longitude: shop.longitude,
      width: 28,
      height: 28,
      callout: {
        content: `¥${shop.fullMealPrice}`,
        display: 'ALWAYS',
        padding: 6,
        borderRadius: 8,
        fontSize: 12,
        color: '#ffffff',
        bgColor: getMarkerColor(shop.fullMealPrice),
      },
    }));

    this.setData({ shops, markers });
    this._shopIndexMap = shops.reduce((acc, s, i) => {
      acc[i] = s.id;
      return acc;
    }, {});
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeFilter: key });
    this.refreshShops();
  },

  onMarkerTap(e) {
    const shopId = this._shopIndexMap?.[e.markerId];
    if (shopId) this.goDetail({ currentTarget: { dataset: { id: shopId } } });
  },

  moveToUser() {
    const loc = getApp().globalData.userLocation;
    if (loc) {
      this.setData({ center: loc, scale: 16 });
      this.refreshShops(loc);
    } else {
      this.initLocation();
    }
  },

  onRegionChange(e) {
    if (e.type === 'end' && e.causedBy === 'drag') {
      const mapCtx = wx.createMapContext('shopMap', this);
      mapCtx.getCenterLocation({
        success: (res) => {
          this.setData({ center: { lat: res.latitude, lng: res.longitude } });
          this.refreshShops({ lat: res.latitude, lng: res.longitude });
        },
      });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
});
