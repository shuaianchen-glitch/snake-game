const { CATEGORIES, TAGS } = require('../../utils/data');
const { saveShop, generateId, formatDate } = require('../../utils/storage');

Page({
  data: {
    name: '',
    category: '面',
    address: '',
    latitude: null,
    longitude: null,
    items: [{ name: '', price: '' }],
    tips: '',
    tags: [],
    categories: CATEGORIES,
    allTags: TAGS,
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.value });
  },

  onTagTap(e) {
    const value = e.currentTarget.dataset.value;
    const tags = [...this.data.tags];
    const idx = tags.indexOf(value);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(value);
    this.setData({ tags });
  },

  pickLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: this.data.address || res.address || res.name,
        });
      },
      fail: () => {
        wx.showToast({ title: '需要位置权限', icon: 'none' });
      },
    });
  },

  onItemNameInput(e) {
    const items = [...this.data.items];
    items[e.currentTarget.dataset.index].name = e.detail.value;
    this.setData({ items });
  },

  onItemPriceInput(e) {
    const items = [...this.data.items];
    items[e.currentTarget.dataset.index].price = e.detail.value;
    this.setData({ items });
  },

  addItem() {
    this.setData({ items: [...this.data.items, { name: '', price: '' }] });
  },

  removeItem(e) {
    const items = [...this.data.items];
    items.splice(e.currentTarget.dataset.index, 1);
    this.setData({ items });
  },

  onSubmit() {
    const { name, category, address, latitude, longitude, items, tips, tags } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '请填写店名', icon: 'none' });
      return;
    }
    if (!latitude || !longitude) {
      wx.showToast({ title: '请选择位置', icon: 'none' });
      return;
    }

    const parsedItems = items
      .filter((i) => i.name.trim() && i.price)
      .map((i) => ({
        name: i.name.trim(),
        price: Number(i.price),
        verifiedCount: 1,
        lastVerifiedAt: formatDate(new Date()),
      }));

    if (parsedItems.length === 0) {
      wx.showToast({ title: '请至少添加一个菜品价格', icon: 'none' });
      return;
    }

    const shop = saveShop({
      id: generateId(),
      name: name.trim(),
      category,
      address: address.trim(),
      latitude,
      longitude,
      items: parsedItems,
      tips: tips.trim(),
      tags,
      source: 'user',
      createdAt: formatDate(new Date()),
    });

    getApp().addCoins(20);

    wx.showModal({
      title: '投稿成功 🎉',
      content: `「${shop.name}」已加入地图，+20 抠抠币`,
      showCancel: false,
      success: () => {
        this.resetForm();
        wx.switchTab({ url: '/pages/index/index' });
      },
    });
  },

  resetForm() {
    this.setData({
      name: '',
      category: '面',
      address: '',
      latitude: null,
      longitude: null,
      items: [{ name: '', price: '' }],
      tips: '',
      tags: [],
    });
  },
});
